// abnahme.mjs - Testszenarien fuer Motto Otto
// =============================================================================================
// Markus, 17. September 2026: "Dafuer muessen wir Testszenarien aufbauen, dass alles immer
// 100 % funktioniert." Ziel ist der Gang nach Shopify und online.
//
// Diese Abnahme laeuft OHNE Bildlaeufe: keine Kosten, keine Wartezeit, in Sekunden durch.
// Sie prueft alles, was ohne das Bildmodell pruefbar ist - und das ist das meiste:
//
//   1 Prompts     Baut jedes aktive Motto einen vollstaendigen, widerspruchsfreien Prompt?
//   2 Artikel     Traegt jede Druckdatei das Mass, das der Kunde bestellt hat?
//   3 Ansichten   Bekommt jeder Artikel sein eigenes Mockup - oder ehrlich gar keins?
//   4 Stile       Ist jeder Stil vorhanden und von den anderen unterscheidbar?
//   5 Versprechen Stimmen die Zahlen auf der Seite mit dem Code ueberein?
//
// Aufruf:   node abnahme.mjs            (alles)
//           node abnahme.mjs 1 3        (nur Abschnitt 1 und 3)
//
// Ausgang:  0 = alles bestanden, 1 = mindestens eine Pruefung gescheitert.
//
// Was hier NICHT geprueft werden kann, weil es einen echten Bildlauf braucht - die Qualitaet
// der Designs, der Alphakanal der fertigen Datei, der gemalte Hintergrund - steht in
// abnahme-bilder.mjs (kostet Bildlaeufe, laeuft auf Ansage).
// =============================================================================================

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { formatAusMass, pickVariation as pickVariationAb, VARIETY as VARIETY_AB, cleanValue, HAT_EMOJI, EMOJI_SATZ, gruppenFoto, GRUPPENFOTO_FELDER, GRUPPENFOTO_AUSNAHME, FOTO_AUSNAHME, figurenFuer, FIGUREN_FOTO, buildPrompt, STYLES, STYLE_KEYS, printRules, istHell, textilTon, stoffLiefertFarbe, TEXTILTOENE, setPromptFassung, textilFuerStil, textilFuerAuftrag, stilTextilTabelle, rueckseitePrompt, hatNamensliste, palettePrompt } from './mottos.js';
import { ARTIKEL, artikelLeinwand, flaechenVon, verkaufsfaehig, ansichtVon } from './artikel.js';
import { GARMENTS as MOCKUPS, MITGELIEFERT as MO_MITGELIEFERT, SZENE_THEMEN, DRUCK_ARTEN, themaEndung, stoffSchatten, stoffMaske, szeneMassstab, SHIRT_CM, SZENE_RUECKEN, SZENE_RUMPF_MITTE, SZENE_SHIRT_PX, SZENE_RUECKEN_ACHSE, rueckenWoelben, rueckenRadius, RUECKEN_VERSATZ_CM } from './mockups.js';
import { SZENEN_ZETTEL, szeneThemaAuftrag } from './vorlagen.js';
// Fassung 85: die Selbstmessung der Druckflaeche neuer Vorlagen
import { flaecheAusAlpha, flaecheAusMagenta, magentaEntfernen, VORLAGEN } from './vorlagen.js';
import { werVomNamen, vornamenStand } from './vornamen.js';
import { makeMaster } from './images.js';
import sharp from 'sharp';
import { PLANS, GUEST_FREE } from './accounts.js';
import { GRUPPEN as ZAEHLER_GRUPPEN } from './zaehler.js';
// Fassung 80: Die Textil-Linie und ihre Bildrechte - Roly erlaubt keine bearbeiteten Fotos.
// 23. Sept.: die Schrift des Namens - bestellt in names.js, mitgeliefert in fonts/
import { cleanNames, NAME_FONTS, STIL_SCHRIFT, schriftFuerStil, renderNameList, nameListZonePrompt } from './names.js';
import { MARKEN, LINIE, linieBereit, linieBericht, linieRueckenErlaubt, FORMEN_OHNE_VORLAGE, PAKET, AUSGESCHLOSSEN, BC_E190_FARBEN, RUECKANSICHT_GEHOLT } from './textilien.js';
// Fassung 91: die Preisliste. Bis zum 23. Sept. hatten elf Artikel ein Mockup, aber keinen
// Preis - sie waren also sichtbar und waeren mit 0,00 Euro im Korb gelandet. Siehe PREISE.md.
import { createRequire } from 'node:module';
const PREISE = createRequire(import.meta.url)('./preise.cjs');

const nur = process.argv.slice(2).filter(a => /^\d+$/.test(a)).map(Number);
const laeuft = (n) => !nur.length || nur.includes(n);

let fehler = 0, geprueft = 0;
const gruen = (s) => `\x1b[32m${s}\x1b[0m`, rot = (s) => `\x1b[31m${s}\x1b[0m`, grau = (s) => `\x1b[90m${s}\x1b[0m`;

function pruefe(name, bedingung, detail = '') {
  geprueft++;
  if (bedingung) { console.log('  ' + gruen('✓') + ' ' + name + (detail ? grau(' · ' + detail) : '')); return true; }
  fehler++;
  console.log('  ' + rot('✗ ' + name) + (detail ? ' · ' + detail : ''));
  return false;
}
function abschnitt(n, titel) { console.log('\n' + n + ' · ' + titel.toUpperCase()); }
// Kein Pruefpunkt, sondern eine Lagemeldung: etwas ist offen, aber nichts ist falsch.
function hinweis(text) { console.log('  ' + grau('· ' + text)); }

const mottoDir = 'storage/mottos';
async function mottosLaden() {
  const namen = (await fs.readdir(mottoDir)).filter(f => f.endsWith('.json')).sort();
  const out = [];
  for (const n of namen) {
    const m = JSON.parse(await fs.readFile(path.join(mottoDir, n), 'utf8'));
    if (m.active !== false) out.push(m);
  }
  return out;
}
// Pflichtfelder mit plausiblen Werten fuellen - ein Prompt mit leerem Pflichtfeld ist kein Test.
function beispielWerte(m) {
  const v = {};
  for (const f of (m.fields || [])) {
    if (f.type === 'checkbox') { v[f.key] = f.required ? 'ja' : ''; continue; }
    if (f.type === 'upload') { v[f.key] = ''; continue; }
    if (f.options && f.options.length) { v[f.key] = f.options[0]; continue; }
    if (!f.required) continue;
    v[f.key] = f.key === 'jahr' || f.key === 'saison' ? '2026' : f.key === 'alter' ? '40' : 'Beispiel';
  }
  return v;
}

// ---------------------------------------------------------------------------- 1 · Prompts
async function pruefePrompts(mottos) {
  abschnitt(1, 'Prompts: baut jedes Motto einen vollstaendigen Prompt?');
  // 1. Okt. (Markus: "Und warum sollten wir keine Emojis und Sonderzeichen drucken koennen?" - sein
  // "Jedes Jahr..." wurde zu "Jedes Jahr", weil das iPhone daraus das EINE Zeichen "…" macht).
  pruefe('Zeichen: "…" wird zu "...", Anfuehrungszeichen, %, @, €, ° bleiben', cleanValue('Jedes Jahr…', 80) === 'Jedes Jahr...' && cleanValue('„Wir“ 100% @ Malle 5€ 30°', 80) === '„Wir“ 100% @ Malle 5€ 30°');
  pruefe('Zeichen: Emojis bleiben in Texten, die Otto malt, und der Auftrag sagt, wie sie gemalt werden', cleanValue('Liebe Grüße ❤️ 🇩🇪', 80) === 'Liebe Grüße ❤️ 🇩🇪' && HAT_EMOJI.test('❤️')
    && mottos.some(m => m.fields && buildPrompt(m, Object.fromEntries(m.fields.map(f => [f.key, 'Wir ❤️ Malle'])), {}).includes(EMOJI_SATZ)));
  { const cn = cleanNames('Lena ❤️\nTim…', 24);
    pruefe('Zeichen: Namenslisten (eigene Schrift) lassen Emojis weg und melden es, "…" wird "..."', cn.names.join('|') === 'Lena|Tim...' && cn.changed.length === 2, JSON.stringify(cn)); }

  // 1./2. Okt., Markus: "Am Anfang soll man ein Foto hochladen ... Wenn ich da kein Foto hochlade,
  // brauche ich nicht die Frage, wie die Menschen aussehen sollen." Welche Mottos das sind, was das
  // Foto im Auftrag bewirkt und dass ein freiwilliges Foto nie "fehlt".
  {
    const mitFoto = mottos.filter(m => gruppenFoto(m)).map(m => m.slug).sort();
    const erwartet = ['abschlussfahrt', 'bowling', 'darts', 'familie', 'firmenausflug', 'hochzeit', 'junggesellenabschied', 'karneval', 'kegeltour', 'malle-fahrt', 'schulmotto', 'vereinsjubilaeum', 'weihnachtsfeier'];
    pruefe('Foto zuerst: die 13 Mottos mit Figuren bekommen das freiwillige Foto (nicht Freestyle)',
      erwartet.every(x => mitFoto.includes(x)) && !mitFoto.includes('freestyle') && GRUPPENFOTO_FELDER[0].key === 'foto' && GRUPPENFOTO_FELDER[0].ohneGeht === true && GRUPPENFOTO_FELDER[0].required === false,
      mitFoto.join(', '));
    const m = mottos.find(x => x.slug === 'abschlussfahrt');
    const fig = m ? figurenFuer(m).map(f => f.key) : [];
    pruefe('Foto zuerst: mit Foto nur Figurenarten, die einen echten Menschen umzeichnen (kein Strichmaennchen, kein Maskottchen, nicht "ohne Menschen")',
      fig.join(',') === FIGUREN_FOTO.join(','), fig.join(','));
    const mitG = m ? buildPrompt(m, Object.fromEntries(m.fields.map(f => [f.key, 'Klasse 10b'])), { foto: 'gruppe' }) : '';
    const ohne = m ? buildPrompt(m, Object.fromEntries(m.fields.map(f => [f.key, 'Klasse 10b'])), {}) : '';
    pruefe('Foto zuerst: der Auftrag nimmt die Leute vom Foto und die Szene vom Motto (nicht "das Foto entscheidet den Inhalt")',
      mitG.includes(GRUPPENFOTO_AUSNAHME) && !mitG.includes(FOTO_AUSNAHME) && !ohne.includes(GRUPPENFOTO_AUSNAHME) && /exactly as many people/.test(GRUPPENFOTO_AUSNAHME));
    await import('./abfolge.js');
    const AB = globalThis.MoAbfolge;
    const mm = { fields: [GRUPPENFOTO_FELDER[0], { key: 'crew', label: 'Crew', type: 'text', required: true }] };
    const plan = AB.planen(mm, id => ['f_foto', 'f_crew', 'f-figuren'].includes(id));
    const fe = AB.fehlt(plan[0], mm, {}, { fotoOk: false });
    const zf = AB.zusammenfassung(plan, mm, { crew: 'X' }, { fotoOk: false })[0];
    pruefe('Foto zuerst: das Foto ist Schritt 1, ohne Foto fehlt nichts, die Zusammenfassung sagt "ohne Foto"',
      plan[0].id === 'feld_foto' && fe === '' && zf && zf.wert === 'ohne Foto' && plan.some(s => s.id === 'figuren'), JSON.stringify({ erster: plan[0].id, fe, zf }));
  }

  for (const fassung of ['alt', 'schlank']) {
    setPromptFassung(fassung);
    let kaputt = [], leer = [], lang = [], widerspruch = [];
    for (const m of mottos) {
      let p = '';
      try { p = String(buildPrompt(m, beispielWerte(m), { textile: 'dunkel' })); }
      catch (e) { kaputt.push(m.slug + ': ' + e.message); continue; }
      // Ein leeres Feld darf nie als reads exactly "" im Prompt landen
      if (/reads exactly\s*""|shows exactly\s*""|"\s*"/.test(p)) leer.push(m.slug);
      if (/\bundefined\b|\bnull\b|\[object Object\]/.test(p)) kaputt.push(m.slug + ': Platzhalter im Text');
      if (p.length > 8000) lang.push(m.slug + ' (' + p.length + ')');
      // Der Widerspruch, der monatelang drin stand: Satz 1 bestellt einen Hintergrund,
      // die Regeln verbieten ihn. Darf nie wiederkommen.
      if (/plain empty background/i.test(p) && /fabric stays bare|garment supplies|shirt itself is the background/i.test(p)) widerspruch.push(m.slug);
    }
    pruefe(`[${fassung}] alle ${mottos.length} Mottos bauen einen Prompt`, !kaputt.length, kaputt.join('; '));
    pruefe(`[${fassung}] kein leerer Text im Prompt`, !leer.length, leer.join(', '));
    pruefe(`[${fassung}] kein Prompt laenger als 8000 Zeichen`, !lang.length, lang.join(', '));
    pruefe(`[${fassung}] kein Hintergrund-Widerspruch`, !widerspruch.length, widerspruch.join(', '));
  }
  setPromptFassung('alt');

  // Fassung 60 (22. Sept., Markus: "wir haben doch umgebaut, dass es keine festen Stellen fuer
  // irgendwas gibt"): Ohne hochgeladenes Logo darf NIRGENDS eine Flaeche reserviert werden -
  // sonst steht im selben Auftrag "lass ein Drittel frei" UND "Do NOT reserve any empty area",
  // und das Modell entscheidet sich fuers Loch. Der Motto-Text darf die Stelle nicht vorschreiben,
  // die Variation auch nicht, und die Variations-Ansage schon gar nicht. Genau das war bei
  // Vereinsjubilaeum und Firmenausflug durchgerutscht, weil beide die Flaeche ohne das Wort
  // "leave" bestellt haben - der eine als Aufzaehlungspunkt, der andere als Lagebeschreibung.
  {
    const mitUpload = mottos.filter(m => m.upload && m.upload.mode && m.upload.mode !== 'off');
    // Beide Schreibweisen aus den echten Variationslisten - mit Artikel und ohne. Die ohne
    // ("empty emblem area in the middle") war beim ersten Anlauf durchgerutscht.
    const VARIATIONEN = [
      'laurel wreath around the empty emblem area, banners above and below',
      'round badge with sun rays, empty emblem area in the middle',
    ];
    let nagelt = [], verloren = [];
    for (const m of mitUpload) for (const VARIATION of VARIATIONEN) {
      const ohne = String(buildPrompt(m, beispielWerte(m), { textile: 'dunkel', logoMoeglich: true, variation: VARIATION }));
      // Die Ansage selbst ("Do NOT reserve or leave any empty area") und die Freisteller-Regel
      // ("at least a quarter of the canvas stays completely empty") duerfen stehen - sonst nichts.
      const zeilen = ohne.split('\n')
        .filter(z => !/^NO logo is added afterwards/.test(z.trim()) && !/THE PRINT IS A SHAPE/.test(z))
        .filter(z => /(?<!\b(?:no|any|or)\s)\b(?:the\s+|an?\s+)?(?:free|empty|reserved)(?:\s+\w+)?\s+area\b|\bstays (completely )?empty for\b|\bempty[^.\n]{0,40}\bfor the (club|company|customer)/i.test(z));
      if (zeilen.length) nagelt.push(m.slug + ': ' + zeilen[0].trim().slice(0, 70));
      // Gegenprobe: kommt ein Logo, MUSS die Flaeche bestellt werden - sonst haben wir sie
      // beim Aufraeumen mit weggeputzt und das Logo laege spaeter mitten im Motiv.
      const mit = String(buildPrompt(m, beispielWerte(m), { textile: 'dunkel', logoColors: 'blau, weiss', variation: VARIATION }));
      if (!/reserved (empty )?area/i.test(mit)) verloren.push(m.slug);
    }
    pruefe(`ohne Logo nagelt kein Motto eine Stelle fest (${mitUpload.length} mit Upload)`, !nagelt.length, nagelt.join(' · '));
    pruefe('mit Logo bestellt jedes Motto die Flaeche weiterhin', !verloren.length, verloren.join(', '));
  }

  // 23. Sept.: Der Schutz oben greift nur fuer Mottos, die ueberhaupt ein Logo VORSEHEN. Bei
  // einem Motto ganz OHNE Logo-Upload (Abi, Malle-Fahrt, Weihnachtsfeier ...) stand in der
  // Variationszeile weiter "keep all texts, THE EMPTY AREA FOR THE LOGO and the print rules" -
  // ein Auftrag, der auf nichts zeigt, denn bestellt worden war nie eine Flaeche. Genau daraus
  // wird das Loch im Design. Aufgefallen beim Nachzeichnen der Stilbeispiele.
  {
    const ohneUpload = mottos.filter(m => !m.upload || !m.upload.mode || m.upload.mode === 'off');
    const geistflaeche = [];
    for (const m of ohneUpload) {
      const p = String(buildPrompt(m, beispielWerte(m), {
        textile: 'hell', style: 'vintage', variation: 'layout: headline on a waving ribbon, main motif above it'
      }));
      // Wer die Flaeche erwaehnt, muss sie auch bestellt haben.
      // Beide Geisterstellen: die Variationszeile UND die Stilzeile.
      if (/empty (area for the logo|logo area)/i.test(p) && !/reserved (empty )?area/i.test(p)) geistflaeche.push(m.slug);
    }
    pruefe(`Mottos ohne Logo erwaehnen keine Logo-Flaeche (${ohneUpload.length} geprueft)`,
      !geistflaeche.length, geistflaeche.join(', '));
  }

  // Die Schwarz-Regel muss beides sagen: aussen nichts, innen erlaubt.
  // Die Schwarz-Regel muss beides sagen: aussen nichts, innen erlaubt.
  const r = printRules('schwarz', 'standard');
  pruefe('Schwarz-Regel verbietet Hintergrund und Kasten', /no black background, no black panel/i.test(r));
  pruefe('Schwarz-Regel erlaubt Schwarz IM Motiv', /INSIDE the artwork, black is an ordinary colour/i.test(r));
  pruefe('Buchstaben-Punzen bleiben offen', /counters inside the letters stay open/i.test(r));
  pruefe('helles Textil: keine Schwarz-Sperre', !/black background, no black panel/i.test(printRules('hell', 'standard')));

  // ---- Vier Textiltoene (26. Sept.) ------------------------------------------------
  // Markus: "Dass die Leute ganz genau waehlen koennen fuer weisses Textil helles Textil
  // dunkles Textil und schwarzes Textil, das ist glaub ich ganz ganz wichtig."
  //
  // Drei Dinge muessen dafuer stimmen, und alle drei stehen hier:
  //  1. weiss und schwarz aendern sich NICHT - das sind die bewaehrten Regeln.
  //  2. hell und dunkel unterscheiden sich wirklich, sonst waere die Wahl eine Attrappe.
  //  3. die Buntfarben-Regeln duerfen keine Schutzklausel der reinen verlieren.
  // Punkt 3 ist nicht theoretisch: beim ersten Anlauf fehlte in der Dunkel-Regel der Satz
  // "no dark haze beside it". Prompt gelaufen, Ergebnis: grauer Nebel im Motiv und 66,3 %
  // Deckung statt 97,8 %. EIN Satz. Deshalb wird das jetzt gezaehlt statt gelesen.
  for (const st of STYLE_KEYS) for (const f of ['alt', 'schlank']) {
    pruefe(`Ton hell unterscheidet sich von weiss (${st}/${f})`,
      printRules('hell', st, undefined, f) !== printRules('weiss', st, undefined, f));
    pruefe(`Ton dunkel unterscheidet sich von schwarz (${st}/${f})`,
      printRules('dunkel', st, undefined, f) !== printRules('schwarz', st, undefined, f));
  }
  {
    const rein = printRules('schwarz', 'standard'), bunt = printRules('dunkel', 'standard');
    // Die beiden Ausnahmen sagen ausdruecklich "black" und haben in der Buntfarben-Regel
    // ihre eigene Entsprechung ("no background panel or box behind the motif").
    const eigenes = ['no black background', 'no black panel or box behind the motif'];
    const klauseln = [...new Set((rein.match(/no [a-z][^,.;]{3,60}/gi) || []).map(x => x.trim().toLowerCase()))];
    const fehlt = klauseln.filter(k => !eigenes.includes(k) && !bunt.toLowerCase().includes(k));
    pruefe(`die Dunkel-Regel verliert keine Schutzklausel der Schwarz-Regel (${klauseln.length} geprueft)`,
      !fehlt.length, fehlt.join(' | '));
    pruefe('die Dunkel-Regel verbietet den dunklen Nebel ausdruecklich', /no dark haze beside it/i.test(bunt));
    pruefe('auf dunkler Buntfarbe wird Schwarz gedruckt statt ausgespart',
      /Black INSIDE the artwork is a printed colour/i.test(bunt));
    // In BEIDEN Fassungen pruefen: live laeuft 'alt' (RULES_HELL), die schlanke sagt dasselbe
    // mit anderen Worten. Beim ersten Anlauf stand hier nur der schlanke Wortlaut - die
    // Pruefung schlug fehl, obwohl die Regel stimmte. Ein Test, der nur eine von zwei
    // Fassungen kennt, prueft die Haelfte.
    for (const f of ['alt', 'schlank']) {
      pruefe(`auf heller Buntfarbe ist Weiss eine echte Druckfarbe (${f})`,
        /are real printed colours here|ARE printed colours here/i.test(printRules('hell', 'standard', undefined, f)));
      pruefe(`auf reinem Weiss bleibt Weiss verboten - dort wuerde es verschwinden (${f})`,
        /white would vanish on the shirt|White and cream would vanish/i.test(printRules('weiss', 'standard', undefined, f)));
    }
  }
  pruefe('kein Prompt bestellt eine LEERE Flaeche statt einer unbedruckten',
    !TEXTILTOENE.some(t => /LEFT COMPLETELY EMPTY|there is no white ink|there is no black ink/i.test(printRules(t, 'standard'))));
  for (const [ton, hell] of [['weiss', true], ['hell', true], ['dunkel', false], ['schwarz', false]]) {
    pruefe(`Ton "${ton}" gilt als ${hell ? 'heller' : 'dunkler'} Stoff`, istHell(ton) === hell);
  }
  pruefe('unbekannter Textilwert faellt auf schwarz zurueck, nicht ins Leere', textilTon('quatsch') === 'schwarz');
  pruefe('nur reines Weiss und reines Schwarz liefern die Farbe selbst',
    stoffLiefertFarbe('weiss') === '#ffffff' && stoffLiefertFarbe('schwarz') === '#000000'
    && !stoffLiefertFarbe('hell') && !stoffLiefertFarbe('dunkel'));

  // Ein Stil mit eigener Textilzeile ersetzt die Standardzeile. Dann muss er deren
  // Schutz mitbringen, sonst faellt er still weg (genau so entstand die weisse Tafel).
  for (const k of STYLE_KEYS.filter(s => STYLES[s].dark)) {
    const rr = printRules('schwarz', k);
    pruefe(`Stil "${STYLES[k].label}" verbietet grosse weisse Flaechen`, /no large flat white (plates|panels)/i.test(rr),
      'eigene dark-Zeile ersetzt die Standardregel');
  }
}

// ---------------------------------------------------------------------------- 2 · Artikel
function pruefeArtikel() {
  abschnitt(2, 'Artikel: traegt die Datei das bestellte Mass?');
  const offen = [];
  for (const [id, a] of Object.entries(ARTIKEL)) {
    if (!verkaufsfaehig(id)) continue;
    const flaechen = Object.keys(flaechenVon(id));
    if (!flaechen.length) { offen.push(id + ': keine Flaeche'); continue; }
    for (const fl of flaechen) {
      const lw = artikelLeinwand(id, fl);
      if (!lw) { offen.push(`${id}/${fl}: keine Leinwand`); continue; }
      const dpi = lw.dpiExakt || lw.dpi;
      const istB = lw.px[0] / dpi * 2.54, istH = lw.px[1] / dpi * 2.54;
      // Die Datei muss das bestellte Mass ABDECKEN - lieber einen halben Millimeter zu viel
      // (wird beschnitten) als zu wenig (unbedruckter Streifen).
      if (istB < lw.brutto[0] - 0.05 || istH < lw.brutto[1] - 0.05) {
        offen.push(`${a.name}/${fl}: Datei ${istB.toFixed(1)}x${istH.toFixed(1)} < bestellt ${lw.brutto.join('x')}`);
      }
      if (!(dpi > 0) || !isFinite(dpi)) offen.push(`${a.name}/${fl}: dpi unbrauchbar (${dpi})`);
    }
  }
  pruefe('jede Druckdatei deckt ihr bestelltes Mass ab', !offen.length, offen.slice(0, 6).join(' | '));

  // Die gerundete Zahl ist zum Anzeigen, die exakte fuer die Rechnung - beide muessen da sein.
  const lw = artikelLeinwand('strandtuch', Object.keys(flaechenVon('strandtuch'))[0]);
  pruefe('dpiExakt vorhanden und ungerundet', !!lw.dpiExakt && lw.dpiExakt !== Math.round(lw.dpiExakt),
    'Strandtuch: angezeigt ' + lw.dpi + ', gerechnet ' + lw.dpiExakt.toFixed(2));

  // Fassung 74: Die ERSTE Flaeche ist die, die ungefragt passiert - das Auswahlfeld im Browser
  // steht darauf, und artikelLeinwand faellt darauf zurueck, wenn nichts mitkommt.
  //
  // Der Unterschied ist wichtig: bei Kissen, Hundedecke oder Acrylbild sind die Eintraege
  // GROESSEN desselben Teils (S, M, L) - da ist die kleinste zuerst voellig richtig, sie ist
  // die guenstigste. Bei Textilien sind es PLATZIERUNGEN auf ein und demselben Shirt: Brust
  // klein, Nacken, Aermel, ganze Vorderseite. Wer dort die kleine zuerst stellt, verkauft
  // jedem, der nur "T-Shirt" anklickt, einen Aufnaeher - genau so kam am 17. September ein
  // T-Shirt mit 9,4 x 9,7 cm heraus. Fuer Textilien gilt darum: Vorauswahl = groesste Flaeche.
  const winzig = [];
  for (const [id, a] of Object.entries(ARTIKEL)) {
    if (!verkaufsfaehig(id) || !a.garment) continue;
    const fl = flaechenVon(id);
    const keys = Object.keys(fl);
    if (keys.length < 2) continue;
    const qcm = (k) => fl[k].cm[0] * fl[k].cm[1];
    const groesste = Math.max(...keys.map(qcm));
    if (qcm(keys[0]) < groesste) {
      const best = keys.find(k => qcm(k) === groesste);
      winzig.push(`${a.name}: Vorauswahl ${fl[keys[0]].cm.join('x')} cm, groesste ${fl[best].cm.join('x')} cm`);
    }
  }
  pruefe('Textil: die Vorauswahl ist die ganze Flaeche, nicht der Mini-Print', !winzig.length, winzig.join(' | '));
}

// Die Rechnung oben sagt nur, dass die Leinwand passen KOENNTE. Was zaehlt, ist die Datei, die
// makeMaster wirklich ausgibt: PNG speichert Pixel pro Meter, und sharp rundet die dpi-Angabe
// beim Schreiben auf eine ganze Zahl. Ohne diesen Durchlauf faellt das nicht auf - genau so
// stand am 17. September 71,3 cm in der Datei, wo 70,6 bestellt waren.
async function pruefeEchteDateien() {
  abschnitt(2.5, 'Druckdateien: stimmt das Mass in der fertigen Datei?');
  const daneben = [];
  for (const [id, a] of Object.entries(ARTIKEL)) {
    if (!verkaufsfaehig(id)) continue;
    const fl = Object.keys(flaechenVon(id))[0];
    const lw = artikelLeinwand(id, fl);
    if (!lw) continue;
    const roh = await sharp({ create: { width: lw.px[0], height: lw.px[1], channels: 4, background: { r: 200, g: 60, b: 40, alpha: 1 } } }).png().toBuffer();
    const m = await makeMaster(roh, { schonFrei: true, randLuft: false, leinwand: { dpi: lw.dpi, dpiExakt: lw.dpiExakt, cm: lw.brutto } });
    const md = await sharp(m).metadata();
    const istB = md.width / md.density * 2.54, istH = md.height / md.density * 2.54;
    if (Math.abs(istB - lw.brutto[0]) > 0.06 || Math.abs(istH - lw.brutto[1]) > 0.06) {
      daneben.push(`${a.name}: ${istB.toFixed(1)}x${istH.toFixed(1)} statt ${lw.brutto.join('x')}`);
    }
  }
  pruefe('jede erzeugte Datei traegt ihr bestelltes Mass', !daneben.length, daneben.slice(0, 5).join(' | '));
  // 21. Sept. (Markus, Robotic: "Katastrophe an den Raendern"): die Kantenglaettung der
  // Druckdatei hatte seit dem 16. Sept. jede Kante auf rund 15 px (1,5 mm) verwaschen statt sie
  // zu glaetten - linear() wirkte in der sharp-Kette nicht auf den Alphakanal. Probe: ein hart
  // begrenzter Kreis wird auf Druckgroesse gebracht; die Alpha-Rampe an seiner Kante muss danach
  // zwischen 1 und 5 px liegen (geglaettet, aber nicht verwaschen).
  {
    const kreis = await sharp(Buffer.from('<svg width="1024" height="1536"><circle cx="512" cy="768" r="380" fill="#c83c28"/></svg>')).png().toBuffer();
    const m = await makeMaster(kreis, { schonFrei: true, randLuft: false });
    const { data, info } = await sharp(m).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = info.width, H = info.height, rampen = [];
    for (let y = Math.round(H * 0.4); y < Math.round(H * 0.6); y += 25) { let run = 0; for (let x = 0; x < W; x++) { const a = data[(y * W + x) * 4 + 3]; if (a > 5 && a < 250) run++; else { if (run) rampen.push(run); run = 0; } } }
    rampen.sort((a, b) => a - b);
    const median = rampen[Math.floor(rampen.length / 2)] || 0, max = rampen[rampen.length - 1] || 0;
    pruefe('Druckdatei: die Kante ist geglaettet, nicht verwaschen (Alpha-Rampe 1 bis 5 px auf 300 dpi)', rampen.length >= 8 && median >= 1 && median <= 5 && max <= 8, `Rampen ${rampen.length}, Median ${median} px, max ${max} px bei ${W}x${H}`);
  }

  // 6. Okt., Markus: "ob wirklich 100 % alles transparent ausgeliefert wird und direkt so produziert, nicht nachtraeglich
  // freigestellt" - "Kanten schaerfen und hochrechnen muss natuerlich drin bleiben. Es geht nur um das Freistellen."
  // Also: kein Schwarz-Wegrechnen mehr (schwarzRaus), jeder Designauftrag bestellt Transparenz ausdruecklich, und die
  // Randmessung schneidet nicht aus. Ohne Alphakanal ist es ein Fehler (Regel 43, eigene Pruefung).
  {
    const imgQ = await fs.readFile('images.js', 'utf8'), bz = await fs.readFile('ballz.js', 'utf8'), sq = await fs.readFile('server.js', 'utf8');
    const mm = imgQ.slice(imgQ.indexOf('export async function makeMaster'), imgQ.indexOf('export async function combineLogos'));
    pruefe('Kein Freistellen in der Druckdatei: Schwarz wird nicht mehr weggerechnet, Transparenz ausdruecklich bestellt, Randmessung ohne Ausschneiden; Kanten schaerfen/glaetten bleiben',
      /return an \? \{ schwarzPruefen: true \} : \{\};/.test(sq) && !/schwarzRaus: true/.test(sq) &&
      /if \(args\.task === 'design'\) args\.background = 'transparent';/.test(bz) && /args\.background = background \|\| 'transparent';/.test(bz) &&
      !/edgeCheck\(await cutout\(cand\)\)/.test(sq) && /kanteGlaetten\(buf\)/.test(mm) && /alphaSchaerfen\(pngBuffer/.test(imgQ));
  }

  // 22. Sept. 2026, Markus zu einem Kundenmotiv ("John Black", Katze): "Guck dir die Schriften an,
  // das ist Katastrophe. Wir brauchen nichts freistellen, wir haben einen Alpha Kanal."
  // Nachgestellt und gemessen: der Bilddienst lieferte die Schrift sauber, UNSERE Alpha-Haertung
  // hat sie zerfressen. Die Hof-Regel nahm dunkle, nicht ganz deckende Pixel weg - und weil der
  // Bilddienst nie Alpha 255 liefert (gemessen: hoechstens 254, voll deckende Pixel 0,0 Prozent),
  // galt jedes schwarze Pixel als Hof. 96 Prozent des Weggenommenen lag MITTEN im Motiv.
  // Probe: schwarze duenne Striche auf durchsichtigem Grund, hoechstes Alpha 254 wie beim echten
  // Dienst. Danach muessen sie noch da sein.
  {
    const { alphaSchaerfen } = await import('./images.js');
    const W = 600, H = 200, roh = Buffer.alloc(W * H * 4, 0);
    // Drei senkrechte Striche, 3 px breit, schwarz - wie die Haarlinien einer Schrift.
    for (let y = 40; y < 160; y++) for (const x0 of [120, 300, 480]) for (let x = x0; x < x0 + 3; x++) {
      const i = (y * W + x) * 4;
      roh[i] = 12; roh[i + 1] = 12; roh[i + 2] = 12; roh[i + 3] = 254;   // nie 255, wie beim Bilddienst
    }
    const vorher = (() => { let n = 0; for (let p = 0; p < W * H; p++) if (roh[p * 4 + 3] > 128) n++; return n; })();
    const geschaerft = await alphaSchaerfen(await sharp(roh, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer(), {});
    const { data: nach } = await sharp(geschaerft.buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let nachher = 0;
    for (let p = 0; p < W * H; p++) if (nach[p * 4 + 3] > 128) nachher++;
    pruefe('duenne schwarze Schrift ueberlebt die Alpha-Haertung (der Bilddienst liefert nie Alpha 255)',
      nachher >= vorher * 0.55, `vorher ${vorher} Pixel, nachher ${nachher} (${Math.round(nachher / vorher * 100)} %)`);
  }
}

// ---------------------------------------------------------------------------- 3 · Ansichten
async function pruefeAnsichten() {
  abschnitt(3, 'Ansichten: bekommt jeder Artikel sein eigenes Mockup?');
  const mock = Object.keys(MOCKUPS);
  const falsch = [], ohne = [];
  for (const [id, a] of Object.entries(ARTIKEL)) {
    if (!verkaufsfaehig(id)) continue;
    const an = ansichtVon(id);
    if (!an) { ohne.push(a.name); continue; }
    if (!mock.includes(an)) falsch.push(`${a.name} -> ${an} (gibt es nicht)`);
  }
  pruefe('keine Ansicht zeigt ein Mockup, das es nicht gibt', !falsch.length, falsch.join(', '));

  // Fassung 85: Die Druckflaeche einer neuen Vorlage misst sich selbst (vorlagen.js). Diese
  // Messung ist der Engpass fuer jedes kuenftige Mockup - sitzt sie daneben, sitzt das Motiv
  // daneben, und zwar auf JEDEM Teil dieser Sorte. Deshalb wird sie hier gegen Bilder mit
  // bekannter Loesung geprueft und nicht nur einmal von Hand angesehen.
  const leer = { r: 0, g: 0, b: 0, alpha: 0 };
  const kasten = (b, h, farbe) => sharp({ create: { width: b, height: h, channels: 4, background: farbe } }).png().toBuffer();
  const auf = async (b, h, links, oben, farbe, grund) =>
    sharp({ create: { width: 1024, height: 1024, channels: 4, background: grund || leer } })
      .composite([{ input: await kasten(b, h, farbe), left: links, top: oben }]).png().toBuffer();
  const passt = (a, s, tol = 3) => a && ['x', 'y', 'w', 'h'].every(k => Math.abs(a[k] - s[k]) <= tol);

  // 1. Flachware: das Teil steht freigestellt im Bild, der Alphakanal ist die Kontur.
  const flach = await flaecheAusAlpha(await auf(470, 700, 270, 150, { r: 240, g: 238, b: 232, alpha: 1 }));
  pruefe('Druckflaeche von Flachware wird aus der Kontur gemessen', passt(flach, { x: 270, y: 150, w: 470, h: 700 }),
    `${flach.x},${flach.y} ${flach.w}x${flach.h} - erwartet 270,150 470x700`);

  // 2. Teilflaeche: der Magenta-Platzhalter, wie ihn das Modell malt - nie exakt getroffen.
  const stoff = { r: 28, g: 28, b: 32, alpha: 1 };
  const mitPlatz = await auf(370, 555, 330, 250, { r: 243, g: 22, b: 214, alpha: 1 }, stoff);
  const teil = await flaecheAusMagenta(mitPlatz);
  pruefe('Druckflaeche auf dem Teil wird am Platzhalter gefunden', passt(teil, { x: 330, y: 250, w: 370, h: 555 }),
    `${teil.x},${teil.y} ${teil.w}x${teil.h} - auch bei ungenau getroffener Farbe`);

  // 3. Danach darf kein Magenta mehr im Bild sein - sonst leuchtet es unter jedem Motiv
  //    hervor, das die Flaeche nicht vollstaendig ausfuellt. Und das tut jedes freigestellte.
  const sauber = await magentaEntfernen(mitPlatz, teil);
  let restMagenta = false;
  try { await flaecheAusMagenta(sauber); restMagenta = true; } catch (e) { /* so soll es sein */ }
  pruefe('der Platzhalter ist danach restlos weg', !restMagenta, 'sonst leuchtet er unter jedem Motiv hervor');

  // 4. Ein rosa Produktfoto ist KEIN Platzhalter. Lieber ehrlich scheitern als danebenmessen.
  let verwechselt = false;
  try { await flaecheAusMagenta(await kasten(512, 512, { r: 200, g: 120, b: 180, alpha: 1 })); verwechselt = true; } catch (e) { /* richtig */ }
  pruefe('ein rosa Produktfoto wird nicht fuer einen Platzhalter gehalten', !verwechselt);
  // Kein Fehler, aber es muss sichtbar bleiben: diese Artikel zeigen dem Kunden nur das Motiv.
  console.log('  ' + grau(`· ${ohne.length} von ${ohne.length + mock.filter(m => Object.values(ARTIKEL).length).length ? ohne.length + Object.keys(ARTIKEL).filter(id => verkaufsfaehig(id) && ansichtVon(id)).length : 0} verkaufsfaehigen Artikeln ohne eigenes Mockup: ` + ohne.join(', ')));
  console.log('  ' + grau('  Sie zeigen "Nur das Motiv" - nie ein fremdes Teil. Mockups dafuer: offen.'));

  // Fassung 74: Auf dem Mockup muss ein kleines Motiv auch klein aussehen. Vorher wurde jedes
  // freistehende Motiv formatfuellend in die Druckflaeche gelegt - ein 10-cm-Brustprint sah aus
  // wie ein Frontprint ueber die ganze Brust, waehrend die Bemassung daneben 9,4 cm sagte.
  // Dafuer braucht jede Textilvorlage die Angabe, wofuer ihre Flaeche in echt steht.
  const ohneMass = Object.entries(MOCKUPS)
    .filter(([, g]) => !g.voll && !g.flaecheCm && g.sizes !== false)
    .map(([k]) => k);
  pruefe('jede Textilvorlage weiss, wie gross ihre Druckflaeche in echt ist', !ohneMass.length, ohneMass.join(', '));

  // Fassung 74: flaecheCm steht in mockups.js, die Masse stehen im Artikelkatalog. Zwei Quellen
  // fuer dieselbe Zahl laufen frueher oder spaeter auseinander - und dann steht eine falsche
  // Zentimeterzahl neben dem Motiv. Also nachrechnen, wo es eine Zuordnung gibt.
  const schief = [];
  for (const [id, a] of Object.entries(ARTIKEL)) {
    const an = ansichtVon(id);
    const g = an && MOCKUPS[an];
    if (!g || !Array.isArray(g.flaecheCm)) continue;
    const erste = Object.values(flaechenVon(id))[0];
    if (!erste) continue;
    if (erste.cm[0] !== g.flaecheCm[0] || erste.cm[1] !== g.flaecheCm[1]) {
      schief.push(`${a.name}: Katalog ${erste.cm.join('x')} cm, Vorlage ${g.flaecheCm.join('x')} cm`);
    }
  }
  pruefe('Vorlagenmass und Katalogmass sagen dasselbe', !schief.length, schief.join(' | '));

  // Fassung 78: Vorschaubilder gehen als AVIF oder WebP raus, wo der Browser es kann - nachge-
  // messen halb so schwer wie JPEG. Zwei Dinge koennen dabei still schiefgehen, und beide sind
  // mir beim Bauen genau so passiert:
  // 1. Ein Bildweg liefert direkt das JPEG aus und geht nicht durch sendBestesBild() - dann
  //    bleibt an dieser Stelle alles beim alten Gewicht, ohne dass etwas kaputt aussieht.
  // 2. Der Typ steht als "avif" statt "image/avif" - Express macht daraus
  //    application/octet-stream, und der Browser BIETET DAS BILD ZUM HERUNTERLADEN AN
  //    statt es anzuzeigen. Fiele erst im Betrieb auf.
  const serv = await fs.readFile('server.js', 'utf8');
  const wege = ['/api/mo/sample/:file', '/api/mo/style-sample/:slug/:style', '/api/mo/mockup/:designId/:garment/:file'];
  for (const w of wege) {
    const ab = serv.indexOf(`'${w}'`);
    // 27. Sept.: die Mockup-Route ist um die Personenwahl und die Artikelfassung gewachsen -
    // das Fenster reicht bis zur naechsten Route, nicht bis zu einer festen Zeichenzahl.
    const ende = ab < 0 ? -1 : serv.indexOf('\napp.', ab + 10);
    const block = ab < 0 ? '' : serv.slice(ab, ende > 0 ? ende : ab + 6000);
    pruefe(`${w} liefert das beste Bildformat`, ab >= 0 && block.includes('sendBestesBild'));
  }
  // 2. Okt., Markus ("Ja, auf hellem Shirt zeigen"): ein Design, das auf Schwarz zu dunkel ist,
  // wird beim Vorzeigen auf hellem Shirt gezeigt. Jede Vorzeige-Adresse geht durch anzeigeTextil -
  // wer showcaseImage mit dem rohen Textil des Auftrags aufruft, zeigt wieder Schwarz auf Schwarz.
  {
    const aufrufe = [...serv.matchAll(/showcaseImage\(([^)]*)\)/g)].map(m => m[1]).filter(x => !/^id, textile$/.test(x));
    const roh = aufrufe.filter(x => !/anzeigeTextil\(/.test(x) && !/j\.textile\)\.replace/.test(x) && !/^id, j\.textile$/.test(x));
    pruefe('Vorzeigen: jede Galerie-Adresse nimmt die lesbare Shirtfarbe (anzeigeTextil), Grenze 27 %',
      /const DUNKEL_GRENZE = 27;/.test(serv) && aufrufe.length >= 4 && roh.length === 0, roh.join(' | ') || aufrufe.length + ' Aufrufe');
  }
  // 2. Okt., Markus: "Wenn Weihnachtsmotiv drauf ist, dass es ne weihnachtliche Umgebung ist ...
  // ein Angler beim Angeln, jemand auf einer Bowlingbahn". Jede Szene hat ihren Bestellzettel, beide
  // Fotos liegen im Repo, die Flaeche sitzt auf der Brust (hochkant, im Bild, je Farbe fast gleich),
  // und die Mockup-Route fragt nach der Szene des Mottos.
  {
    const themen = Object.keys(SZENE_THEMEN).sort(), zettel = Object.keys(SZENEN_ZETTEL).sort();
    const kaputt = [];
    for (const t of themen) {
      const m = MO_MITGELIEFERT['tee-szene-thema-' + t];
      for (const f of ['white', 'black']) {
        const b = m && m.boxen && m.boxen[f];
        if (!b || !fsSync.existsSync(path.join('vorlagen-original', m.dateien[f]))) { kaputt.push(t + '/' + f + ' fehlt'); continue; }
        const v = b.h / b.w;
        if (b.x < 300 || b.x + b.w > 724 || b.y < 300 || b.y + b.h > 800 || b.w < 150 || v < 1.3 || v > 2.0) kaputt.push(t + '/' + f + ' ' + JSON.stringify(b));
      }
      const w = m && m.boxen && m.boxen.white, sw = m && m.boxen && m.boxen.black;
      if (w && sw && (Math.abs(w.x - sw.x) > 4 || Math.abs(w.w - sw.w) > 6 || Math.abs(w.h - sw.h) > 6)) kaputt.push(t + ': Weiss und Schwarz verschieden');
      if (!['frau', 'mann'].includes(SZENE_THEMEN[t].wer)) kaputt.push(t + ': wer fehlt');
    }
    pruefe('Szenen je Motto: 27 Szenen mit Bestellzettel, beide Farben da, Flaeche auf der Brust',
      themen.length >= 27 && themen.join(',') === zettel.join(',') && kaputt.length === 0, kaputt.join(' | ') || themen.length + ' Szenen');
    // 2. Okt., gemessen: Streifen 25 x 10 cm kam als rundes Emblem von 9-14 cm Breite, weil die erste
    // Zeile "portrait" sagte und der Zufall Raute/Kreis/Wappen zog. Nachher 24,5 und 24,1 cm breit.
    {
      const ziehungen = Array.from({ length: 60 }, () => pickVariationAb({}, { format: 'breit', styled: true }));
      const rundDabei = ziehungen.filter(v => /circular|diamond|shield|tall centered column/.test(v));
      const m = { slug: 'probe', prompt: 'Birthday T-shirt print, portrait.\nThe age, portrait of it.', fields: [] };
      const kopf = buildPrompt(m, {}, { format: 'breit' }).split('\n');
      const freiBlock = serv.slice(serv.indexOf('function freierDruckBlock'), serv.indexOf('function freierDruckBlock') + 2200);
      const formatAnBeiden = (serv.match(/buildPrompt\(motto, values, \{ seed: job\.id, fassung: job\.input\.fassung, format: formatFrei,/g) || []).length;
      pruefe('Freie Groesse: ein breites Mass (25 x 10) bestellt ein breites Band, nie ein rundes Emblem',
        formatAusMass(25, 10) === 'breit' && formatAusMass(28, 20) === 'quer' && formatAusMass(8, 8) === 'quadrat' && formatAusMass(30, 35) === 'hoch'
          && VARIETY_AB.layoutBreit.length >= 4 && rundDabei.length === 0
          && /WIDE HORIZONTAL BAND/.test(kopf[0]) && !/portrait/.test(kopf[0]) && /portrait of it/.test(kopf[1])
          && /THE ARTWORK FILLS THE WIDTH/.test(freiBlock) && /SQUARE/.test(freiBlock) && formatAnBeiden === 2,
        JSON.stringify({ rund: rundDabei.length, kopf: kopf[0], formatAnBeiden }));
    }
    // 2. Okt., Markus: "Jungs Name ist dann natuerlich kein rosa Zimmer ... Maedels Name, dann rosa
    // Zimmer". Der Babyname waehlt das Zimmer, er sperrt die Szene nie.
    {
      const rosa = MO_MITGELIEFERT['tee-szene-thema-geburt-baby-rosa'];
      const dateienDa = !!rosa && ['white', 'black'].every(f => fsSync.existsSync(path.join('vorlagen-original', rosa.dateien[f])));
      const t = SZENE_THEMEN['geburt-baby'] || {};
      const wf = serv.slice(serv.indexOf('async function werFuerMockup'), serv.indexOf('async function werFuerMockup') + 1400);
      pruefe('Szenen je Motto: Babyshirt - Maedchenname rosa Zimmer, sonst das helle Zimmer',
        dateienDa && t.nameFeld === 'babyname' && t.nachName && t.nachName.frau === 'geburt-baby-rosa' && !SZENE_THEMEN['geburt-baby-rosa']
          && /thema\.nameFeld/.test(wf) && /every\(w => w === 'frau'\)/.test(wf),
        JSON.stringify({ dateienDa, t }));
    }
    const ab = serv.indexOf("'/api/mo/mockup/:designId/:garment/:file'");
    // 4. Okt.: die Rechnung steht in mockupPlan (gemeinsam mit mockupLiegtDa), die Route ruft sie.
    const block = serv.slice(ab, serv.indexOf('\napp.', ab + 10)) + serv.slice(serv.indexOf('async function mockupPlan'), ab);
    pruefe('Szenen je Motto: die Mockup-Route waehlt die Szene des Mottos und gibt ihr einen eigenen Dateinamen',
      /szeneThemaFuer\(garment, color, szMotto, wer\)/.test(block) && /themaEndung\(thema, druck\)/.test(block) && /thema: thema \|\| undefined/.test(block)
        && /druck: druck \|\| undefined/.test(block) && /thema \+ '-ruecken'/.test(block));
    // 2. Okt., Markus: "Wir haben eine maximal Groesse von 38 cm mal 48 cm. Und das sieht so gross auf dem
    // Textil einfach auch doof aus und beim Abi-Shirt sind hinten die Namen drauf" - und: "nicht ins Textil
    // eingearbeitet, sondern einfach nur drauf geknallt". Kein "gross" mehr, Hoechstmass 38 x 48, der Ruecken
    // nimmt die Rueckseite des Designs, das Motiv traegt die Falten des Fotos.
    {
      const frei = serv.slice(serv.indexOf('const FREI_CM'), serv.indexOf('const FREI_CM') + 400);
      const seite = fsSync.readFileSync('motto-seite.js', 'utf8');
      const sfAbi = JSON.parse(fsSync.readFileSync('startseite/schaufenster.json', 'utf8')).designs.filter(e => (/^MO-ABI-/.test(e.id || '') || e.vorzeige === 'abi') && e.druck === 'ruecken');
      // Schattierung am bekannten Fall: eine Vorlage mit dunklem Streifen macht das Motiv dort dunkler.
      const sharpM = (await import('sharp')).default;
      const vorlage = await sharpM({ create: { width: 40, height: 20, channels: 3, background: '#e6e6e6' } }).composite([{ input: await sharpM({ create: { width: 10, height: 20, channels: 3, background: '#808080' } }).png().toBuffer(), left: 20, top: 0 }]).png().toBuffer();
      const motiv = await sharpM({ create: { width: 40, height: 20, channels: 4, background: { r: 200, g: 40, b: 40, alpha: 1 } } }).png().toBuffer();
      const roh = await sharpM(await stoffSchatten(motiv, vorlage, 0, 0)).raw().toBuffer();
      const hell = roh[(10 * 40 + 5) * 4], dunkel = roh[(10 * 40 + 25) * 4];
      const route = serv.slice(serv.indexOf("'/api/mo/mockup/:designId/:garment/:file'"), serv.indexOf("'/api/mo/mockup/:designId/:garment/:file'") + 9000);
      pruefe('Textil: Hoechstmass 38 x 48 cm, Schaufenster nur mit den Massen des Groessen-Schritts, Ruecken mit Rueckseite, Motiv mit den Falten des Fotos',
        /maxBreite: 38, maxHoehe: 48/.test(frei) && /id="v_breite" min="3" max="38"/.test(seite) && /id="v_hoehe" min="3" max="48"/.test(seite)
          && DRUCK_ARTEN.join(',') === 'brust-klein,brust,streifen,brust-gross,ruecken,ruecken-max' && sfAbi.length === 0
          && /druck === 'ruecken' \? await backMaster\(designId\)/.test(route) && themaEndung('abi', '') === '_thema-abi-mass'
          && dunkel < hell - 40,
        JSON.stringify({ hell, dunkel }));
    }
    // 2. Okt., Markus zum Abi-Ruecken: "nicht in den Stoff eingearbeitet", "eine richtige Platte da drauf",
    // "nicht in Hoechstmass". Vier Dinge, je am bekannten Fall:
    // - Massstab je Szene aus der gemessenen Shirtbreite (53 cm), nicht aus der alten Flaeche;
    // - gedruckt nur auf Stoff (weisse und schwarze Fassung unterscheiden sich), nie auf dem Arm;
    // - Rauschen unter Alpha 16 bleibt leer (sonst graue Punktflaeche hinter den Namen);
    // - jede Szene hat in der Druckflaeche Stoff statt der glatten Ersatzflaeche (werkzeug/falten-einsetzen.mjs);
    // - der Abi-Ruecken bestellt keinen geschlossenen Rahmen.
    {
      const sharpM = (await import('sharp')).default;
      const { ersatzSichtbar } = await import('./werkzeug/falten-einsetzen.mjs');
      const tmp = fsSync.mkdtempSync(path.join(os.tmpdir(), 'stoff-'));
      const weiss = await sharpM({ create: { width: 60, height: 60, channels: 3, background: '#203040' } }).composite([{ input: await sharpM({ create: { width: 30, height: 60, channels: 3, background: '#f0f0f0' } }).png().toBuffer(), left: 0, top: 0 }]).png().toBuffer();
      const schwarz = await sharpM({ create: { width: 60, height: 60, channels: 3, background: '#203040' } }).composite([{ input: await sharpM({ create: { width: 30, height: 60, channels: 3, background: '#151515' } }).png().toBuffer(), left: 0, top: 0 }]).png().toBuffer();
      fsSync.writeFileSync(path.join(tmp, 'probe_white.png'), weiss); fsSync.writeFileSync(path.join(tmp, 'probe_black.png'), schwarz);
      const motiv = await sharpM({ create: { width: 40, height: 20, channels: 4, background: { r: 200, g: 40, b: 40, alpha: 1 } } }).png().toBuffer();
      const maske = await stoffMaske(tmp, 'probe', 10, 20, motiv);
      const mr = maske ? await sharpM(maske).raw().toBuffer() : null;
      const aufStoff = mr ? mr[(10 * 40 + 5) * 4 + 3] : -1, aufArm = mr ? mr[(10 * 40 + 35) * 4 + 3] : -1;
      const rauschen = await sharpM({ create: { width: 20, height: 20, channels: 4, background: { r: 20, g: 20, b: 20, alpha: 10 / 255 } } }).png().toBuffer();
      const vorlage = await sharpM({ create: { width: 20, height: 20, channels: 3, background: '#e6e6e6' } }).png().toBuffer();
      const rr = await sharpM(await stoffSchatten(rauschen, vorlage, 0, 0)).raw().toBuffer();
      let rest = 0; for (let i = 3; i < rr.length; i += 4) rest = Math.max(rest, rr[i]);
      const flach = [];
      for (const [k, v] of Object.entries(MO_MITGELIEFERT)) if (/-szene-thema-/.test(k) && v.boxen) for (const f of ['white', 'black']) {
        // Grober Waechter: eine sichtbare Ersatzflaeche hat eine Tonkante. Nach dem Einsetzen gemessen 0,9-10,1
        // (der Rest sind Koerperschatten am Rand, am Kontaktbogen angesehen); das Auge war die Abnahme.
        const st = await ersatzSichtbar(fsSync.readFileSync(path.join('vorlagen-original', v.dateien[f])), v.boxen[f]);
        if (st.sprung > 12) flach.push(k + '/' + f + ' Sprung ' + st.sprung.toFixed(1));
      }
      const seedAbi = JSON.parse(fsSync.readFileSync('seed.json', 'utf8')).find(m => m.slug === 'abi');
      // Woelbung am bekannten Fall: 200 px Bogen auf r = 100 -> 2 * 100 * sin(1) = 168 px, an den Raendern 46 px
      // weiter weg (1200 / 1246) -> 162 px breit; die Mitte bleibt
      // auf der Achse; die unterste Zeile (unter der Augenhoehe) steigt zu den Seiten hin.
      const wq = Buffer.alloc(200 * 100 * 4, 255);
      const wo = rueckenWoelben(wq, 200, 100, { top: 0, ax: () => 300, r: 100, hor: 0 });
      const deck = (x, y) => wo.data[((y - wo.top) * wo.width + (x - wo.left)) * 4 + 3] > 127;
      let wl = 999, wr = -1; for (let x = wo.left; x < wo.left + wo.width; x++) if (deck(x, 50)) { wl = Math.min(wl, x); wr = Math.max(wr, x); }
      const unterste = (x) => { for (let y = wo.top + wo.height - 1; y >= wo.top; y--) if (deck(x, y)) return y; return -1; };
      const woelbOk = RUECKEN_VERSATZ_CM === 2 && Math.abs((wr - wl + 1) - 162) <= 2 && Math.abs((wl + wr) / 2 - 300) <= 1 && unterste(300) > unterste(wl + 2)
        && Object.values(SZENE_RUECKEN).every(v => v.halbe > 120 && v.halbe < 180) && Math.abs(rueckenRadius(155) - 160.5) < 0.5;
      pruefe('Szene: Massstab je Shirt, Druck nur auf Stoff, kein Rauschen, Falten in jeder Druckflaeche, Abi-Ruecken ohne Rahmen, Ruecken gewoelbt',
        Math.abs(szeneMassstab('tee-szene-thema-abi-ruecken_white', { w: 186 }) - 315 / SHIRT_CM) < 0.01
          // Ruecken (Markus: "ueber die Breite des Rueckens ... schon auf dem Aermel"): je Ruecken-Szene Kragen,
          // Laenge, Rumpfmitte und Rumpfbreite vermessen, 38 cm hoechstens 85 % des Rumpfs.
          && Object.keys(MO_MITGELIEFERT).filter(k => MO_MITGELIEFERT[k].ruecken).every(k => SZENE_RUECKEN[k] && SZENE_RUMPF_MITTE[k] && Array.isArray(SZENE_RUECKEN_ACHSE[k]) && SZENE_RUECKEN_ACHSE[k].length >= 3 && SZENE_RUECKEN_ACHSE[k][0][0] === SZENE_RUECKEN[k].kragen && SZENE_SHIRT_PX[k] > 250 && SZENE_SHIRT_PX[k] < 360)
          && aufStoff === 255 && aufArm === 0 && rest === 0 && flach.length === 0 && woelbOk
          && /NO FRAME, NO BOX, NO PLATE/.test(seedAbi.backPrompt) && !/two narrow vertical borders run down the sides/.test(seedAbi.backPrompt)
          && /Abi-Ruecken: Auftrag ohne geschlossenen Rahmen/.test(serv),
        JSON.stringify({ aufStoff, aufArm, rest, woelbBreite: wr - wl + 1 }) + (flach.length ? ' flach: ' + flach.join(' | ') : ''));
      fsSync.rmSync(tmp, { recursive: true, force: true });
    }
    // 2. Okt., Markus: "warum immer ein T-Shirt und immer die gleiche Groesse ... mal Hoodie, mal klein,
    // mal gross, mal was auf dem Ruecken". Hoodie- und Ruecken-Szenen mit Datei und Flaeche, Hochzeit
    // als Braeutigam (der Gast im Shirt zwischen Anzuegen war "unpassend").
    {
      const fehlt = [];
      const extra = Object.entries(MO_MITGELIEFERT).filter(([k, v]) => k.startsWith('hoodie-szene-thema-') || (k.startsWith('tee-szene-thema-') && v.ruecken));
      for (const [k, v] of extra) for (const f of ['white', 'black']) {
        if (!v.boxen || !v.boxen[f] || !fsSync.existsSync(path.join('vorlagen-original', v.dateien[f]))) fehlt.push(k + '/' + f);
      }
      const rueckenOhneVariante = extra.filter(([k, v]) => v.ruecken && !v.variante).map(([k]) => k);
      const sf = JSON.parse(fsSync.readFileSync('startseite/schaufenster.json', 'utf8')).designs;
      const arten = new Set(sf.map(e => (e.teil || 'tee') + ':' + (e.druck || '')));
      const sfBlock = serv.slice(serv.indexOf('async function schaufensterHtml'), serv.indexOf('async function schaufensterHtml') + 6000);
      const hz = MO_MITGELIEFERT['tee-szene-thema-hochzeit'];
      pruefe('Schaufenster: Hoodie und T-Shirt, klein, gross und Ruecken - mit Szenen dafuer',
        extra.length >= 8 && fehlt.length === 0 && rueckenOhneVariante.length === 0 && !SZENE_THEMEN['abi-ruecken']
          && sf.some(e => e.teil === 'hoodie') && new Set(sf.map(e => e.druck).filter(Boolean)).size >= 4 && sf.every(e => !e.druck || DRUCK_ARTEN.includes(e.druck)) && arten.size >= 6
          && /eintrag\.teil/.test(sfBlock) && /eintrag\.druck/.test(sfBlock) && /&druck=/.test(sfBlock)
          && hz.wer === 'mann' && SZENEN_ZETTEL.hochzeit.wer === 'mann' && /groom/.test(szeneThemaAuftrag('hochzeit'))
          && /back to the camera/.test(szeneThemaAuftrag('abi', { ruecken: true })) && /hoodie/.test(szeneThemaAuftrag('abi', { teil: 'hoodie' })),
        fehlt.join(' | ') || JSON.stringify([...arten]));
    }
  }
  // 3. Okt. (Markus: "Warum sind die eigentlich noch nicht ausgetauscht?"): das Schaufenster zeigt auf
  // Designs im Repo (vorzeige-designs.json "schaufenster", Bild unter startseite/schaufenster/), angelegt
  // beim Start als Platz <stil>#schaufenster - kein Stilbeispiel, aber freigegeben im Pool.
  {
    const sfL = JSON.parse(fsSync.readFileSync('startseite/schaufenster.json', 'utf8')).designs;
    const man = JSON.parse(fsSync.readFileSync('vorzeige-designs.json', 'utf8')).mottos;
    const vz = fsSync.readFileSync('vorzeige.js', 'utf8');
    const kaputt = [];
    for (const e of sfL) {
      if (e.id) continue;
      const m = man[e.vorzeige] && man[e.vorzeige].schaufenster;
      if (!m || m.style !== e.stil || !fsSync.existsSync(m.datei) || !/^startseite\/schaufenster\/[a-z0-9-]+\.webp$/.test(m.datei) || !m.values || !Object.keys(m.values).length) { kaputt.push(e.vorzeige); continue; }
      const meta = await (await import('sharp')).default(m.datei).metadata();
      if (!meta.hasAlpha || meta.width < 1000) kaputt.push(e.vorzeige + ' (Bild ' + meta.width + ', Alpha ' + meta.hasAlpha + ')');
    }
    const sfBlock2 = serv.slice(serv.indexOf('async function schaufensterHtml'), serv.indexOf('async function schaufensterHtml') + 4000);
    // 9. Okt.: 12 neue Designs (13 von 16 fielen durch Brett/Sichtbarkeit) - mindestens 12, keins doppelt
    pruefe('Schaufenster: mindestens 12 Eintraege, jeder zeigt auf ein Design im Repo (Bild mit Alpha, Werte, Stil) oder eine Nummer; Platz #schaufenster nicht in der Stil-Galerie',
      sfL.length >= 12 && kaputt.length === 0 && new Set(sfL.map(e => e.id || e.vorzeige)).size === sfL.length
        && /'#schaufenster'/.test(sfBlock2) && /!style\.includes\('#'\)/.test(vz) && /SCHAU = '#schaufenster'/.test(vz) && /split\(\/\[@#\]\/\)/.test(serv),
      kaputt.join(' | ') || String(sfL.length));
  }
  // 4. Okt., Markus: "so grosse Flaechen komplett gedruckt" - "Die muessen Unterbrechung haben. Das Ganze
  // fuehlt sich sonst an wie ein Brett." Messung am bekannten Fall (Schaufenster-Bilder im Repo) und an zwei
  // gebauten Proben; dazu, dass Band, Bewertung und Schaufenster ein Brett weglassen.
  {
    const { vollDeckend, PLACKEN_GRENZE } = await import('./brett.js');
    const sh = (await import('sharp')).default;
    const w = {};
    for (const n of ['hochzeit', 'abi', 'karneval', 'sprueche-shirt']) w[n] = await vollDeckend(fsSync.readFileSync('startseite/schaufenster/' + n + '.webp'));
    const block = await sh({ create: { width: 800, height: 1000, channels: 4, background: { r: 200, g: 30, b: 30, alpha: 1 } } }).png().toBuffer();
    const gitter = await sh({ create: { width: 800, height: 1000, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite(Array.from({ length: 40 }, (_, i) => ({ input: { create: { width: 12, height: 1000, channels: 4, background: { r: 200, g: 30, b: 30, alpha: 1 } } }, left: i * 20, top: 0 }))).png().toBuffer();
    w.block = await vollDeckend(block); w.streifen = await vollDeckend(gitter);
    const scBlock = serv.slice(serv.indexOf("app.get('/api/mo/showcase'"), serv.indexOf("app.get('/api/mo/showcase'") + 4000);
    pruefe(`Bretter: voll deckende Flaeche gemessen (Block ${w.block}, Streifen ${w.streifen}, Hochzeit ${w.hochzeit}, Abi ${w.abi}, Karneval ${w.karneval}, Sprueche ${w.sprueche_shirt || w['sprueche-shirt']}), Grenze ${PLACKEN_GRENZE}, Band/Bewertung/Schaufenster lassen Bretter weg, gemessen wird nur, was auf der Platte liegt`,
      w.block === 100 && w.streifen < 10 && w.hochzeit > PLACKEN_GRENZE && w.abi < PLACKEN_GRENZE && w.karneval < PLACKEN_GRENZE && w['sprueche-shirt'] < 10
        && /istBrett\(e\) && !e\.artikel/.test(scBlock) && /if \(istBrett\(e\)\)/.test(serv) && /fs\.readFile\(path\.join\(STORE, 'masters'/.test(serv.slice(serv.indexOf('async function plackenNachtragen'), serv.indexOf('async function plackenNachtragen') + 900)),
      JSON.stringify(w));
  }
  // 4. Okt., Markus (Meister-Shirt): "Andere Sportart - welche?" war eine eigene Seite. Ein <feld>_frei gilt nur
  // bei "Andere ..." in seiner Auswahl - beim Speichern und beim Ausliefern.
  {
    const mo = await import('./mottos.js');
    const f = mo.freiBedingung([{ key: 'sportart', type: 'select', options: ['Fußball', 'Andere Sportart'] }, { key: 'sportart_frei', type: 'text' }, { key: 'ort_frei', type: 'text' }]);
    pruefe('Freitext "Andere ...": gilt nur, wenn die Auswahl darueber "Andere ..." steht; ohne passende Auswahl bleibt das Feld unveraendert',
      JSON.stringify(f[1].zeigeWenn) === JSON.stringify({ sportart: ['Andere Sportart'] }) && !f[2].zeigeWenn && /fields: freiBedingung\(m\.fields\)/.test(fsSync.readFileSync('mottos.js', 'utf8')),
      JSON.stringify(f.map(x => x.zeigeWenn || null)));
    pruefe('Listenwort: Meister-Shirt = Kaderliste, Vereinsjubilaeum = Mitgliederliste, Firmenausflug = Mitarbeiterliste',
      mo.listeWortFuer({ slug: 'meister-shirt', name: 'Meister & Aufsteiger' }) === 'Kaderliste' && mo.listeWortFuer({ slug: 'vereinsjubilaeum', name: 'Vereinsjubiläum' }) === 'Mitgliederliste'
        && mo.listeWortFuer({ slug: 'firmenausflug', name: 'Firmenausflug' }) === 'Mitarbeiterliste');
  }
  // 4. Okt., Markus (Haustier-Szene): "sollte der Hund daneben wenigstens der gleiche Hund sein". Bekannter Fall:
  // ein Bilddienst-Ersatz malt alles rot - nur das Loch neben der Frau darf rot werden, der Rest bleibt pixelgleich.
  {
    const ts = await import('./tier-szene.js');
    const sh = (await import('sharp')).default;
    const szene = fsSync.readFileSync('vorlagen-original/tee-szene-thema-tier-shirt_white.jpg');
    let auftrag = null;
    const fertig = await ts.tierSzeneBauen({ szene, master: await sh({ create: { width: 600, height: 800, channels: 4, background: { r: 30, g: 30, b: 30, alpha: 1 } } }).png().toBuffer(),
      edit: async (a) => { auftrag = a; return { png: await sh({ create: { width: 1024, height: 1024, channels: 3, background: { r: 255, g: 0, b: 0 } } }).png().toBuffer() }; } });
    const a = await sh(szene).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const b = await sh(fertig).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const L = ts.TIER_LOCH, W = a.info.width, px = (d, x, y) => [0, 1, 2].map(c => d[(y * W + x) * 3 + c]);
    let aussen = 0, n = 0;
    for (let y = 0; y < 1024; y += 7) for (let x = 0; x < 1024; x += 7) {
      if (x > L.x - 24 && x < L.x + L.w + 24 && y > L.y - 24 && y < L.y + L.h + 24) continue;
      n++; const p = px(a.data, x, y), q = px(b.data, x, y); if (Math.max(...p.map((v, i) => Math.abs(v - q[i]))) > 3) aussen++;
    }
    const mitte = px(b.data, L.x + (L.w >> 1), L.y + (L.h >> 1));
    const leer = ['white', 'black'].map(c => fsSync.existsSync(ts.leerDatei(c)));
    const mk = fsSync.readFileSync('mockups.js', 'utf8');
    pruefe(`Haustier-Szene: nur das Loch neben der Frau kommt vom Bilddienst (aussen ${aussen} von ${n} Punkten veraendert, Mitte rgb(${mitte})), Druckdatei als Vorlage, Szene ohne Tier liegt da, Server baut je Design im Hintergrund`,
      aussen === 0 && mitte[0] > 200 && mitte[1] < 60 && auftrag && auftrag.prompt === ts.TIER_AUFTRAG && auftrag.referenceImagesBase64.length === 1 && leer.every(Boolean)
        && /if \(szene && opts\.szeneVorlage\)/.test(mk) && /thema === TIER_MOTTO && garment === 'tee'/.test(serv) && /async function tierSzeneFuer/.test(serv) && /TIER_BAU\.set\(k, Date\.now\(\)\)/.test(serv),
      JSON.stringify({ aussen, n, mitte, leer }));
  }
  // 4. Okt., Markus: "wenn die Leute ... sich den Link zuschicken lassen und mit dem Link dann auch wieder sofort auf die
  // gleiche Stelle zurueckkommen und da weitermachen - sonst brechen ganz viele Leute ab". Nachgestellt vorher: im selben
  // Browser stand die Seite wieder auf Frage 1, in einem anderen kamen 2 von 11 Eingaben an. Der ganze Weg im Browser,
  // Link im ANDEREN Browser geoeffnet, mit Foto.
  {
    const { execFileSync } = await import('node:child_process');
    let out = '';
    try { out = execFileSync(process.execPath, ['werkzeug/probe-anmelden.mjs', 'hochzeit', 'anderer', 'mitfoto'], { encoding: 'utf8', timeout: 240000 }); }
    catch (e) { out = String((e && e.stdout) || '') + String((e && e.message) || e); }
    let r = null; try { r = JSON.parse((out.match(/ERGEBNIS (.*)/) || [])[1] || 'null'); } catch (e) { r = null; }
    pruefe('Anmelden mitten im Motto: der Link (in einem ANDEREN Browser geoeffnet) fuehrt auf dieselbe Seite zurueck, alle Eingaben und das Foto sind da, die Seite steht am Ende und der Auftrag startet von selbst',
      !!r && r.schritt === 'Alles klar?' && r.fehlen.length === 0 && r.mitFoto && r.start.length === 1 && /^200 /.test(r.start[0]) && r.url === '/m/hochzeit',
      r ? JSON.stringify(r).slice(0, 400) : out.slice(-400));
  }
  // 4. Okt., Markus (Bild: Strandtuch-Design auf Hoodie und Polo im Band): die gespeicherte Design-Datei traegt den Artikel
  // OBEN (artikel); wer input.artikel liest, haelt jedes Artikel-Design fuer ein Shirt-Design.
  {
    const band = serv.slice(serv.indexOf("app.get('/api/mo/showcase'"), serv.indexOf("app.post('/api/mo/rate'"));
    const plan = serv.slice(serv.indexOf('async function mockupPlan'), serv.indexOf("app.get('/api/mo/mockup/:designId"));
    pruefe('Artikel eines gespeicherten Designs: Band, Mockup und Artikel-Kacheln lesen artikelVon (oben ODER input), ein Strandtuch-Design nur auf dem Strandtuch, ein Artikel ohne Vorlage nie auf einem Shirt',
      /function artikelVon\(j\) \{ return \(j && \(j\.artikel \|\| \(j\.input && j\.input\.artikel\)\)\)/.test(serv) && /artikelVon\(j\)/.test(band) && /e\.artikelV = 2/.test(band) && /x\.artikel !== '-'/.test(band)
        && /artikelVon\(jobT\)/.test(plan) && !/j && j\.input && j\.input\.artikel/.test(serv));
  }
  // 4. Okt., Markus: "den Anteil an schwarzen Textilien auf nur noch 20 % begrenzen ... gerne mal was schoen gelbes, zart gruenes,
  // zart blau, so dass es zum Design hervorragend passt, und natuerlich auch rot" - "Farben nehmen wir das, was alles zur
  // Verfuegung steht und das gut aussieht".
  {
    const mk = await import('./mockups.js');
    const br = await import('./brett.js');
    const sh = (await import('sharp')).default;
    const tx = await import('./textilien.js');
    const os = await import('node:os');
    // Bekannter Fall Einfaerben: grauer Grund, in der Mitte ein "Shirt" - weiss bzw. schwarz. Grund bleibt, Shirt wird rot.
    const dir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'farbe-'));
    const bild = (stoff, f) => sh({ create: { width: 200, height: 200, channels: 3, background: { r: 200, g: 200, b: 200 } } }).composite([{ input: { create: { width: 100, height: 120, channels: 3, background: stoff } }, left: 50, top: 40 }]).png().toFile(f);
    await bild({ r: 245, g: 245, b: 245 }, path.join(dir, 'probe_white.png'));
    await bild({ r: 20, g: 20, b: 20 }, path.join(dir, 'probe_black.png'));
    const fm = await mk.faerbMaske(dir, 'probe');
    const rot = fm ? await sh(await mk.einfaerben(fsSync.readFileSync(path.join(dir, 'probe_white.png')), fm, mk.TEXTIL_FARBEN.rot.hex)).raw().toBuffer() : null;
    const px = (x, y) => rot ? [...rot.slice((y * 200 + x) * 3, (y * 200 + x) * 3 + 3)] : [];
    // zwei verschiedene Fotos (Stoff verschoben) -> Uebergangszone gross -> keine Farbe
    // zwei verschiedene Fotos: anderes Licht im ganzen Bild (Grund 170 statt 200) - die Uebergangszone ist gross
    await sh({ create: { width: 200, height: 200, channels: 3, background: { r: 170, g: 170, b: 170 } } }).composite([{ input: { create: { width: 100, height: 120, channels: 3, background: { r: 20, g: 20, b: 20 } } }, left: 80, top: 40 }]).png().toFile(path.join(dir, 'schief_black.png'));
    fsSync.copyFileSync(path.join(dir, 'probe_white.png'), path.join(dir, 'schief_white.png'));
    const schief = await mk.faerbMaske(dir, 'schief');
    const namenDa = Object.values(mk.TEXTIL_FARBEN).every(f => tx.BC_E190_FARBEN.includes(f.name.tee) && (f.name.polo === undefined || f.name.polo === 'Blush Mint' || f.name.polo === 'Blush Blue' || f.name.polo === 'Dark Forest' || f.name.polo === f.name.tee));
    pruefe(`Farbiges Textil: Grund bleibt (${px(10, 10)}), Stoff wird rot (${px(100, 100)}), zwei verschiedene Fotos werden nicht eingefaerbt; jede Farbe fuehrt B&C fuer T-Shirt und Polo`,
      !!fm && px(10, 10).join() === '200,200,200' && px(100, 100)[0] > 150 && px(100, 100)[1] < 60 && schief === null && namenDa && mk.FARB_TEILE.join() === 'tee,polo');
    // Bekannter Fall Farbwahl (am Bild geeicht): Abinauten auf Rot lesbar, auf Royalblau nicht; weisse Sprueche-Schrift nie auf Gelb/Mint/Hellblau.
    const hex = Object.fromEntries(Object.entries(mk.TEXTIL_FARBEN).map(([k, f]) => [k, f.hex]));
    const abi = await br.farbWerte(fsSync.readFileSync('startseite/schaufenster/abi.webp'), hex);
    const spr = await br.farbWerte(fsSync.readFileSync('startseite/schaufenster/sprueche-shirt.webp'), hex);
    const sprWahl = br.besteFarbe(spr, hex) || [];
    // 5. Okt., Markus: "bei Rot kann nur einfarbig weiss drauf mit ein bisschen schwarz" - das bunte Abinauten-Motiv ist auf Rot zwar
    // lesbar (13 %), bekommt Rot aber nicht mehr (brett.js NUR_WEISS).
    pruefe(`Farbe passend zum Design: Abinauten Rot ${abi.werte.rot} % / Royal ${abi.werte.royal} % schwer sichtbar, aber bunt -> nie Rot; Sprueche (weisse Schrift) Gelb ${spr.werte.gelb} %, Wahl ${sprWahl.join(',')}; Grenze ${br.FARB_GRENZE} %`,
      abi.werte.rot <= br.FARB_GRENZE && abi.werte.royal > br.FARB_GRENZE && !(br.besteFarbe(abi, hex) || []).includes('rot') && !(br.besteFarbe(abi, hex) || []).includes('royal') && !sprWahl.some(k => mk.TEXTIL_FARBEN[k].hell) && sprWahl.length > 0);
    const band = serv.slice(serv.indexOf("app.get('/api/mo/showcase'"), serv.indexOf("app.post('/api/mo/rate'"));
    pruefe('Band: Schwarz hoechstens 10 % der GEZEIGTEN Textil-Bilder, sonst die passende Farbe oder gar nicht; Farbe nur, wo die Vorlage sauber faerbt; das Band findet seine Bilder ueber dieselbe Rechnung wie die Route (mockupPlan)',
      /\(schwarzN \+ 1\) > 0\.1 \* \(fertige\.length \+ 1\)/.test(band) && /besteFarbe\(/.test(band) && /faerbMaske\(/.test(band)
        && /async function mockupLiegtDa[\s\S]{0,300}mockupPlan\(/.test(serv) && /farbe \? '_f-' \+ farbe/.test(serv)
        && /color === 'white' && print === 'hell' && !farbe \? 'multiply' : 'over'/.test(fsSync.readFileSync('mockups.js', 'utf8')));
  }
  // 4. Okt., Markus: "Natuerlich sollen die auch bestellbar sein" - die Farben aus dem Band stehen auf der Ergebnisseite bei
  // T-Shirt und Polo, gemessen an der Druckdatei DIESES Designs, und die Anfrage traegt die Farbe.
  {
    const mk = await import('./mockups.js');
    const br = await import('./brett.js');
    await mk.ensureTemplates('./storage');
    const quelle = serv.slice(serv.indexOf('async function bestellFarben'), serv.indexOf('\n}\n', serv.indexOf('async function bestellFarben')) + 2);
    const hex = Object.fromEntries(Object.entries(mk.TEXTIL_FARBEN).map(([k, f]) => [k, f.hex]));
    const bau = (master) => new Function('LINIE_STANDARD', 'faerbMaske', 'path', 'STORE', 'farbWerte', 'masterLesen', 'FARB_HEX', 'besteFarbe', 'TEXTIL_FARBEN', quelle + '\nreturn bestellFarben;')(
      mk.LINIE_STANDARD, mk.faerbMaske, path, './storage', br.farbWerte, async () => master, hex, br.besteFarbe, mk.TEXTIL_FARBEN);
    const abiWahl = await bau(fsSync.readFileSync('startseite/schaufenster/abi.webp'))('MO-PROBE', 'tee');
    const sprWahlB = await bau(fsSync.readFileSync('startseite/schaufenster/sprueche-shirt.webp'))('MO-PROBE', 'tee');
    const kaputt = await bau(null)('MO-PROBE', 'tee');
    const fertig = serv.slice(serv.indexOf('job.mockups = {};'), serv.indexOf("job.status = 'done';", serv.indexOf('job.mockups = {};')));
    const kf = fsSync.readFileSync('kaufformen.js', 'utf8'), seite = fsSync.readFileSync('motto-seite.js', 'utf8');
    pruefe(`Bestellbare Farben: Sprueche-T-Shirt bekommt ${sprWahlB.join(', ')}, Abinauten ${abiWahl.join(', ') || 'keine'} (gemessen an der Druckdatei; der Kunde waehlt frei: alles Sichtbare, Rot dabei, kein unlesbares Royalblau); ohne Druckdatei keine Farbe statt Fehler; die Anfrage nennt die Farbe mit B&C-Namen`,
      sprWahlB.length > 0 && abiWahl.includes('rot') && !abiWahl.includes('royal') && Array.isArray(kaputt) && kaputt.length === 0
        && /bestellFarben\(designId, g\)/.test(fertig) && /\['f-' \+ k\]/.test(fertig) && /farbe: farbe \|\| null, farbeName/.test(kf) && /\['Textilfarbe', farbeName/.test(kf)
        && /farbe: \$\('kf-garment'\)\.value === shown\.tab/.test(seite) && /kfStufe !== 'deluxe'/.test(seite));
    const { execFileSync } = await import('node:child_process');
    let out = '';
    try { out = execFileSync(process.execPath, ['werkzeug/probe-farbwahl.mjs'], { encoding: 'utf8', timeout: 180000 }); }
    catch (e) { out = String((e && e.stdout) || '') + String((e && e.message) || e); }
    let r = null; try { r = JSON.parse((out.match(/ERGEBNIS (.*)/) || [])[1] || 'null'); } catch (e) { r = null; }
    pruefe('Farbwahl im Browser (iPhone): Rot und Gelb neben Schwarz und Weiss, ein Tipp zeigt das T-Shirt in Rot und die Zeile nennt "Rot", der Hoodie ohne Farben faellt auf Weiss zurueck, die Anfrage traegt Gelb',
      !!r && !r.fehler && (r.knoepfe || []).join() === 'Schwarz,Weiß,Rot,Gelb' && /\/tee\/white\.jpg.*farbe=rot/.test(r.bild || '') && /T-Shirt · Rot · Größe/.test(r.meta || '')
        && (r.hoodie || []).join() === 'black,white*' && !!r.anfrage && r.anfrage.garment === 'tee' && r.anfrage.farbe === 'gelb',
      r ? JSON.stringify(r).slice(0, 400) : out.slice(-400));
  }
  // 6. Okt., Markus: "bitte den zahlungsweg auf der seite ueberpruefen" - "ja alles machen". Gemessen vorher: "auf Anfrage" auf der
  // Karte trotz offener Kasse, Kaufknopf 6 Bildschirme tief, nur ein Teil je Kasse, Flachware nur als Anfrage, 1-€-Versprechen ohne Umsetzung.
  {
    const { execFileSync } = await import('node:child_process');
    let out = '';
    try { out = execFileSync(process.execPath, ['werkzeug/probe-kasse.mjs'], { encoding: 'utf8', timeout: 240000 }); }
    catch (e) { out = String((e && e.stdout) || '') + String((e && e.message) || e); }
    let r = null; try { r = JSON.parse((out.match(/ERGEBNIS (.*)/) || [])[1] || 'null'); } catch (e) { r = null; }
    const sv = r && r.server;
    pruefe('Kasse (Server): Warenkorb Shirt-Liste + Hoodie Deluxe mit Rueckseite + Kissen, Staffel ueber alle Textilien (8 %), 3 € bezahlte Entwuerfe als Nachlass, Textil ohne Groesse 400, Bestellung als bezahlt gemerkt und Guthaben genau einmal abgebucht',
      !!sv && sv.status === 200 && sv.gesamt === 261.55 && sv.nachlass === 3 && sv.zeilen.length === 4 && /22\.91$/.test(sv.zeilen[0]) && /64\.61$/.test(sv.zeilen[2])
        && sv.ohneGroesse === 400 && sv.vorher === 'offen' && sv.nachher === 'bezahlt #1001' && sv.guthaben === 0,
      sv ? JSON.stringify(sv).slice(0, 400) : out.slice(-400));
    for (const g of ['iphone', 'laptop']) {
      const x = r && r[g];
      pruefe(`Kaufweg im Browser (${g}): Preis "ab 19,90 €" auf der Karte, "Fertig bedruckt" (keine Druckdatei allein), Bestellleiste unten im Fenster, nach dem Tipp der Kassenknopf im Fenster, Groesse nur im Kaufkasten, Kissen ohne Groesse/Stufe zur Kasse, Korb 3 Shirts + Kissen, Rueckweg offen/bezahlt, Bestellseite 200`,
        !!x && !x.fehler && /^ab 19,90/.test(x.karte) && /^Fertig bedruckt/.test(x.kopf) && x.leiste && x.leiste.unten <= x.fenster && x.leiste.oben < x.fenster
          && x.kassenknopf && x.kassenknopf.unten <= x.fenster && !x.groesseAmBild && /^Weiter zur Kasse · 29,80/.test(x.knopf)
          && (x.felder || []).join('|') === 'Für welches Produkt?|Größe|Menge|E-Mail (für die Bestellbestätigung)'
          && x.kissen && !x.kissen.groesse && !x.kissen.stufen && /99,60/.test(x.kissen.knopf) && (x.posten || []).join() === '3x tee L,1x kissen' && x.zurKasse
          && /noch nicht bezahlt/.test(x.hinweisOffen) && /Bezahlt.*#1001/.test(x.hinweisBezahlt) && x.bestellseite === 200,
        x ? JSON.stringify(x).slice(0, 500) : out.slice(-400));
    }
  }
  // 4. Okt., Markus: "Wenn schon dein Freestyle" - der Name, nicht die Felder.
  {
    const seedFs = JSON.parse(fsSync.readFileSync('seed.json', 'utf8')).find(m => m.slug === 'freestyle');
    const datei = JSON.parse(fsSync.readFileSync('freestyle/motto-freestyle.json', 'utf8'));
    const seiten = ['home-neu.html', 'home.html'].map(f => fsSync.readFileSync(f, 'utf8'));
    pruefe('Freestyle heisst "Dein Freestyle" (Saat, Motto-Datei, Startseiten); ein Serverstart benennt das Live-Motto um, ohne Felder anzufassen',
      seedFs.name === 'Dein Freestyle' && datei.name === 'Dein Freestyle' && datei.headline === 'Dein Freestyle' && seiten.every(h => !h.includes('Otto Freestyle') && h.includes('Dein Freestyle'))
        && /e\.name === 'Otto Freestyle' \? 'Dein Freestyle'/.test(serv) && /const FS_REV = 8;/.test(serv));   // 19. Okt. abends: FS_REV 8 (Foto vor dem Wunsch)
  }
  // 19. Okt., Markus: "bei dem Stil Freestyle die Moeglichkeit, noch dazu ein Foto hochzuladen oder eine Datei,
  // so dass diese geaendert werden kann". Nachgestellt vorher: Freestyle hatte drei Seiten (Artikel, Wunsch,
  // Alles klar) und keinen Weg, ein Foto zu geben - die Foto-Felder waren seit FS_REV 4 versteckt.
  {
    const datei = JSON.parse(fsSync.readFileSync('freestyle/motto-freestyle.json', 'utf8'));
    const keys = (datei.fields || []).map(f => f.key);
    const foto = datei.fields.find(f => f.key === 'foto'), modus = datei.fields.find(f => f.key === 'foto_modus');
    const ms = fsSync.readFileSync('motto-seite.js', 'utf8'), mo = fsSync.readFileSync('mottos.js', 'utf8'), fo = fsSync.readFileSync('fotos.js', 'utf8');
    pruefe('Freestyle-Foto: eigener freiwilliger Schritt direkt VOR dem Wunsch (erst das Foto, dann sagen, was daran anders wird) (ohneGeht, Knopf "Foto oder Datei", Zusage am Knopf), kein Haken foto_rechte, foto_modus kennt "verändern" und bleibt versteckt',
      keys.indexOf('foto') + 1 === keys.indexOf('motiv') && /an deinem Foto/.test(((datei.fields.find(f => f.key === 'motiv') || {}).mitFoto || {}).label || '') && /mitFoto: f\.mitFoto/.test(mo) && /function mitFotoTexte/.test(ms) && !!foto && foto.type === 'upload' && foto.ohneGeht === true && !foto.versteckt && !foto.zeigeWenn && /Datei/.test(foto.knopf || '') && /bestätigst/.test(foto.hint || '')
        && !keys.includes('foto_rechte') && !!modus && modus.versteckt === true && modus.options.some(o => /verändern/.test(o))
        && /ohneGeht: type === 'upload' && !!f\.ohneGeht/.test(mo) && /esc\(f\.knopf \|\| 'Foto wählen'\)/.test(ms) && (ms.match(/accept="image\/\*,\.heic,\.heif,\.svg"/g) || []).length === 2,
      JSON.stringify({ keys, ohneGeht: foto && foto.ohneGeht, knopf: foto && foto.knopf }));
    pruefe('Freestyle-Foto: Server kennt den Weg "veraendert" (fotoModusVon), die Bruecke setzt ihn aus dem Wunsch (Vorgabe: verändern), runJob aendert das Foto zuerst nach dem Wunsch (nur Arbeitsspeicher, eigene Sitzung) und laeuft dann wie "so einsetzen"; Rechte ohne Haken gelten als beim Hochladen bestaetigt',
      /\? 'veraendert' : null\)\)/.test(serv) && /PHOTO ATTACHED/.test(serv) && /\|\| 'veraendert';/.test(serv) && /foto\.modus === 'veraendert'/.test(serv) && /fotoAendernPrompt\(values\.motiv/.test(serv)
        && /foto\.sitzung = neu; foto\.modus = 'original'; foto\.veraendert = true;/.test(serv) && /FOTO_BESITZ\.set\(neu, FOTO_BESITZ\.get\(foto\.sitzung\)\)/.test(serv)
        && /rechteHaken \? 'Haken gesetzt' : 'beim Hochladen bestaetigt'/.test(serv) && /export function fotoAendernPrompt/.test(fo) && /aendernFehlgeschlagen/.test(serv));
    // 19. Okt., Markus: "ein Tool, um an einem Design, das den Kunden gefaellt, nur Teilstuecke zu aendern" - derselbe
    // Weg wie "Text korrigieren" (das fertige Design ist die Vorlage, hohe Vorlagentreue), der Kunde sagt frei, was anders wird.
    { const html = fsSync.readFileSync('motto.html', 'utf8');
      pruefe('Teil-Aenderung: Zeile "Nur das ändern" unter dem fertigen Design (Eingabe + Knopf), die Seite schickt korrekturVon + aenderung, der Server haengt den Wunsch als einzige Aenderung an den Korrektur-Auftrag (Vorlagentreue high, Markensperre), ein schon geaendertes Foto wird dabei nicht noch einmal geaendert',
        /id="aendern-row"/.test(html) && /id="aendern-text"/.test(html) && /id="aendern-btn">Nur das ändern</.test(html)
          && /aenderung: \(korrekturVon && aenderung\) \|\| ''/.test(ms) && /korrekturVon = shown\.designId; aenderung = t;/.test(ms) && /an dem sich etwas ändern ließe/.test(ms) && /'Änderung starten'/.test(ms)
          && /korrektur = \{ von, alt: jf\.values \|\| \{\}, aenderung \};/.test(serv) && /marken\.checkAll\(\[aenderung\]\)/.test(serv) && /if \(korr\.aenderung\) diffs\.push/.test(serv)
          && /inputFidelity: \(grund \|\| korr\.aenderung\) \? 'high' : undefined/.test(serv) && /foto\.modus === 'veraendert' && korr && fotoHolen\(foto\.sitzung \+ '_x'\)/.test(serv)); }
    pruefe('Freestyle-Foto: eine Datei darf SVG sein (wird zu PNG gerastert), eine PDF bekommt einen ehrlichen Satz statt "kein Bild"',
      /kopf\.startsWith\('%PDF'\)/.test(serv) && /FOTO_TEXTE\.pdf/.test(serv) && /<svg/.test(serv) && /\.png\(\)\.toBuffer\(\); mime = 'image\/png';/.test(serv) && /pdf: 'Eine PDF/.test(fo));
  }
  const typen = [...serv.matchAll(/endung:\s*'(\w+)',\s*typ:\s*'([^']+)'/g)];
  pruefe('jedes Bildformat nennt seinen vollen Typ', typen.length > 0 && typen.every(t => t[2].includes('/')),
    typen.map(t => t[1] + ' -> ' + t[2]).join(', ') || 'keine Formate gefunden');

  // Fassung 80: Bildrechte der Textil-Linie. Roly erlaubt seine Produktfotos ausschliesslich
  // unveraendert ("no editing, recoloring, compositing or other modification") - ein Mockup
  // mit unserem Motiv darauf waere eine Bearbeitung. Das sieht man einem fertigen Bild nicht
  // an, deshalb muss es hier geprueft werden und nicht im Auge des Betrachters.
  pruefe('jede Marke der Linie sagt, ob Mockups erlaubt sind',
    Object.values(MARKEN).every(m => typeof m.mockupErlaubt === 'boolean'),
    Object.values(MARKEN).map(m => m.name + ': ' + (m.mockupErlaubt ? 'ja' : 'nein')).join(' · '));
  const ohneRecht = LINIE.filter(a => !MARKEN[a.marke].mockupErlaubt);
  pruefe('kein Artikel ohne Bildrecht ist als bereit markiert',
    !ohneRecht.some(linieBereit),
    ohneRecht.length + ' Artikel ohne Mockuprecht (' + [...new Set(ohneRecht.map(a => MARKEN[a.marke].name))].join(', ') + ')');
  // 25. Sept., Markus: "Ich erlaube dir, die Roly-Sachen zu zeigen, da ich von denen eine
  // Genehmigung habe." Der Schalter darf umgelegt werden - aber eine Freigabe ohne Datum und
  // ohne Herkunft ist kein Nachweis, sondern eine Erinnerung. Wer von "nein" auf "ja" wechselt,
  // haengt den Beleg mit dran; sonst steht in einem halben Jahr da, dass es erlaubt sei, und
  // niemand weiss mehr, warum.
  for (const [key, m] of Object.entries(MARKEN)) {
    if (!m.warumNicht) continue;   // war nie gesperrt
    pruefe(`${m.name}: Mockups erlaubt nur mit belegter Freigabe`,
      !m.mockupErlaubt || !!(m.freigabe && m.freigabe.datum && m.freigabe.von && m.freigabe.belegt),
      m.mockupErlaubt ? 'Freigabe ' + ((m.freigabe || {}).datum || 'OHNE DATUM') : 'gesperrt');
  }
  // Was die Roly-Freigabe NICHT aufhebt: die Regel gegen gespiegelte Rueckansichten stammt nicht
  // von Roly, sondern gilt fuer die ganze Linie.
  // Hier stand bis zum 25. Sept. "Roly bleibt NOT_VERIFIED" - das war richtig, solange es keine
  // Rueckenbilder gab. Inzwischen sind sie geholt, echte vom Hersteller, und damit ist die
  // Aussage ueberholt. Was bleibt, ist die Regel dahinter: eine belegte Rueckseite gibt es nur
  // mit einem eigenen Rueckenbild - nie durch Spiegeln der Vorderseite. Das prueft der Abschnitt
  // "Rueckansichten" weiter unten Artikel fuer Artikel gegen die Dateien auf der Platte.
  pruefe('keine Marke bekommt eine Rueckseite geschenkt, nur weil ihre Bilder freigegeben sind',
    LINIE.every(a => a.rueckseite === 'NOT_VERIFIED' || !!RUECKANSICHT_GEHOLT),
    LINIE.filter(a => a.rueckseite !== 'NOT_VERIFIED').length + ' mit belegter Rueckseite, geholt ' + RUECKANSICHT_GEHOLT);

  // ---- Die Rueckansichten (25. Sept.) ----
  // Markus: "Warum haben wir keine Rueckansicht? Besorge die noch!" Sie sind geholt - aber
  // "belegt" darf nie nur ein Wort im Katalog sein. Zu jeder Rueckseite, die nicht mehr
  // NOT_VERIFIED heisst, muss eine Datei liegen; sonst steht im Katalog "haben wir" und im
  // Mockup kommt ein Loch. Genau diese Sorte Fehler hat die ganze Regel ausgeloest.
  {
    const dateien = new Set(await fs.readdir('textil-bilder'));
    const belegt = LINIE.filter(a => a.rueckseite && a.rueckseite !== 'NOT_VERIFIED');
    pruefe('es gibt ueberhaupt belegte Rueckansichten', belegt.length > 0, belegt.length + ' von ' + LINIE.length);
    for (const a of belegt) {
      const da = ['white', 'black'].filter(f => dateien.has(`${a.id}_${f}_back.jpg`));
      pruefe(`Rueckansicht "${a.id}": Datei liegt wirklich da`, da.length > 0, da.join(' + ') || 'KEINE Datei');
    }
    // Und umgekehrt: keine Datei ohne Eintrag - sonst haelt sie sich fuer geholt und wird nie benutzt.
    for (const f of [...dateien].filter(x => x.endsWith('_back.jpg'))) {
      const id = f.replace(/_(white|black)_back\.jpg$/, '');
      pruefe(`Rueckansicht-Datei "${f}" gehoert zu einem Artikel der Linie`, LINIE.some(a => a.id === id), id);
    }
    // Jede Adresse ist nachgewiesen - eine erfundene Bildadresse ist im Manifest ausdruecklich
    // verboten, und ohne Herkunft weiss in einem halben Jahr niemand mehr, woher das Bild kam.
    const q = JSON.parse(await fs.readFile('textil-bilder/quellen.json', 'utf8'));
    pruefe('die Rueckansichten haben einen Herkunftsnachweis mit Datum',
      !!(q.rueckansichten && q.rueckansichten.geholt && q.rueckansichten._hinweis));
    for (const a of belegt) {
      const marke = a.marke === 'stanleystella' ? 'stanleystella' : a.marke;
      const eintraege = (q.rueckansichten || {})[marke] || {};
      pruefe(`Rueckansicht "${a.id}": Quelle notiert`,
        Object.keys(eintraege).some(k => k.startsWith(a.id + '_')), Object.keys(eintraege).filter(k => k.startsWith(a.id + '_')).length + ' Adresse(n)');
    }
    // B&C bleibt offen - und das soll man sehen, nicht raten muessen.
    pruefe('B&C hat weiterhin keine Rueckansicht, und der Katalog sagt das auch',
      LINIE.filter(a => a.marke === 'bc').every(a => a.rueckseite === 'NOT_VERIFIED'),
      LINIE.filter(a => a.marke === 'bc').length + ' Artikel offen');
  }

  // Und: keine Marke ohne Quelle und Pruefdatum - sonst weiss in einem halben Jahr niemand
  // mehr, worauf sich die Einschaetzung stuetzt.
  pruefe('jede Marke nennt Quelle und Pruefdatum',
    Object.values(MARKEN).every(m => m.quelle && m.geprueft),
    Object.values(MARKEN).map(m => m.name + ' ' + m.geprueft).join(' · '));
  // Fassung 80b: Zwei Regeln aus der Rechtedokumentation, die man einem fertigen Bild nicht
  // ansieht - deshalb hier.
  // 1. "Keine Spiegelung einer Frontansicht als vermeintliches Backbild." makeMockup() nimmt
  //    fuer Ruecken-Mockups von T-Shirt und Hoodie heute die VORDERE Vorlage. Bei eigenen
  //    Vorlagen ist das unsere Sache, bei Herstellerbildern ausdruecklich verboten.
  pruefe('kein Artikel der Linie hat ein unbelegtes Rueckenbild als belegt markiert',
    LINIE.every(a => a.rueckseite === 'NOT_VERIFIED' || linieRueckenErlaubt(a.id)),
    LINIE.filter(a => linieRueckenErlaubt(a.id)).length + ' von ' + LINIE.length + ' mit geprueftem Rueckenbild');
  // 2. Roly empfiehlt fuer die Nebraska kein DTF. Wir drucken DTF. So ein Artikel darf nie
  //    verkaufsfertig werden - sonst verkaufen wir ein Teil, das der Hersteller selbst nicht
  //    fuer unser Verfahren freigibt.
  const dtfNein = LINIE.filter(a => a.dtfGeeignet === false);
  pruefe('kein Artikel ohne DTF-Empfehlung ist verkaufsfertig',
    !dtfNein.some(linieBereit),
    dtfNein.length ? dtfNein.map(a => a.name).join(', ') + ' - vom Hersteller nicht fuer DTF empfohlen' : 'keiner betroffen');
  // Fassung 84: Die Farben kommen jetzt aus dem vollstaendigen Paket - und genau deshalb muss
  // maschinell nachrechenbar bleiben, dass sie DORTHER kommen und nirgends dazugedichtet wurden.
  // Der Brief im Paket sagt es woertlich: "Never invent a colour name for Roly numeric codes."
  pruefe('jeder Artikel der Linie steht auch im gelieferten Paket',
    LINIE.every(a => PAKET.artikel[a.id]),
    LINIE.length + ' Artikel, ' + Object.keys(PAKET.artikel).length + ' im Paket');
  pruefe('keine Farbe ist dazugedichtet - jede steht so im Paket',
    LINIE.every(a => {
      const p = PAKET.artikel[a.id];
      return !p || a.farben.every(f => p.farben.includes(f));
    }),
    LINIE.reduce((s, a) => s + a.farben.length, 0) + ' Farbnamen, alle aus dem Paket');
  // Gegenprobe zum ALTEN Bildmanifest: die B&C-Liste von gestern muss im neuen Paket wieder
  // auftauchen. Taete sie es nicht, haette eine der beiden Quellen ein Problem - und das faellt
  // sonst erst auf, wenn ein Kunde eine Farbe bestellt, die es nicht gibt.
  // Das neue Paket schreibt Name UND Herstellercode ("White 001"), das alte nur den Namen.
  // Verglichen wird deshalb der Name am Anfang - und genau so faellt auch auf, wenn ein Name
  // ganz verschwindet.
  const bcTee = LINIE.find(a => a.id === 'bc-tee');
  const fehlend = !bcTee ? BC_E190_FARBEN
    : BC_E190_FARBEN.filter(f => !bcTee.farben.some(n => n === f || n.startsWith(f + ' ') || n.startsWith(f + ' (')));
  pruefe('die B&C-Farben aus dem Bildmanifest stehen auch im neuen Paket',
    !fehlend.length,
    fehlend.length ? 'fehlen jetzt: ' + fehlend.join(', ')
      : BC_E190_FARBEN.length + ' Farben aus dem Manifest wiedergefunden, ' + (bcTee.farben.length - BC_E190_FARBEN.length) + ' sind neu dazugekommen');
  pruefe('die ausgeschlossene Nebraska steht in keiner Liste mehr',
    !LINIE.some(a => a.nummer === '6436') && !!AUSGESCHLOSSEN['roly-jacke'],
    'ausgeschlossen: ' + Object.values(AUSGESCHLOSSEN).map(a => a.name + ' ' + a.nummer).join(', '));
  pruefe('jeder Artikel hat Groessen, Gewicht und eine Beschreibung aus Tatsachen',
    LINIE.every(a => a.groessen.length && a.gramm > 0 && a.beschreibung.includes('g/m²')),
    LINIE.length + ' Artikel von ' + Math.min(...LINIE.map(a => a.gramm)) + ' bis ' + Math.max(...LINIE.map(a => a.gramm)) + ' g/m²');

  const ohneFarben = LINIE.filter(a => !a.farben.length);
  if (ohneFarben.length) hinweis('Ohne Farben: ' + ohneFarben.map(a => a.name + ' (' + a.nummer + ')').join(', ')
    + ' - im Paket steht dort eine leere Liste.');
  const ohneVorlage = LINIE.filter(a => FORMEN_OHNE_VORLAGE.includes(a.form));
  hinweis(ohneVorlage.length + ' von ' + LINIE.length + ' Artikeln haben eine Form, fuer die es '
    + 'noch keine Mockup-Vorlage gibt: ' + [...new Set(ohneVorlage.map(a => a.form))].join(', '));
  const bericht = linieBericht();
  hinweis('Textil-Linie: ' + bericht.bereit + ' von ' + bericht.gesamt + ' Artikeln verkaufsfertig, '
    + LINIE.reduce((s, a) => s + a.farben.length, 0) + ' Farben. Es fehlen noch die Produktbilder '
    + 'und die Preise.');
}

// ------------------------------------------------- 3b · Das System gegen sich selbst
// Fassung 89. Markus, nach einem Tag, an dem er vier meiner Fehler gefunden hat: "Ich moechte,
// dass du das ganze System auf Fehler pruefst. Ich kann nicht hinter dir herraeumen und dich auf
// deine eigenen Fehler hinweisen."
// Er hat recht. Diese Pruefungen suchen genau die Fehlerklassen, die an diesem Tag aufgetreten
// sind - nicht die Symptome, sondern die Muster dahinter. Keine davon haette ein Mensch finden
// muessen.
async function pruefeSystem() {
  abschnitt(3.5, 'Das System gegen sich selbst: die Fehlermuster von Fassung 85-89');
  const admin = await fs.readFile('admin.html', 'utf8');
  const jsDateien = (await fs.readdir('.')).filter(f => f.endsWith('.js') && f !== 'abnahme.mjs');

  // 1. Ein <img> schickt keine Kopfzeilen. Zeigt es auf eine geschuetzte Route ohne Token in
  //    der Adresse, bleibt das Bild leer - im Backend standen so alle fertigen Vorlagen als
  //    kaputtes Symbol da, obwohl sie laengst erzeugt waren.
  const ohneToken = [];
  for (const m of admin.matchAll(/src="'\s*\+\s*([A-Za-z0-9_.]+)/g)) {
    const umfeld = admin.slice(Math.max(0, m.index - 500), m.index + 300);
    if (!/\/api\/admin\//.test(umfeld)) continue;
    if (!/token=/.test(umfeld.slice(umfeld.indexOf('src="')))) ohneToken.push(m[1]);
  }
  pruefe('jedes Bild im Backend bringt seinen Zugang mit', !ohneToken.length,
    ohneToken.length ? ohneToken.join(', ') + ' - ein <img> schickt keine Kopfzeilen' : 'sonst bleibt das Bild leer');

  // 2. Zwei Systeme, ein Dateiname. So hat der Vorlagen-Erzeuger die echten Herstellerfotos
  //    ueberschrieben und die Kundenseite geleert.
  const vr = await fs.readFile('vorlagen-route.js', 'utf8');
  pruefe('der Vorlagen-Erzeuger kann kein Herstellerfoto ueberschreiben', /istOriginalfoto/.test(vr),
    'beide legen ihre Bilder unter demselben Namen ab');
  const srv = await fs.readFile('server.js', 'utf8');
  pruefe('ueberschriebene Herstellerfotos werden von selbst zurueckgeholt', /originaleWiederherstellen/.test(srv));
  // 6. Okt., Markus (Kissen gewaehlt, Fragen nach Textil und Brustgroesse): ein normales Motto zeichnet auf die
  // Flaeche des gewaehlten Artikels, Sublimation = weisser Traeger; die Seite schickt den Artikel aus dem Link mit.
  // 6. Okt., Markus: "verschiedene Artikel, verschiedene Groessen, verschiedene Stile ... mal von vorne, mal von hinten" - freigegeben
  // wird das BILD (bandBild: Teil, Seite, Linie/Szene), das Band zeigt genau dieses; ein anderes Bild macht die Antwort wieder offen.
  { const bf = await fs.readFile('band-freigabe.html', 'utf8');
    pruefe('Band-Freigabe: festes Bild je Vorschlag (Teil, Seite, Linie), Band zeigt genau das, neues Bild = neue Frage, Seite nennt die Darstellung',
      /function bandBildPruefen\(b\)/.test(srv) && /const bb = bandBildPruefen\(\(sc\[x\.designId\] \|\| \{\}\)\.bandBild\);[\s\S]{0,700}x\.image = bandBildUrl\(x\.designId, bb\)/.test(srv) &&
      /JSON\.stringify\(bb\) !== JSON\.stringify\(bandBildPruefen\(sc\[id\]\.bandBild\)\)\) \{ sc\[id\]\.bandBild = bb; delete sc\[id\]\.bandFrei; \}/.test(srv) &&
      /app\.get\('\/api\/admin\/band-kandidaten'/.test(srv) && /x\.darstellung/.test(bf)); }
  // 6. Okt., Markus (Blues Brothers, berechtigt gesperrt): "in dem Stil machen, dass es ansatzweise so aussieht, aber ohne
  // rechtliche Probleme". Geschuetzte Namen VOR dem Malen per Text-KI finden (nicht nur die feste Liste), Wunsch frei nachempfinden
  // (Name, Logo, Figuren raus, Look als allgemeine Beschreibung), danach noch einmal pruefen; Seite bietet den Ausweg an.
  { const sq = await fs.readFile('server.js', 'utf8'), ms = await fs.readFile('motto-seite.js', 'utf8');
    pruefe('Marken-Ausweg: Text-KI findet geschuetzte Namen vor dem Malen, schreibt den Wunsch frei um und prueft ihn erneut; Seite fragt Ja/Nein',
      /async function geschuetztFinden\(text\)/.test(sq) && /async function markeAuswegBauen\(text, wort, eigen\)/.test(sq) && /const nochmal = \(await geschuetztFinden\(wunsch \+ ' ' \+ auf\)\)\.filter/.test(sq) &&
      /app\.post\('\/api\/mo\/marke-ausweg'/.test(sq) && /const namen = fest \? \[wieGeschrieben\(fest\.wort\)\] : await geschuetztFinden\(text\)/.test(sq) && /ausweg: true \}\); \}/.test(sq) &&
      /function markeFrage\(wort, eingabe\)/.test(ms) && /else if \(j\.error === 'marke'\) \{ markeFrage\(/.test(ms) && /r\.j\.markeHinweis/.test(ms)); }
  // 6. Okt., Markus: "Bau das mal auf der Seite ein, damit ich ein Feeling dafuer bekomme" - Otto spricht auf der Startseite.
  { const hn = await fs.readFile('home-neu.html', 'utf8');
    pruefe('Startseite: Otto antippen -> er sagt seinen Satz (Markus\' Aufnahme, neueste Fassung), wackelt dabei; erstes Mikro-Tippen begruesst, das Mikro ueberhoert Otto',
      /id="otto-spricht"/.test(hn) && /function ottoSag\(satz, danach\)/.test(hn) && /'\/otto-stimme\/' \+ satz \+ '\.mp3\?v=' \+ v/.test(hn)
      && /if \(ottoSpricht\) return;/.test(hn) && /mo_begruesst/.test(hn) && /prefers-reduced-motion:reduce\)\{\.wunsch-otto-knopf/.test(hn)); }
  // 6. Okt., Markus (Startseite, Schritt 4 "Anfrage schicken ... Einen Warenkorb gibt es noch nicht"): "Die Leute koennen ab sofort
  // kaufen und bestellen."
  { const hn = await fs.readFile('home-neu.html', 'utf8');
    pruefe('Startseite Schritt 4: "Bestellen" mit Warenkorb und Bezahlen, kein "Warenkorb gibt es noch nicht"',
      /<h3>Bestellen<\/h3>/.test(hn) && /ab in den Warenkorb und direkt bezahlen/.test(hn) && !/Warenkorb gibt es noch nicht/.test(hn) && !/<h3>Anfrage schicken<\/h3>/.test(hn)); }
  // 6. Okt., Markus: "Bau mir doch hier einen Aufnahmeknopf" - "eine kleine Seite, wo wir immer Zugriff haben". /admin/stimme.
  { const sq = await fs.readFile('server.js', 'utf8'), st = await fs.readFile('stimme.html', 'utf8'), og = await fs.readFile('otto-gespraech.js', 'utf8'), df = await fs.readFile('Dockerfile', 'utf8');
    const sz = JSON.parse(await fs.readFile('otto-stimme/saetze.json', 'utf8')).saetze;
    pruefe('Ottos Stimme: Aufnahmeseite (Satz, Knopf, Probehoeren, Speichern, Text aenderbar), Anmeldung vor dem Einlesen, ffmpeg bereitet auf, Otto spielt die neueste Aufnahme, Nord-Ton mit Moin',
      /app\.get\('\/admin\/stimme'/.test(sq) && /'\/api\/admin\/stimme\/:schluessel\/aufnahme', \(req, res, next\) => adminGuard\(req, res, next\), express\.raw/.test(sq)
      && /loudnorm=I=-16/.test(sq) && /async function stimmeAufbereiten\(roh, ziel\)/.test(sq) && /ohne Stille-Schnitt/.test(sq) && /'\/api\/admin\/stimme\/:schluessel\/neu'/.test(sq) && /\bffmpeg\b/.test(df) && /MediaRecorder/.test(st) && /id="speichern"/.test(st) && /Text ändern/.test(st)
      && /'\/otto-stimme\/' \+ schluessel \+ '\.mp3\?v=' \+ stand\[schluessel\]/.test(og) && /sag: sag/.test(og)
      && Object.keys(sz).length === 28 && ['fuer_wen', 'anlass_gruppe', 'anlass_geschenk', 'idee_oder_motto', 'stil_frage', 'abstimmen', 'menge'].every(k => !!sz[k]) && /^Moin/.test(sz.start) && !!sz.marke); }
  // 6. Okt., Markus: "Hast du eigentlich auch alle Woerter, die auf dem Index stehen?" - "Ja, aber sie kann natuerlich auch im
  // Sport Bezug sein." Feste Liste erweitert (nur Eindeutiges), Text-KI im Zusammenhang, Sportangaben bleiben frei.
  { const sq = await fs.readFile('server.js', 'utf8');
    const { verbotenStore } = await import('./verboten.js');
    const vb = verbotenStore(path.join(os.tmpdir(), 'vb-abnahme-' + process.pid)); await vb.ready();
    pruefe('Index: White Power, HKNKRZ, Blut und Boden, Wiking-Jugend gesperrt; Rueckennummer 88, Kegelclub 18 frei; Text-KI mit Sportbezug in Wunsch und Auftrag',
      !!vb.pruefeText('White Power Crew') && !!vb.pruefeText('HKNKRZ') && !!vb.pruefeText('Blut und Boden') && !!vb.pruefeText('Wikingjugend')
      && !vb.pruefeText('Rückennummer 88') && !vb.pruefeText('Kegelclub 18') && !vb.pruefeText('Ultras Harmstorf')
      && /AUCH aus der Hooligan- und Fussballszene/.test(sq) && /als Rueckennummer, Alter, Jahrgang/.test(sq)
      && /quelle: 'eingabe-ki'/.test(sq) && /const verbotenKi = verbotenFest \? Promise\.resolve\(\[\]\) : verbotenFinden\(text\)/.test(sq)); }
  // 6. Okt., Markus: "Bei Adidas geht's ja besonders um die drei Streifen und bei Nike um den Swoosh" - Bildmarken ohne Namen.
  { const sq = await fs.readFile('server.js', 'utf8'), mo = await fs.readFile('mottos.js', 'utf8'), mk = await fs.readFile('marken.js', 'utf8');
    pruefe('Bildmarken ohne Namen: Wunschpruefung, Ausweg-Text, alle drei Bildauftraege und die Bildpruefung kennen drei Streifen, Swoosh & Co.; Swoosh in der festen Liste',
      /BILDMARKEN, die jemand ohne Namen beschreibt: drei parallele Streifen/.test(sq) && /keine parallelen Streifen, Linien, Paspeln oder Naehte an Aermeln/.test(sq)
      && /WORDLESS BRAND MARKS COUNT TOO/.test(sq) && (mo.match(/no wordless brand marks either: no three parallel stripes/g) || []).length === 3
      && /'SWOOSH', 'NIKE-HAKEN', 'ADIDAS-STREIFEN'/.test(mk)); }
  // 6. Okt., Markus (BC4W "Nuechtern seid ihr alle nicht zu ertr"): Spruchfelder schneiden nicht mehr bei 28-40 Zeichen ab.
  { const { spruchLaenge, SPRUCH_MIN } = await import('./mottos.js');
    const m = spruchLaenge({ fields: [{ key: 'spruch', type: 'text', max: 36 }, { key: 'crew', type: 'text', max: 22 }, { key: 'sub', type: 'text', max: 28 }] });
    const ms = await fs.readFile('mottos.js', 'utf8');
    pruefe('Spruchfelder: mindestens 80 Zeichen (Malle 36 -> 80, Sprueche-Untertitel 28 -> 80), andere Felder unveraendert, gilt beim Lesen jeder Motto-Datei',
      SPRUCH_MIN === 80 && m.fields[0].max === 80 && m.fields[1].max === 22 && m.fields[2].max === 80
      && /out\.push\(spruchLaenge\(JSON\.parse/.test(ms) && /return spruchLaenge\(JSON\.parse/.test(ms)); }
  // 6. Okt., Markus: "wenn gesperrte Woerter drin sind, dass wir gar nicht anfangen zu produzieren ... ganz lieb und nett ...
  // hoechstens im aehnlichen Stil ... kurze Abfrage, ob ja oder nein."
  { const sq = await fs.readFile('server.js', 'utf8'), ms = await fs.readFile('motto-seite.js', 'utf8'), hn = await fs.readFile('home-neu.html', 'utf8'), og = await fs.readFile('otto-gespraech.js', 'utf8');
    pruefe('Geschuetzter Name: Wunsch fragt erst (409 frage marke, nichts abgelegt), umgeschrieben nur nach Ja; normale Mottos pruefen Spruchfelder vor dem Malen; Ja/Nein auf Startseite, Mottoseite und per Sprache',
      /return res\.status\(409\)\.json\(\{ frage: 'marke', wort, hinweis: markeFrageText\(namen\[0\]\) \}\)/.test(sq) && /if \(!\(req\.body \|\| \{\}\)\.ausweg\)/.test(sq)
      && /quelle: 'marke-eingabe-ki'/.test(sq) && /ganz ohne das\. Möchtest du das\?/.test(sq)
      && /function markeFrage\(j, text\)/.test(hn) && /id = 'wunsch-ja'/.test(hn) && /senden\(\{ ausweg: true \}\)/.test(hn)
      && /Ja, gerne/.test(ms) && /Nein, ich ändere es/.test(ms) && /window\.MoMarkeFrage = \{ ja: ja, nein: nein \}/.test(ms) && /Soll ich das einfach weglassen/.test(ms)
      && /window\.MoWunschFrage \|\| window\.MoMarkeFrage/.test(og)); }
  // 6. Okt., live: "Ein Hoodie mit der Hamburger Skyline ..." wurde als T-Shirt eingetragen - der Artikel kommt aus dem Wunsch.
  { const sq = await fs.readFile('server.js', 'utf8');
    const { ARTIKEL, verkaufsfaehig } = await import('./artikel.js');
    const quelle = sq.slice(sq.indexOf('const WUNSCH_ARTIKEL = ['), sq.indexOf('\n}\n', sq.indexOf('function wunschArtikel(')) + 2);
    const wa = new Function('ARTIKEL', 'verkaufsfaehig', quelle + '\nreturn wunschArtikel;')(ARTIKEL, verkaufsfaehig);
    pruefe('Freestyle-Wunsch: Artikel aus dem Text (Hoodie, Kissen, Strandtuch ...), der zuerst genannte zaehlt, sonst T-Shirt',
      wa('Ein Hoodie mit der Hamburger Skyline') === 'hoodie' && wa('Kapuzenpulli fuer den JGA') === 'hoodie' && wa('Sweatshirt mit Elch') === 'hoodie'
      && wa('ein Kissen mit unserem Hund') === 'kissen' && wa('Strandtuch mit Leuchtturm') === 'strandtuch' && wa('Handtuch fuers Gym') === 'handtuch'
      && wa('Shirt mit einem Kissen drauf') === 'tshirt' && wa('Hamburger Skyline bei Nacht') === 'tshirt' && wa('Jutebeutel mit Spruch') === 'shopper'
      && /artikelSetzen\(daten, wunschArtikel\(text\)\);/.test(sq) && /daten\.artikelId = aid;/.test(sq)); }
  // 7. Okt., Markus (Maurer-Spruch auf einer Frau im Strassencafe): "Warum ist das ein weibliches Model bei dem Begriff Maurer? ...
  // Hintergrund passt nicht zum Maurer! Anstatt nur das Produkt ... nur das Design und dann ohne T-Shirt."
  { const sq = await fs.readFile('server.js', 'utf8'), ms = await fs.readFile('motto-seite.js', 'utf8');
    const quelle = sq.slice(sq.indexOf('const INHALT_MOTTOS = '), sq.indexOf('async function werFuerMockup('));
    const f = new Function('SZENE_THEMEN', quelle + '\nreturn { szeneMottoFuer, werAusInhalt };')({ 'handwerker-shirt': {}, 'sprueche-shirt': {}, 'angler-shirt': {} });
    const maurer = { motto: 'sprueche-shirt', values: { spruch: 'Ich kann nicht, ich hab Rücken', wunsch: 'Maurer' } };
    pruefe('Getragen: Inhalt waehlt Szene und Person bei Spruechen/Freestyle (Maurer -> Handwerker-Szene, Mann); eigenes Motto bleibt; "Nur das Design" zeigt das Motiv ohne Shirt; Farben bekommen die Szene, wo sie sich einfaerben laesst',
      f.szeneMottoFuer(maurer) === 'handwerker-shirt' && f.werAusInhalt(maurer) === 'mann' && f.szeneMottoFuer({ motto: 'sprueche-shirt', values: { spruch: 'Sarkasmus ist meine Superkraft' } }) === 'sprueche-shirt'
      && f.szeneMottoFuer({ motto: 'abi', values: { motto: 'Maurer' } }) === 'abi' && f.werAusInhalt({ values: { spruch: 'Beste Oma der Welt' } }) === 'frau'
      && /szeneThemaFuer\(garment, color, szMotto, wer\)/.test(sq) && /werVomNamen\(name\) \|\| werAusInhalt\(j\)/.test(sq)
      && /szene\['f-' \+ f\.key\]/.test(sq) && />Nur das Design<\/button>/.test(ms) && !/Nur das Produkt/.test(ms) && /zeigeBild\(shown\.preview \+ q\); drawAlsoOn/.test(ms)); }
  // 7. Okt., Markus: "Maurer ist doch nicht in einer Tischlerwerkstatt?" - "Das muessen wir schon genau machen, und wenn du den
  // Begriff nicht kennst, musst du ihn halt jedes Mal recherchieren." Szene nach Begriff: lesen, nachschlagen, einmal fotografieren.
  { const sb = await fs.readFile('szene-begriff.js', 'utf8'), sq = await fs.readFile('server.js', 'utf8'), mk = await fs.readFile('mockups.js', 'utf8');
    const { schluesselVon } = await import('./szene-begriff.js');
    pruefe('Szene nach Begriff: Begriff aus dem Design (Text-KI), Wikipedia nachgeschlagen, Zettel je Begriff, Foto weiss + schwarz desselben Fotos (einfaerbbar), vermessen, gemerkt; Maurer auf der Baustelle mitgeliefert; Sprueche/Freestyle/Handwerk fragen zuerst danach; Farben ohne Szene zeigen das gefaerbte Shirt',
      schluesselVon('Maurer', 'mann') === 'maurer-mann' && schluesselVon('Bäckerin', 'frau') === 'baeckerin-frau'
      && /await wikiSummary\(begriff\)/.test(sb) && /never in a carpentry workshop/.test(sb) && /szeneSchwarzAuftrag/.test(sb) && /merkeBox\(STORE, key \+ '_' \+ farbe/.test(sb) && /task: 'general', background: 'opaque'/.test(sb)
      && /kette = kette\.then/.test(sb) && /wird nicht ueberschrieben/.test(sb) && /if \(await templateReady\('tee-szene-thema-b-' \+ d\.schluessel, 'white'\)/.test(sb) && /stand: 2 \},   \/\/ Stand 2: holt das angesehene Foto zurueck/.test(mk) && /veraltet && key\.includes\('-szene-thema-'\)/.test(mk) && /'tee-szene-thema-b-maurer-mann': \{/.test(mk) && /\^b-\[a-z0-9-\]\+\$/.test(mk)
      && /const BEGRIFF_MOTTOS = new Set\(\['sprueche-shirt', 'freestyle', 'handwerker-shirt'\]\)/.test(sq) && /const szMotto = await szeneMottoFuerA\(jobT, designId\);/.test(sq)
      && /if \(farbe && szene && !\(thema && await faerbMaske/.test(sq)
      && fsSync.existsSync('vorlagen-original/tee-szene-thema-b-maurer-mann_white.jpg') && fsSync.existsSync('vorlagen-original/tee-szene-thema-b-maurer-mann_black.jpg')); }
  // 7. Okt., Markus (Abi-Hoodie): "auch die Platzierung ist falsch. Die Kordeln sind nicht zu sehen."
  { const mk = await fs.readFile('mockups.js', 'utf8'), sq = await fs.readFile('server.js', 'utf8');
    const MKm = await import('./mockups.js');
    pruefe('Hoodie vorne: grosser Druck unter den Kordelspitzen, ueber der Tasche (je Herstellerfoto gemessen); Stand 95 baut Hoodie-Bilder neu, auch die Startseiten-Kachel',
      /'bc-hoodie': \{ kordelEnde: 384, taschenOben: 704 \}/.test(mk) && /'ss-hoodie': \{ kordelEnde: 481/.test(mk) && /'roly-hoodie': \{ kordelEnde: 276/.test(mk)
      && /top = Math\.max\(top, hk\.kordelEnde \+ 12\)/.test(mk) && MKm.mockupStandFuer('hoodie') === 95 && MKm.mockupStandFuer('tee') === 84
      && /_v\$\{mockupStandFuer\(garment\)\}\.jpg`\);   \/\/ 7\. Okt\.: mit Stand/.test(sq)); }
  // 7. Okt., Markus: "wie das Ganze von hinten aussehen kann mit Namen" - Rueckseite auf dem Foto von hinten, Schritt 3 zeigt beide Seiten.
  { const sq = await fs.readFile('server.js', 'utf8'), hm = await fs.readFile('home.html', 'utf8');
    pruefe('Rueckseite mit Namen liegt auf dem Foto von hinten (keine Kordeln durch die Namen); So geht\'s Schritt 3: vorne und hinten nebeneinander, ohne Rueckseite nur vorne',
      /rueckenFoto: hinten \|\| back, print,/.test(sq) && /\(hinten \? '_ruecken' : back \? '_rf' : ''\)/.test(sq)
      && /const hinten = req\.query\.seite === 'hinten'/.test(sq) && /hinten \? await backMaster\(heroId\)/.test(sq) && /place: 'back', rueckenFoto: true/.test(sq)
      && /bild\(held\.slug\) \+ '\?seite=hinten'/.test(hm) && /const SAMPLE_FARBE = \{ 'abi': 'white' \}/.test(sq) && (sq.match(/SAMPLE_FARBE\[m\.slug\] \|\|/g) || []).length === 2 && /Hinten mit Namen/.test(hm) && /s3h\.remove\(\); s3\.classList\.remove\('zwei'\)/.test(hm)); }
  // 8. Okt., Markus: "nicht zugekleistert ... nicht alle immer die gleiche Form ... nicht einfach nur ein grosser Fleck mit bisschen bunter Farbe".
  { const z = Array.from({ length: 120 }, () => pickVariationAb({}, { styled: true }));
    const arten = new Set(z.map(v => (v.match(/density and outline: ([A-Z ]+):/) || [])[1]).filter(Boolean));
    const mq = await fs.readFile('mottos.js', 'utf8');
    pruefe('Designs mit Luft: jeder Auftrag zieht Dichte und Umriss (luftig, geteilt, offene Silhouette, Negativraum, reduziert, unterbrochen), auch mit Stil und beim breiten Band; kein "Aufnaeher-Block" mehr im Grundsatz',
      VARIETY_AB.luft.length === 6 && arten.size >= 5 && z.every(v => /NOT one big colourful blob/.test(v)) && /density and outline/.test(pickVariationAb({}, { format: 'breit', styled: true }))
      && /not a compact patch, sticker or badge block/.test(mq) && !/free-standing emblem with an irregular silhouette, like a patch/.test(mq), [...arten].join(', ')); }
  // 8. Okt., Markus: "Beidem" - Fuellmesser (zu volles Motiv einmal mit Luft neu) und Namen auf der Rueckseite in Anordnungen.
  { const sq = await fs.readFile('server.js', 'utf8'), nm = await fs.readFile('names.js', 'utf8');
    const { fuelleMessen } = await import('./images.js');
    const leer = await sharp({ create: { width: 400, height: 400, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
    const block = await sharp(leer).composite([{ input: { create: { width: 300, height: 300, channels: 4, background: '#e0307a' } }, left: 50, top: 50 }]).png().toBuffer();
    const luftig = await sharp(leer).composite([0, 1, 2, 3, 4].map(i => ({ input: { create: { width: 300, height: 20, channels: 4, background: '#e0307a' } }, left: 50, top: 50 + i * 60 }))).png().toBuffer();
    const fb = await fuelleMessen(block), fl = await fuelleMessen(luftig);
    pruefe('Fuellmesser: voller Block ~1,0, luftiges Motiv deutlich darunter; ueber 88 % einmal mit Luft neu (nur der erste Versuch gilt als unsauber), Strafe in der Wertung; Namen: Raster, Zickzack, Sitzreihen, Wechselfarbe mit Kontrast-Sicherung, je Design gewaehlt',
      fb && fb.fuelle > 0.98 && fl && fl.zeilen > 0.98 && fl.fuelle < 0.8
      && /if \(fm\.fuelle > 0\.88\) zuVoll = fm\.fuelle - 0\.88/.test(sq) && /!\(zuVoll > 0 && attempt === 1\)/.test(sq) && /\+ zuVoll \* 300;/.test(sq) && /job\.fuelleNochmal = true/.test(sq)
      && /\['versetzt', 'bogen'\]\.includes\(opts\.anordnung\)/.test(nm) && /const wechsel = /.test(nm) && /anordnung = \['raster', 'versetzt', 'bogen'\]/.test(sq),
      JSON.stringify({ fb, fl })); }
  // 8. Okt., Markus: Neon lockern, "dass die Fuellungen ... oder die Konturen so sind, dass sie nicht zulaufen".
  { const { STYLES: ST } = await import('./mottos.js');
    const t = ST.neon.text;
    pruefe('Neon: einzelne Neon-Teile frei auf dem Stoff statt ganzer Buehne mit Laser-Raster; klare Roehren ohne Glow und Halo-Ringe; Buchstaben offen, Abstand mindestens so breit wie die Roehre (nichts laeuft zu)',
      /SEPARATE NEON PIECES/.test(t) && /no laser grid running to a horizon/.test(t) && /no stacked halo rings/.test(t) && /stay clearly open/.test(t) && /at least as wide as the tube itself/.test(t) && !/visible soft glow/.test(t)); }
  // 6. Okt., Markus ("Wir testen den Ablauf so"): der Otto-Weg /otto - Artikel, fuer wen (Gruppe/Geschenk/fuer mich), Anlass oder
  // eigene Idee, dann die Mottoseite. Otto fragt nie, was schon gesagt wurde; bei Kissen & Co. keine Textilfragen.
  { const sq = await fs.readFile('server.js', 'utf8'), ot = await fs.readFile('otto.html', 'utf8'), hn = await fs.readFile('home-neu.html', 'utf8'), og = await fs.readFile('otto-gespraech.js', 'utf8');
    const { ARTIKEL, verkaufsfaehig } = await import('./artikel.js');
    const gr = new Set(JSON.parse(await fs.readFile('gruppen-mottos.json', 'utf8')).gruppe);
    const quelle = sq.slice(sq.indexOf('const WUNSCH_ARTIKEL = ['), sq.indexOf('\n];\n', sq.indexOf('const WUNSCH_ARTIKEL = [')) + 4)
      + sq.slice(sq.indexOf('const OTTO_FUER = ['), sq.indexOf('\n}\n', sq.indexOf('function ottoLesenFest(')) + 2);
    const lies = new Function('ARTIKEL', 'verkaufsfaehig', 'istGruppenMotto', quelle + '\nreturn ottoLesenFest;')(ARTIKEL, verkaufsfaehig, (s) => gr.has(s));
    const liste = [...gr, 'geburtstag', 'geburt-baby', 'angler-shirt'].map(slug => ({ slug }));
    const a = lies('Hoodie', liste), b = lies('Ich moechte ein Kissen als Geschenk zum Geburtstag', liste), c = lies('JGA fuer Jana, pink und frech', liste), d = lies('Strandtuch fuer mich mit Otto als Surfer vor dem Leuchtturm', liste);
    pruefe('Otto-Weg: liest Artikel / fuer wen / Anlass / Idee (Hoodie -> nur Artikel; Kissen als Geschenk zum Geburtstag; JGA -> Gruppe; Strandtuch fuer mich mit Idee)',
      a.artikel === 'hoodie' && !a.fuer && !a.motto && !a.idee && b.artikel === 'kissen' && b.fuer === 'geschenk' && b.motto === 'geburtstag'
      && !c.artikel && c.fuer === 'gruppe' && c.motto === 'junggesellenabschied' && c.idee && d.artikel === 'strandtuch' && d.fuer === 'selbst' && d.idee);
    pruefe('Otto-Weg: Seite /otto mit Kacheln je Frage, Startseite schickt dorthin, Wunsch mit festem Motto und Artikel, Stil-Frage und Menge im Gespraech',
      /app\.get\('\/otto'/.test(sq) && /app\.post\('\/api\/mo\/otto-lesen'/.test(sq) && /const festSlug = /.test(sq) && /artikelSetzen\(daten, festArtikel\)/.test(sq)
      && /'&artikel=' \+ encodeURIComponent\(daten\.artikelLink\)/.test(sq)
      && ['artikel', 'fuer_wen', 'anlass_gruppe', 'anlass_geschenk', 'idee_oder_motto', 'motto_wahl', 'wunsch'].every(k => new RegExp('\\b' + k + ': function \\(\\)').test(ot))
      && /if \(!z\.motto && !z\.fuer\) return 'fuer_wen';/.test(ot) && /GESCHENK_AUCH = \['hochzeit'\]/.test(ot) && /\[hidden\]\{display:none!important\}/.test(ot)
      && /location\.href = '\/otto\?w=' \+ encodeURIComponent\(text\)/.test(hn)
      && /stilSelbst \? 'stil' : 'stil_frage'/.test(og) && /schluessel: 'menge'/.test(og)); }
  // 6. Okt., live: Pruefung hielt "Hamburger Skyline" und den erfundenen "Harmstorf Brothers" fuer geschuetzt - kein Ausweg kam durch.
  { const sq = await fs.readFile('server.js', 'utf8');
    pruefe('Marken-Pruefung: Orte und selbst erfundene Gruppennamen zaehlen nicht, mehr Denk-Tiefe; Ausweg prueft die alten Namen gezielt, eigener Text zaehlt nicht',
      /Hamburger Skyline/.test(sq) && /Harmstorf Brothers/.test(sq) && /Im Zweifel NICHT nennen/.test(sq) && /\.\.\.GRUENDLICH\(\), messages: \[\{ role: 'system', content: GESCHUETZT_FINDEN \}/.test(sq) &&
      /Marke-Ausweg: noch drin/.test(sq) && /filter\(n => !\(eigen && flach\(eigen\)\.includes\(flach\(n\)\)\)\)/.test(sq)); }
  // 6. Okt., Markus: "Die Mikrofon-Seite auf der Startseite schneidet wieder bei den Woertern ab. Lass das doch bitte unbegrenzt
  // und ich hoffe, du hast auch die Text-KI dazu gemacht." Kein 400er-Limit mehr, Mikrofon hoert bis "Fertig", Text-KI danach.
  { const hn = await fs.readFile('home-neu.html', 'utf8'), ms = await fs.readFile('motto-seite.js', 'utf8'), sq = await fs.readFile('server.js', 'utf8'), mo = await fs.readFile('mottos.js', 'utf8');
    const fsj = JSON.parse(await fs.readFile('freestyle/motto-freestyle.json', 'utf8'));
    const motivMax = (fsj.fields || []).find(f => f.key === 'motiv').max;
    pruefe('Wunsch unbegrenzt + Text-KI: kein maxlength auf der Startseite, Mikrofon durchgehend (startet nach Pause neu), Server nimmt 5000 Zeichen, Freestyle-Feld 5000, voller Wunsch ins Freestyle, Text-KI kuerzt nicht',
      !/id="wunsch-text"[^>]*maxlength/.test(hn) && /rec\.continuous = true/.test(hn) && /if \(hoeren\) \{ vorher = /.test(hn) && /\/api\/mo\/text-glaetten/.test(hn) &&
      /feldWill/.test(ms) && /\/text-glaetten/.test(ms) && /cleanLong\(\(req\.body \|\| \{\}\)\.text, 5000\)/.test(sq) && /Math\.min\(\+max \|\| 700, 5000\)/.test(mo) &&
      motivMax === 5000 && /if \(m\.slug === 'freestyle'\) values\.motiv = cleanLong\(text, 5000\)/.test(sq) && /NICHTS kuerzen/.test(sq) && /neu\.length < text\.length \* 0\.6/.test(sq), 'motivMax ' + motivMax); }
  // 6. Okt., Markus: "Weiter ausschneiden bei den Kunden-Logos. Dort muessen wir so gut werden, dass alle Logos ...
  // selbstaendig so hinbekommen, dass es gut aussieht." Pruefstand (18 Faelle) -> logoFreistellen. Hier die Kernfaelle.
  {
    const IMl = await import('./images.js');
    const F = 'DejaVu Sans';
    const logo = async (inhalt, bg = '#fff') => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400"><rect width="800" height="400" fill="${bg}"/>${inhalt}</svg>`)).flatten({ background: '#fff' }).jpeg({ quality: 80 }).toBuffer();
    const alphaBei = async (buf, x, y) => { const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return data[(y * info.width + x) * 4 + 3]; };
    // Logo beruehrt den Rand (pinker Balken oben) - frueher frass cutout das ganze Logo
    const rand = (await IMl.logoFreistellen(await logo(`<rect x="0" y="0" width="800" height="90" fill="#E9166A"/><text x="400" y="260" font-family="${F}" font-weight="700" font-size="130" text-anchor="middle" fill="#E9166A">RAND</text>`))).png;
    // grosse Punzen (O, B) werden durchsichtig
    const ob = (await IMl.logoFreistellen(await logo(`<text x="400" y="330" font-family="${F}" font-weight="700" font-size="330" text-anchor="middle" fill="#000">OB</text>`))).png;
    // weisse Schrift im gelben Kreis bleibt weiss
    // (ein weisser Balken im Kreis liegt im unklaren Bereich - dort entscheidet live die Bildpruefung; hier antwortet sie 'weiss')
    let gefragtSun = 0;
    const sun = (await IMl.logoFreistellen(await logo(`<circle cx="400" cy="200" r="150" fill="#F6D33C"/><rect x="330" y="180" width="140" height="40" fill="#fff"/>`), { frage: async () => { gefragtSun++; return 'weiss'; } })).png;
    // weisse Flaeche MIT Inhalt (Kino) bleibt
    const kino = (await IMl.logoFreistellen(await logo(`<rect x="200" y="60" width="400" height="280" rx="20" fill="#111"/><rect x="250" y="110" width="300" height="180" fill="#fff"/><rect x="330" y="180" width="140" height="30" fill="#111"/>`))).png;
    // unklarer Fall: die Rueckfrage wird gestellt und ihre Antwort gilt (grosser Stern im Quadrat -> 'weiss')
    let gefragt = 0;
    const stern = (await IMl.logoFreistellen(await logo(`<rect x="250" y="50" width="300" height="300" rx="40" fill="#0D47A1"/><polygon points="400,110 425,180 500,180 440,225 462,295 400,252 338,295 360,225 300,180 375,180" fill="#fff"/>`), { frage: async () => { gefragt++; return 'weiss'; } })).png;
    const werte = { randBalken: await alphaBei(rand, 400, 40), randSchrift: await alphaBei(rand, 262, 200), randGrund: await alphaBei(rand, 400, 360),
      oLoch: await alphaBei(ob, 232, 230), sunWeiss: await alphaBei(sun, 400, 200), kinoWeiss: await alphaBei(kino, 280, 140), sternWeiss: await alphaBei(stern, 400, 210), gefragt, gefragtSun };
    const sq = await fs.readFile('server.js', 'utf8');
    pruefe('Kundenlogos: Logo am Rand bleibt ganz, Punzen werden durchsichtig, weisse Schrift im Kreis und weisse Flaeche mit Inhalt bleiben, unklare Loecher per Bildpruefung; beim Upload einmal freigestellt, Original bleibt liegen',
      werte.randBalken > 200 && werte.randSchrift > 200 && werte.randGrund === 0 && werte.oLoch === 0 && werte.sunWeiss > 200 && werte.kinoWeiss > 200 && werte.sternWeiss > 200 && gefragt >= 1 && gefragtSun >= 1 &&
      /logoFreistellen\(norm\.png, \{ frage: HAS_LLM \? logoLochFragen : null \}\)/.test(sq) && /'\.original\.png'\)\), norm\.png\)/.test(sq), JSON.stringify(werte));
  }
  // 6. Okt., Markus: "Sag Otto einfach, was du willst" sah "wie draufgeklatscht" aus - jetzt Ottos Sprechblase im Stil der Seite.
  { const hn = await fs.readFile('home-neu.html', 'utf8');
    pruefe('Startseite: Wunsch als Ottos Sprechblase (Otto-Bild, Blase mit Kontur, gruener .knopf), kein gruener Kasten mehr',
      /<img class="wunsch-otto" src="\/api\/mo\/otto\/nimmt-auf\.png"/.test(hn) && /class="wunsch-blase"/.test(hn) && /class="knopf wunsch-los" id="wunsch-los"/.test(hn) && /id="wunsch-text"/.test(hn) && /id="wunsch-mik"/.test(hn) && !/wunsch-box/.test(hn)); }
  { const ms = await fs.readFile('motto-seite.js', 'utf8');
    pruefe('Normales Motto mit Kissen: Server legt den Auftrag auf der Kissenflaeche an, Seite schickt artikelLink mit',
      /if \(!artikel && !motto\.freestyle && body\.artikelId\)[\s\S]{0,900}artikelLeinwand\(aid, fl\)[\s\S]{0,700}if \(a\.verfahren === 'sublimation'\) textile = 'weiss'/.test(srv) && (ms.match(/artikelLink\)? \|\| ''/g) || []).length >= 3); }

  // 3. Nichts, was Netz braucht, gehoert vor app.listen. Genau das hat den Server am Starten
  //    gehindert - Railway sah keinen Port und meldete einen Ausfall.
  const vorListen = srv.slice(0, srv.indexOf('app.listen'));
  const netzVorStart = [];
  for (const [, name] of vorListen.matchAll(/^await (originaleWiederherstellen|generateViaBallz|editViaBallz|pushToDrive)\(/gm)) netzVorStart.push(name);
  pruefe('kein Netz-Aufruf blockiert den Serverstart', !netzVorStart.length,
    netzVorStart.length ? netzVorStart.join(', ') + ' laeuft vor app.listen' : 'sonst antwortet der Server nie');

  // 4. Eine Route, die auf eine Bilderzeugung wartet, sieht im Browser aus wie ein toter Knopf.
  const langsameRouten = [];
  for (const d of jsDateien) {
    const t = await fs.readFile(d, 'utf8');
    for (const m of t.matchAll(/app\.post\('([^']+)'[\s\S]{0,120}?=> \{([\s\S]{0,2600}?)\n  \}\);/g)) {
      const [, pfad, koerper] = m;
      if (!/generateViaBallz|editViaBallz|vorlageBauen|consensusDesign\(/.test(koerper)) continue;
      const antwortetFrueh = /res\.json\([\s\S]{0,200}?(\(async|abarbeiten|ImHintergrund|runImport)/.test(koerper)
        || /(abarbeiten\(\)|ImHintergrund\([^)]*\));\s*\n\s*res\.json/.test(koerper)
        || /closePoll\(/.test(koerper);
      if (!antwortetFrueh) langsameRouten.push(d + ' ' + pfad);
    }
  }
  pruefe('keine Route laesst den Browser auf ein Bild warten', !langsameRouten.length,
    langsameRouten.length ? langsameRouten.join(' | ') : 'alles laeuft im Hintergrund');

  // 5. Ein Aufraeumen darf nie mehr kaputtmachen als der Schaden. Das Leeren des ganzen
  //    Mockup-Ordners hat hunderte gute Bilder mitgenommen.
  const grobesLoeschen = [];
  for (const d of [...jsDateien, 'server.js']) {
    const t = await fs.readFile(d, 'utf8');
    for (const m of t.matchAll(/for \(const f of await fs\.readdir\([^)]+\)\)\s*\{([\s\S]{0,200}?)\}/g)) {
      if (/fs\.rm/.test(m[1]) && !/if \(/.test(m[1])) grobesLoeschen.push(d);
    }
  }
  pruefe('kein Massenloeschen ohne Filter', !grobesLoeschen.length, grobesLoeschen.join(', '));

  // 6. Ein Platzhalter, der wie ein Wert aussieht, wird fuer einen gehalten. Markus hielt den
  //    grauen Text "39,90" fuer einen von mir eingetragenen Preis.
  const falschePlatzhalter = [];
  for (const m of admin.matchAll(/placeholder="([^"]{1,40})"/g)) {
    if (/^[0-9]+([.,][0-9]+)?$/.test(m[1]) || /^https?:\/\/[a-z]/i.test(m[1])) falschePlatzhalter.push(m[1]);
  }
  pruefe('kein Platzhalter sieht aus wie ein eingetragener Wert', !falschePlatzhalter.length,
    falschePlatzhalter.length ? falschePlatzhalter.join(', ') : 'sonst haelt man ihn fuer eine Eingabe');
}

// ---------------------------------------------------------------------------- 4 · Stile
async function pruefeStile() {
  abschnitt(4, 'Stile: vorhanden und unterscheidbar?');
  const waehlbar = STYLE_KEYS.filter(k => k !== 'standard');
  const leer = waehlbar.filter(k => !STYLES[k].text || STYLES[k].text.length < 200);
  pruefe('jeder waehlbare Stil hat einen Text', !leer.length, leer.join(', '));
  const ohneLabel = STYLE_KEYS.filter(k => !STYLES[k].label);
  pruefe('jeder Stil hat einen Namen', !ohneLabel.length, ohneLabel.join(', '));
  // 2. Okt., Markus: "einmal Glitter, alles voll mit Glitzer, und einmal Disco, wirklich wie in den
  // Siebzigern, mit Spiegelkugeln". Beide waehlbar, fuer dunkles Textil, mit Kachel,
  // und im Partner-Shop waehlbar. Die Partner-Vorgabe (EAST26, Luigi): Aquarell, Meisterwerk, Minimal, Pop Art.
  {
    const PA = await import('./partner.js');
    const bild = async (p) => { const m = await sharp(p).metadata().catch(() => null); return m ? m.width + 'x' + m.height : 'fehlt'; };
    const neu = {};
    for (const k of ['glitzer', 'disco']) neu[k] = { text: !!(STYLES[k] && STYLES[k].text), textil: textilFuerStil(k), kachel: await bild('stile/kacheln/' + k + '.jpg'), shop: PA.SHOP_STILE.includes(k) };
    pruefe('Glitzer und Disco: Stiltext aus dem Material (Flocken, Spiegelplaettchen), dunkles Textil, Kachel 800 x 800, im Partner-Shop',
      Object.values(neu).every(v => v.text && v.textil === 'dunkel' && v.kachel === '800x800' && v.shop)
        && /COARSE, not fine/.test(STYLES.glitzer.text) && /HARD-CONTRASTED/.test(STYLES.glitzer.text) && !/tiny flat flakes/.test(STYLES.glitzer.text) && /mirror ball built from hundreds of small square mirror tiles/.test(STYLES.disco.text) && /not disco/.test(STYLES.disco.text),
      JSON.stringify(neu));
    pruefe('Partner-Vorgabe: Aquarell, Meisterwerk, Glitzer, Pop Art - vier Stile', PA.STANDARD_STILE.join() === 'aquarell,meisterwerk,glitzer,popart' && PA.MAX_STILE === 4 && PA.stileSauber(undefined).length === 4, PA.STANDARD_STILE.join());
  }

  // Zwei Stile, die sich woertlich gleichen, liefern gleiche Bilder - genau so waren
  // Street Art und Graffiti nicht auseinanderzuhalten.
  const folgen = (t, n = 5) => {
    const w = String(t || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
    const s = new Set();
    for (let i = 0; i + n <= w.length; i++) s.add(w.slice(i, i + n).join(' '));
    return s;
  };
  const sets = {}; for (const k of waehlbar) sets[k] = folgen(STYLES[k].text);
  const zuAehnlich = [];
  for (let i = 0; i < waehlbar.length; i++) for (let j = i + 1; j < waehlbar.length; j++) {
    const a = sets[waehlbar[i]], b = sets[waehlbar[j]];
    let g = 0; for (const x of a) if (b.has(x)) g++;
    if (g >= 5) zuAehnlich.push(`${STYLES[waehlbar[i]].label}/${STYLES[waehlbar[j]].label}: ${g} gleiche Stellen`);
  }
  pruefe('keine zwei Stile mit fuenf oder mehr gleichen Formulierungen', !zuAehnlich.length, zuAehnlich.join(' | '));

  // ---- Hell oder dunkel: entschieden, nicht zurueckgefallen ----
  // 23. Sept., Markus: "Wenn du doch ein Design selber erstellst, musst du auch wissen, ob du
  // es fuer hell oder dunkel gemacht hast - ist doch alles ganz einfach." Vorher: von 17 Stilen
  // hatte genau EINER (Aquarell) ein helles Textil, alle anderen fielen auf den Standardwert
  // 'dunkel'. Das sah man keinem Bild an, aber jedem Shirt.
  const tab = stilTextilTabelle();
  const ohneTextil = tab.filter(s => !s.textil);
  pruefe('jeder waehlbare Stil hat ein entschiedenes Textil', !ohneTextil.length,
    ohneTextil.length ? ohneTextil.map(s => s.label).join(', ') : `${tab.length} Stile`);
  for (const s of tab) {
    pruefe(`${s.label} empfiehlt ${s.textil === 'hell' ? 'helles' : 'dunkles'} Textil`,
      textilFuerStil(s.key, 'dunkel') === s.textil && textilFuerStil(s.key, 'hell') === s.textil,
      'die Empfehlung des Stils haengt nicht vom Auftrag ab');
  }
  // 27. Sept., Markus (Screenshot: dunkles Textil gewaehlt, weisses Shirt bekommen): "Wichtig
  // ist natuerlich, wenn ein Textil gewaehlt ist, dass das dann auch beim Weiterschicken so
  // benutzt wird." Der Stil EMPFIEHLT (oben), der Kunde ENTSCHEIDET (hier): jeder gewaehlte Ton
  // kommt bei jedem Stil unveraendert durch. Nur ohne gueltigen Ton greift die Stil-Regel.
  for (const s of tab) {
    pruefe(`${s.label}: der gewaehlte Ton gilt, nicht die Empfehlung`,
      TEXTILTOENE.every(t => textilFuerAuftrag(s.key, t) === t),
      TEXTILTOENE.map(t => t + '->' + textilFuerAuftrag(s.key, t)).join(' '));
  }
  pruefe('ohne gewaehlten Ton greift die Stil-Regel (Comic -> weiss, Neon -> schwarz, Standard -> schwarz)',
    textilFuerAuftrag('comic', '') === 'weiss' && textilFuerAuftrag('neon', undefined) === 'schwarz'
    && textilFuerAuftrag('standard', 'egal') === 'schwarz');
  // ---- Wer traegt das Shirt? (vornamen.js) ----
  // 27. Sept., Markus ("Anne · 65" an einem Mann): "Am Namen ist zu erkennen, dass es sich um
  // eine Frau handelt. Dann sollte es auch als Frau als Beispiel kommen." Eindeutige Vornamen
  // werden erkannt, doppeldeutige bleiben bewusst offen, Umlaute und Doppelnamen stoeren nicht.
  {
    const st = vornamenStand();
    pruefe('Vornamen: beide Listen gefuellt', st.frauen >= 150 && st.maenner >= 150, JSON.stringify(st));
    const proben = [['Anne', 'frau'], ['Jürgen', 'mann'], ['Anna-Lena', 'frau'], ['Björn', 'mann'], ['anne', 'frau'], ['Anne und Paul', 'frau'],
      ['Kim', ''], ['Toni', ''], ['Alex', ''], ['', ''], ['65', ''], ['Motto Otto', '']];
    const falsch = proben.filter(([n, soll]) => werVomNamen(n) !== soll).map(([n, soll]) => `${n}: ${werVomNamen(n) || '(offen)'} statt ${soll || '(offen)'}`);
    pruefe('Vornamen: eindeutig erkannt, doppeldeutig offen gelassen', !falsch.length, falsch.join('; ') || `${proben.length} Proben`);
    // Die Bestellzettel fuer die Vorlagen: jedes getragene Textil hat die Situation dreimal
    // (allgemein, Frau, Mann), und der Satz unterscheidet sich NUR in der Person.
    for (const a of ['tee', 'polo', 'hoodie', 'zip']) {
      const v = VORLAGEN[a] || {};
      const ok = ['szene', 'szene-frau', 'szene-mann'].every(k => typeof v[k] === 'function');
      const s0 = ok ? v.szene('white') : '', s1 = ok ? v['szene-frau']('white') : '', s2 = ok ? v['szene-mann']('white') : '';
      pruefe(`Vorlage ${a}: Situation als Person, Frau und Mann - nur die Person wechselt`,
        ok && s1.startsWith('A woman') && s2.startsWith('A man') && s0.startsWith('A person')
        && s1.slice('A woman'.length) === s2.slice('A man'.length) && s0.slice('A person'.length) === s1.slice('A woman'.length),
        ok ? '' : 'Bestellzettel fehlt');
    }
    pruefe('Flachware hat keine Situation mit Person', !['poster', 'kissen', 'tasse'].some(a => VORLAGEN[a] && VORLAGEN[a]['szene-frau']));
  }
  // Es darf keine Einbahnstrasse werden: waeren alle Stile dunkel, haetten wir nur den alten
  // Zustand mit mehr Code. Beide Stoffe muessen wirklich vorkommen.
  const hell = tab.filter(s => s.textil === 'hell').length;
  pruefe('beide Textilien kommen vor', hell > 0 && hell < tab.length,
    `${hell} hell, ${tab.length - hell} dunkel`);
  // Ohne Stilvorgabe entscheidet weiter das Motto - sonst waere "Wie vorgesehen" wertlos.
  pruefe('ohne Stil entscheidet das Motto', textilFuerStil('standard', 'hell') === 'hell'
    && textilFuerStil('standard', 'dunkel') === 'dunkel');
  // Stile, die nur zu einem Motto gehoeren (nurMotto), werden vollflaechig gedruckt - dort gibt es
  // gar keinen Stoff, der durchscheinen koennte. Sie duerfen deshalb KEINE Textilentscheidung tragen.
  for (const k of STYLE_KEYS.filter(k => STYLES[k].nurMotto)) {
    pruefe(`${STYLES[k].label} traegt keine Textilentscheidung (vollflaechig)`,
      !tab.some(s => s.key === k));
  }
  // ---- Die Schrift des Namens: bestellt UND mitgeliefert ----
  // 23. Sept.: names.js bestellte 'Poppins', 'DejaVu Sans Condensed' und 'TeX Gyre Bonum'.
  // Keine davon war im Container installiert - das Dockerfile bringt kein Schriftpaket mit,
  // und in fonts/ lagen nur .woff2-Dateien, die fontconfig nicht liest. Jeder Name auf jedem
  // Shirt wurde also in einer Ersatzschrift gesetzt, und alle drei Kundenwahlen sahen gleich
  // aus. Eine Schrift, die nur bestellt und nicht mitgeliefert wird, faellt sonst niemandem auf.
  {
    const dateien = fsSync.readdirSync('fonts').filter(f => /\.(ttf|otf)$/i.test(f));
    const ohneDatei = [];
    for (const [key, f] of Object.entries(NAME_FONTS)) {
      const kern = f.family.replace(/\s+/g, '');
      if (!dateien.some(d => d.replace(/[-_].*$/, '').toLowerCase() === kern.toLowerCase()
        || d.toLowerCase().startsWith(kern.toLowerCase()))) ohneDatei.push(`${key} (${f.family})`);
    }
    pruefe(`jede Namensschrift liegt als Datei im Repo (${dateien.length} gefunden)`,
      !ohneDatei.length, ohneDatei.join(', '));
    // Und fontconfig muss den Ordner ueberhaupt kennen - sonst liegen sie da und werden nie gelesen.
    const fc = fsSync.readFileSync('fonts.conf', 'utf8');
    pruefe('fontconfig kennt den Schriftordner', /<dir>\/app\/fonts<\/dir>/.test(fc));
    pruefe('fontconfig behaelt die Systemschriften als Rueckfall', /<dir>\/usr\/share\/fonts<\/dir>/.test(fc));
    // Jeder Stil, der eine eigene Schrift bestellt, muss eine bestellen, die es gibt.
    const falsch = Object.entries(STIL_SCHRIFT).filter(([k, v]) => !STYLES[k] || !NAME_FONTS[v]);
    pruefe(`jeder Stil mit eigener Namensschrift zeigt auf eine echte (${Object.keys(STIL_SCHRIFT).length})`,
      !falsch.length, falsch.map(([k, v]) => `${k}->${v}`).join(', '));
    // Der Stil schlaegt die Kundenwahl - sonst steht unter einem 70er-Siebdruck wieder ein Grotesk.
    pruefe('der Stil schlaegt die Kundenwahl', schriftFuerStil('vintage', 'rund') === 'slab'
      && schriftFuerStil('neon', 'serif') === 'techno');
    pruefe('ohne Stil gilt die Kundenwahl', schriftFuerStil('', 'serif') === 'serif'
      && schriftFuerStil('standard', 'schmal') === 'schmal');
  }

  // ---- Die Schrift darf nicht zuwachsen ----
  // 23. Sept., Markus zum Meisterwerk-Shirt: "Jetzt hast du leider die Schrift zu gezeichnet,
  // schau dir erst noch mal an oben." Die Regel hatte die Buchstaben zwar gemalt, aber nicht
  // gesagt WIE VIEL - das Modell legte ein volles Wirbelfeld in jeden Buchstaben, und die
  // Sonnenstrahlen liefen hinter "FREIHEIT" durch. Gemessen im "L" von LETZTE: die Streuung
  // in der Fuellung fiel von 8,3 auf 3,8, die Helligkeitsspanne von 12-83 auf 16-63.
  // Ein gemalter Stil ohne Mengenangabe fuellt den Buchstaben immer bis zum Anschlag.
  {
    const t = STYLES.meisterwerk.text;
    pruefe('Meisterwerk nennt seine drei Quellen', /VAN GOGH/.test(t) && /PICASSO/.test(t) && /KLIMT/.test(t));
    // Zwei Gegenpole, beide muessen dastehen: gestalten JA, zutexturieren NEIN.
    // Markus zuerst: "Jetzt hast du leider die Schrift zu gezeichnet." Dann, als die
    // Buchstaben flach waren: "Wieso ist bei dem Meisterwerk die Schrift immer klar,
    // damit kann man doch spielen - genau da, diese Facetten oder wie Gustav Klimt das
    // gemacht hat oder Picasso oder van Gogh." Der Unterschied ist nicht Farbe ja/nein,
    // sondern GROSSE GEWOLLTE FORMEN statt feiner Textur.
    // Zaehlbar statt beschreibend: "a thick stroke BREAKS into facets" hat das Modell
    // ueberlesen, "AT LEAST THREE letters are cut by ONE straight diagonal" ist pruefbar.
    pruefe('Meisterwerk fordert das Spiel mit den Buchstaben in Stueckzahlen',
      /AT LEAST THREE letters are cut/.test(t) && /AT LEAST ONE letter per line is solid flat gold/.test(t));
    pruefe('Meisterwerk verbietet beides: glatte Buchstaben UND feine Textur',
      /a line of plain even letters is WRONG/.test(t) && /drawn shut and equally WRONG/.test(t));
    pruefe('Meisterwerk haelt den Buchstaben lesbar',
      /THE LETTER MUST STILL READ/.test(t) && /one hard clean outer edge/.test(t));
    pruefe('Meisterwerk laesst nichts hinter der Schrift durchlaufen',
      /NOTHING PASSES BEHIND THE LETTERING/.test(t));
    pruefe('Meisterwerk bleibt unter der Kuerzungsgrenze von 2000 Zeichen',
      t.length <= 2000, `${t.length} Zeichen`);
    // Und der Schlusssatz darf die Regel nicht wieder aufweichen.
    pruefe('der Schlusssatz von Meisterwerk nennt die Schrift mit, ohne sie zuzumalen',
      /the lettering too/.test(STYLES.meisterwerk.satz)
      && /keep only the outer edge hard/.test(STYLES.meisterwerk.satz)
      && !/letters are painted like everything else/.test(STYLES.meisterwerk.satz));
  }

  // ---- Die Namensliste auf der Rueckseite: gemessen, nicht geglaubt ----
  // 23. Sept., Markus: "Zeige mir eine Rueckseite von Abi mit 20 Namen." Dabei kam heraus, dass
  // die Liste seit jeher kaputt war. Sie stauchte lange Namen mit textLength auf die
  // Spaltenbreite - und librsvg setzt textLength NICHT um (gemessen: bestellt 405 px, gerendert
  // ueber 1024 px). Die Namen liefen also in voller Breite weiter, ueberlappten die Nachbarspalte
  // und wurden am Rand abgeschnitten. Dazu begann die Liste bei festen 38 Prozent, obwohl das
  // Motiv bis 53 Prozent hinunterreichte - drei Zeilen lagen darauf. Beides wird jetzt gemessen.
  // Hier der Gegenbeweis: ein Motiv, das absichtlich zu weit hinunterreicht, und 20 lange Namen.
  {
    const W = 1024, H = 1536;
    const motivH = Math.round(H * 0.55);
    const master = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{
        input: await sharp({ create: { width: Math.round(W * 0.9), height: motivH, channels: 4, background: { r: 20, g: 60, b: 90, alpha: 255 } } }).png().toBuffer(),
        left: Math.round(W * 0.05), top: 0
      }]).png().toBuffer();
    const namen = ['Maximiliane Schwarzenbach', 'Jonas Weber', 'Mia Schroeder', 'Tim Hoffmann',
      'Sophie Krueger', 'Luca Bergmann', 'Emma Lindner', 'Nils Kaufmann', 'Hannah Vogt',
      'Paul Reinhardt', 'Clara Neumann', 'Ben Ziegler', 'Marie Faber', 'Erik Sommer',
      'Lea Wagner', 'Finn Dietrich', 'Nora Albrecht', 'Jan Koehler', 'Pia Engelhardt', 'Moritz Sander'];
    const fertig = await renderNameList(master, namen, { font: 'rund', style: 'vintage', textile: 'hell' });
    const { data, info } = await sharp(fertig).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const deckend = (x, y) => data[(y * info.width + x) * 4 + 3] > 40;
    let amRand = 0;
    for (let y = 0; y < info.height; y++) { if (deckend(0, y)) amRand++; if (deckend(info.width - 1, y)) amRand++; }
    pruefe('Namensliste: kein Name wird am Rand abgeschnitten', amRand === 0, amRand + ' Randpixel');
    // Zwischen Motiv und erster Namenszeile muss eine echte Luecke liegen.
    const vollZeile = (y) => { for (let x = 0; x < info.width; x++) if (deckend(x, y)) return true; return false; };
    // Erst den Anfang des Motivs suchen - oben liegt ein leerer Rand, der sonst als "Luecke"
    // durchgeht. Dann das Ende des Motivs, dann die erste Namenszeile.
    let motivAb = -1, luecke = -1, ersteZeile = -1;
    for (let y = 0; y < info.height; y++) if (vollZeile(y)) { motivAb = y; break; }
    if (motivAb >= 0) for (let y = motivAb; y < info.height; y++) if (!vollZeile(y)) { luecke = y; break; }
    if (luecke > 0) for (let y = luecke; y < info.height; y++) if (vollZeile(y)) { ersteZeile = y; break; }
    pruefe('Namensliste: zwischen Motiv und erster Zeile liegt eine Luecke',
      luecke > 0 && ersteZeile > luecke,
      ersteZeile > 0 ? 'Motiv bis ' + Math.round(luecke / H * 100) + ' %, erste Zeile bei ' + Math.round(ersteZeile / H * 100) + ' %' : 'keine Luecke');
    // textLength darf nicht zurueckkommen - librsvg ignoriert es, das war die Ursache.
    const nm = fsSync.readFileSync('names.js', 'utf8');
    // librsvg ignoriert textLength - wo es steht, laeuft der Text ungebremst weiter. renderName()
    // darf es behalten: dort wird zusaetzlich die Schriftgroesse gesenkt und hinterher gemessen.
    // Kommentarzeilen zaehlen nicht mit - sie zitieren die alte Zeile absichtlich, damit man
    // beim Lesen versteht, was hier frueher stand und warum es weg ist.
    const ohneKommentar = (t) => t.split('\n').filter(z => !/^\s*(\/\/|\*)/.test(z)).join('\n');
    const stueck = (von, bis) => ohneKommentar(nm.slice(nm.indexOf(von), nm.indexOf(bis)));
    pruefe('die Namensliste verlaesst sich nicht auf textLength',
      !/textLength/.test(stueck('export async function renderNameList', 'export async function renderNameImMotiv')));
    pruefe('die Kaderliste verlaesst sich nicht auf textLength',
      !/textLength/.test(stueck('export async function renderRoster', 'export async function renderChest')));
  }

  // ---- Die Rueckseite ist ein eigenes Design, keine Wiederholung ----
  // 23. Sept., Markus: "Das Rueckseite-Design darf ruhig ein bisschen fetziger sein, nicht nur
  // einfach das Motiv von vorne obendrueber gelegt. Da muessen wir uns schon was einfallen
  // lassen." Vorher stand im backPrompt woertlich: "Reuse one clear signature element from the
  // front motif AT THE TOP ... Keep it to the upper part of the canvas." Das war die Anweisung
  // zur Wiederholung. Jetzt ist es eine Tour-Poster-Rueckseite, bei der die Namensliste der
  // Hauptdarsteller ist und das Motiv sie rahmt.
  {
    // WICHTIG: geprueft wird seed.json, nicht storage/mottos/abi.json. Beim Serverstart
    // schreibt der Seed die Motto-Datei neu (seedRev) - eine Aenderung nur in der Datei ist
    // beim naechsten Deploy wieder weg. Genau das ist mir am 23. Sept. passiert: der neue
    // backPrompt stand in der Datei, der Boot der Abnahme hat ihn ueberschrieben.
    const seedAlle = JSON.parse(fsSync.readFileSync('seed.json', 'utf8'));
    const seedAbi = seedAlle.find(m => m.slug === 'abi');
    const bp = String((seedAbi || {}).backPrompt || '');
    pruefe('die Rueckseite steht im Seed, nicht nur in der Motto-Datei', !!seedAbi && !!bp);

    // 23. Sept., Markus: "Schulausflug, Meisterfeier, Firmenausflug - ueberall dort, wo Namen
    // eingetragen werden koennen, und natuerlich auf Wunsch auch bei Freestyle."
    // Vorher hing die Rueckseite an motto.backPrompt, und den hatte genau EIN Motto.
    const mitListe = seedAlle.filter(m => (m.fields || []).some(f => f.key === 'namen'));
    const ohneWunsch = mitListe.filter(m => !(m.fields || []).some(f => f.key === 'rueckseite'));
    pruefe(`jedes Motto mit Namensliste bietet die Rueckseite an (${mitListe.length})`,
      !ohneWunsch.length, ohneWunsch.map(m => m.slug).join(', '));
    for (const slug of ['schulmotto', 'meister-shirt', 'firmenausflug', 'freestyle']) {
      const m = seedAlle.find(x => x.slug === slug);
      pruefe(`${slug}: Namensliste und Rueckseiten-Wunsch vorhanden`,
        !!m && (m.fields || []).some(f => f.key === 'namen') && (m.fields || []).some(f => f.key === 'rueckseite'));
    }
    // Der Prompt wird gebaut, nicht getippt - sonst ist jedes neue Motto eine Stelle zum Vergessen.
    for (const slug of ['schulmotto', 'meister-shirt', 'firmenausflug']) {
      const m = seedAlle.find(x => x.slug === slug);
      const gebaut = rueckseitePrompt(m);
      pruefe(`${slug}: Rueckseiten-Prompt wird aus den Feldern gebaut`,
        /MIDDLE STAYS COMPLETELY EMPTY/.test(gebaut) && /LEFT and RIGHT/.test(gebaut));
      // 23. Sept., Markus zum Firmenausflug: "Links und rechts neben der Jahreszahl ist das
      // Edelweiss. Das koennte man auf dem Ruecken zwischen oben und unten auch noch
      // verwenden, anstatt den anderen Rahmen." Vorher stand im Prompt eine Wunschliste
      // (Streifen, Sterne, Lorbeer, Nieten) - und das Modell hat sich daraus bedient, statt
      // die Vorderseite anzusehen. Zum Bergmotiv mit Edelweiss kam ein Lorbeerkranz.
      pruefe(`${slug}: die Seitenleisten kommen von der Vorderseite, nicht aus der Wunschliste`,
        /SMALL SIGNATURE ELEMENT THAT ALREADY APPEARS ON THE FRONT/.test(gebaut)
        && /Do NOT invent a generic frame/.test(gebaut));
      pruefe(`${slug}: der Abschluss nennt die Felder sauber ("showing X and Y")`,
        !/showing "[^"]*" showing/.test(gebaut));
    }
    // 23. Sept., Markus: "nur dass vorne und hinten verschiedene Farben sind, ist natuerlich
    // doof." Gemessen am Firmenausflug: vorne 36 % Navy und KEIN Gold, hinten 14 % Gold und
    // nur 5 % Navy. Der Stil College laesst "navy and gold ODER maroon and cream" zu - also
    // hat das Modell zweimal unabhaengig gewaehlt. "Same palette as the front" reicht nicht;
    // es braucht Zahlenwerte.
    {
      const vorne = [
        { name: 'navy', r: 0x11, g: 0x28, b: 0x44, share: 0.36 },
        { name: 'cream', r: 0xf4, g: 0xe8, b: 0xc9, share: 0.21 },
        { name: 'grey', r: 0x7e, g: 0x82, b: 0x82, share: 0.17 }
      ];
      const pal = palettePrompt(vorne);
      pruefe('die Palette nennt echte Farbwerte, keine Absichtserklaerung',
        /#112844/.test(pal) && /#f4e8c9/.test(pal) && /EXACTLY these colours and NO others/.test(pal));
      pruefe('die Palette verbietet ausdruecklich neue Farben', /Introduce NO new colour/.test(pal));
      // Zu wenig gemessen? Dann lieber gar keine Vorgabe als eine falsche.
      pruefe('ohne brauchbare Messung bleibt die Palette leer',
        palettePrompt([]) === '' && palettePrompt([vorne[0]]) === '');
      const srvP = fsSync.readFileSync('server.js', 'utf8');
      pruefe('die Rueckseite bekommt die Palette der fertigen Vorderseite',
        /palette = palettePrompt\(await dominantColors\(png\)\)/.test(srvP));
    }

    // Und sie darf NIE ungefragt kommen - sie kostet einen zweiten kompletten Bildlauf.
    const srv0 = fsSync.readFileSync('server.js', 'utf8');
    pruefe('die Rueckseite kommt nur auf ausdruecklichen Wunsch',
      /const gewuenscht = \/\^\(ja\|yes\|1\|true\|on\)/.test(srv0)
      && /rueckseiteMoeglich = !!rueckText && hatNamensliste\(motto\) && gewuenscht/.test(srv0));
    pruefe('die Rueckseite bestellt kein Motiv "oben drueber"',
      !/Keep it to the upper part/i.test(bp) && !/signature element from the front motif at the top/i.test(bp));
    pruefe('die Rueckseite haelt die Mitte fuer die Namen frei', /MIDDLE STAYS COMPLETELY EMPTY/i.test(bp));
    pruefe('die Rueckseite bekommt einen Rahmen statt einer Wiederholung',
      /LEFT and RIGHT/i.test(bp) && /BOTTOM/i.test(bp) && /TOP/i.test(bp));
    // Und die Zonen-Ansage darf dem nicht widersprechen - sie hat frueher genau die Bauform
    // verboten, die der neue Entwurf bestellt.
    const zone = nameListZonePrompt();
    pruefe('die Zonen-Ansage verbietet den Rahmen nicht',
      /corridor/i.test(zone) && !/lower 60 percent/i.test(zone) && !/only in the upper 40 percent/i.test(zone));
    // Die Rueckseite muss dieselbe Rechtschreibhuerde haben wie die Vorderseite.
    const srv = fsSync.readFileSync('server.js', 'utf8');
    const ab = srv.indexOf('const backPrompt = buildPrompt');
    const bis = srv.indexOf('job.back = { names: backNames');
    const stueck = srv.slice(ab, bis);
    pruefe('die Rueckseite wird auf Rechtschreibung geprueft', /textQA\(/.test(stueck));
    pruefe('die Rueckseite darf nachzeichnen, wenn der Text nicht stimmt', /versuch <= 2/.test(stueck));
    pruefe('die Namensliste der Rueckseite kennt den Stil', /renderNameList\(backBase, backNames, \{ font: nameFont, style,/.test(stueck));
  }

  // Und die Mottoseite muss die Tabelle wirklich benutzen, statt sie noch einmal zu tippen.
  const seite = fsSync.readFileSync('motto-seite.js', 'utf8');
  pruefe('die Mottoseite liest das Textil vom Stil', /function stilTextil\(/.test(seite));
  // Nur eine echte Deklaration am Zeilenanfang zaehlt - der Kommentar daneben zitiert die alte
  // Zeile absichtlich, damit man beim Lesen versteht, was hier frueher stand.
  pruefe('die Mottoseite hat keine handgetippte Stilliste mehr', !/^\s*var NUR_HELL\s*=/m.test(seite));

  // ---- Die vier Toene muessen auch beim Kunden ankommen -----------------------------
  const html = fsSync.readFileSync('motto.html', 'utf8');
  const kacheln = [...html.matchAll(/data-x="(weiss|hell|dunkel|schwarz)"/g)].map(m => m[1]);
  // Vier Kacheln, und jede bewirkt etwas (siehe die Prompt-Pruefungen oben). Kurz standen
  // hier zwei - das war zu wenig: ein sandfarbenes oder navyblaues Shirt gibt es wirklich,
  // und dafuer sind die Regeln fuer Reinweiss bzw. Reinschwarz schlicht falsch.
  pruefe('der Kunde kann alle vier Textiltoene waehlen',
    TEXTILTOENE.every(t => kacheln.includes(t)) && kacheln.length === 4,
    kacheln.join(', ') || 'keine Kachel gefunden');
  pruefe('bei einer Buntfarbe steht ein Hinweis zur Vorschau',
    /function vorschauHinweis\(/.test(seite) && /textil-vorschau/.test(html));
  pruefe('die Mottoseite kennt die vier Toene', /var TEXTILTOENE = \['weiss', 'hell', 'dunkel', 'schwarz'\]/.test(seite));
  // 27. Sept., Markus: "wenn ein Textil gewaehlt ist, dass das dann auch beim Weiterschicken so
  // benutzt wird." Ein Stil sperrt KEINE Kachel mehr und stellt eine getroffene Wahl nicht um:
  // er belegt nur vor, solange der Kunde noch nichts angetippt hat (textilSelbstGewaehlt).
  pruefe('ein Stil sperrt keine Textilkachel und stellt eine getroffene Wahl nicht um',
    !/b\.disabled = aus/.test(seite)
    && /if \(gehoert && !textilSelbstGewaehlt && tonGruppe\(textile\) !== tonGruppe\(gehoert\)\) textilSetzen/.test(seite)
    && /textilSelbstGewaehlt = true;/.test(seite));
  // Der Hinweis unter den Kacheln sagt beides: was der Stil empfiehlt, und dass die eigene Wahl gilt.
  pruefe('der Textil-Hinweis nennt die eigene Wahl, wenn sie von der Empfehlung abweicht', /dann zeichnet Otto daf/.test(seite));

  // ---- Die Messung darf nicht wieder tote Leitung werden ---------------------------
  // weisseFlaeche() und pruefeSchwarzflaechen() lagen seit Fassung 65 fertig in images.js und
  // wurden von nirgendwo aufgerufen. Gebaut und nie angeschlossen faellt niemandem auf.
  const srvAll = fsSync.readFileSync('server.js', 'utf8');
  pruefe('die Stofffarbe der fertigen Datei wird wirklich gemessen',
    /await weisseFlaeche\(cand\)/.test(srvAll) && /await pruefeSchwarzflaechen\(cand/.test(srvAll));
  pruefe('gemessen wird, aber nichts aus der Datei gestanzt',
    !/weissflaechenFreistellen/.test(srvAll));
  // Deckung: der Fund vom 25. Sept. Ein Motiv kann halbdurchsichtig gemalt sein - in der
  // Vorschau auf schwarzem Grund sieht das satt aus, im Druck kommt es milchig. Gemessen:
  // gesunde Dateien 92-99 %, ein gewollt weiches Aquarell 85 %, die kaputten 37-59 %.
  const bilder = fsSync.readFileSync('images.js', 'utf8');
  pruefe('die Druckdatei wird auf Deckung gemessen', /befund\.deckungProzent = sichtbar/.test(bilder));
  pruefe('ein halbdurchsichtig gemaltes Motiv faellt durch',
    /deckungProzent < 75/.test(bilder) && /druckt milchig/.test(bilder));
  // Sublimation kennt keine weisse Farbe - das Weiss ist immer der Traeger selbst.
  pruefe('Sublimation rechnet mit reinem Weiss, UV weiter mit hell',
    /a\.verfahren === 'sublimation'\) textile = 'weiss'/.test(srvAll));
  // Schwarz aus der Datei rechnen ist nur auf REINEM Schwarz richtig.
  pruefe('Schwarz wird nur auf reinem Schwarz herausgerechnet',
    /textilTon\(i\.textile\) === 'schwarz'/.test(srvAll));
  // Die Wahl des Kunden darf nicht unterwegs umgebogen werden: wer eine Buntfarbe waehlt,
  // bekommt die Buntfarben-Regel und nicht die fuer Reinweiss bzw. Reinschwarz.
  pruefe('alle vier Toene kommen unveraendert beim Prompt an',
    !/TON_ALT/.test(srvAll) && /const textilGewaehlt = TEXTILTOENE\.includes\(textile\);/.test(srvAll)
    && /if \(!textilGewaehlt\) textile = 'schwarz';/.test(srvAll));
  // 27. Sept.: ... und der Stil biegt sie in runJob nicht mehr um. Die Wahl steht im Auftrag
  // (textilGewaehlt), runJob fragt textilFuerAuftrag - nie mehr textilFuerStil direkt.
  pruefe('runJob zeichnet auf dem gewaehlten Ton, der Stil entscheidet nur ohne Wahl',
    /textilFuerAuftrag\(style, job\.input\.textilGewaehlt === false \? '' : textilWunsch\)/.test(srvAll)
    && !/const textile = textilFuerStil\(/.test(srvAll)
    && /textilGewaehlt: textilGewaehlt \|\| !!\(artikel && artikel\.verfahren !== 'dtf'\)/.test(srvAll));
  // 30. Sept., Markus: "eine Nachricht, wenn jemand ein Design erstellt hat" - eine Mail an
  // ADMIN_EMAIL je fertigem Kundendesign, auf beiden Wegen zum Status 'done' (Warteschlange und
  // Wiederaufnahme nach Neustart), nie fuer Vorzeige/Automatik/Pruefstand, abschaltbar.
  pruefe('jedes fertige Kundendesign meldet sich beim Chef (Mail), Vorzeige und Pruefstand nicht',
    /async function meldeChef\(job\)/.test(srvAll)
    && (srvAll.match(/meldeChef\(job\);/g) || []).length >= 2
    && /job\.vorzeige \|\| job\.auto \|\| job\.test/.test(srvAll)
    && /env\.DESIGN_MAIL \|\| 'an'/.test(srvAll) && /env\.DESIGN_MAIL_AN \|\| env\.ADMIN_EMAIL/.test(srvAll)
    && /job\.chefGemeldet = true/.test(srvAll));
  // Die Getragen-Ansicht zeigt die Person zum Namen, wenn die Vorlage dafuer daliegt.
  pruefe('die Mockup-Route fragt, wer das Shirt traegt, und nimmt die Person in den Dateinamen',
    /const wer = szene \? await werFuerMockup\(jobT, garment, color\) : '';/.test(srvAll)
    && /\(wer \? '_' \+ wer : ''\)/.test(srvAll) && /wer: wer \|\| undefined/.test(srvAll)
    && /szeneVarianteDa\(garment, color, wer\)/.test(srvAll));
}

// ---------------------------------------------------------------------------- 5 · Versprechen
async function pruefeVersprechen() {
  abschnitt(5, 'Versprechen: stimmen die Zahlen auf der Seite mit dem Code?');
  const home = await fs.readFile('home.html', 'utf8');
  const konto = await fs.readFile('konto.html', 'utf8');
  const recht = await fs.readFile('rechtliches.js', 'utf8');

  // Anzahl waehlbarer Stile - steht als Wort auf der Startseite
  const zahl = { 10: 'zehn', 11: 'elf', 12: 'zwoelf', 13: 'dreizehn', 14: 'vierzehn', 15: 'fuenfzehn', 16: 'sechzehn', 17: 'siebzehn', 18: 'achtzehn' };
  // Stile, die nur zu einem Motto gehoeren (nurMotto), zaehlt die Startseite nicht mit.
  const n = STYLE_KEYS.filter(k => k !== 'standard' && !STYLES[k].nurMotto && !STYLES[k].off).length;
  const wort = (zahl[n] || String(n)).replace('zwoelf', 'zwölf').replace('fuenfzehn', 'fünfzehn');
  pruefe(`Startseite nennt ${wort} Stile`, home.includes('in ' + wort + ' Stilen'),
    `Code hat ${n} waehlbare Stile`);

  // Kostenlose Entwuerfe: ohne Konto und mit Konto
  pruefe('Startseite verspricht keine fuenf Entwuerfe OHNE Konto', !/Fünf Entwürfe kostenlos<\/b><\/span><span>[^<]*<\/span><span>ohne Konto/.test(home),
    `GUEST_FREE = ${GUEST_FREE}`);
  pruefe('Startseite nennt den ersten Entwurf ohne Konto', /[Ee]rste[rn]? Entwurf ohne Konto/.test(home));

  // Preise: EINE Wahrheit in PLANS, davon abgeleitet AGB und Konto-Seite
  const eur = (c) => (c / 100).toFixed(0);
  for (const [key, p] of Object.entries(PLANS)) {
    if (!p.cents || !p.designs) continue;
    const inAgb = recht.includes(`${p.designs} Designs im Monat für ${eur(p.cents)} €`);
    pruefe(`AGB nennt ${p.designs} Designs fuer ${eur(p.cents)} €`, inAgb, key);
    const inKonto = konto.includes(`${eur(p.cents)} € / Monat`);
    pruefe(`Konto-Seite nennt ${eur(p.cents)} € / Monat`, inKonto, key);
  }
  pruefe('AGB nennt die kostenfreien Designs je Konto', recht.includes(`ersten fünf Designs je Konto`),
    `PLANS.free.designs = ${PLANS.free.designs}`);

  // ---- Preise: was gezeigt wird, muss einen Preis haben ----
  // 23. Sept.: Polo, Fussmatte, Handtuch, Mousepad, Hundedecke, Acrylbild, Tuerschild, Brett,
  // Napfunterlage, Gepaeckanhaenger und Brotdose hatten ein fertiges Mockup, standen im
  // Konfigurator - und listenpreis() gab fuer sie 0 zurueck. Das faellt niemandem auf, bis
  // die erste Bestellung ueber 0,00 Euro hereinkommt. Also von hier an gemessen.
  for (const key of Object.keys(MOCKUPS)) {
    if (MOCKUPS[key] && MOCKUPS[key].aus) continue;   // 1. Okt.: Schneidebrett raus, ueberall - kein Preis mehr noetig
    pruefe(`Artikel "${key}" hat einen Preis`, PREISE.listenpreis(key) > 0 || PREISE.hatStufen(key),
      PREISE.hatStufen(key) ? 'Textil mit drei Stufen' : PREISE.euro(PREISE.listenpreis(key)));
  }
  // Der Katalog benutzt eigene Schluessel (shopper, tshirt); die Bruecke zum Preis ist
  // ansichtVon(). Artikel ohne Ansicht haben noch kein Mockup - Aufgabe 71, und bis dahin
  // sind sie auch nicht bestellbar.
  for (const key of Object.keys(ARTIKEL)) {
    const ansicht = ansichtVon(key);
    if (!ansicht || ARTIKEL[key].ausserHandel) continue;   // 1. Okt.: Schneidebrett ausser Handel
    pruefe(`Katalogartikel "${key}" findet ueber "${ansicht}" seinen Preis`, PREISE.istBekannt(ansicht));
  }
  // Textilien brauchen alle drei Stufen - fehlt eine, faellt listenpreis() still auf
  // "liebling" zurueck und der Kunde zahlt fuer Deluxe den mittleren Preis.
  for (const [key, t] of Object.entries(PREISE.TEXTIL)) {
    for (const st of PREISE.STUFEN) {
      pruefe(`${t.label}: Stufe ${st.label} hat einen Preis`, t[st.key] > 0, PREISE.euro(t[st.key] || 0));
    }
  }
  // Netto ist abgeleitet, nicht getippt: netto + MwSt muss wieder brutto ergeben, sonst
  // steht auf der Firmenrechnung ein anderer Betrag als auf der Seite.
  {
    const r = PREISE.warenkorb([{ artikel: 'polo', stufe: 'liebling', menge: 25, zweiteSeite: true }], { netto: true });
    pruefe('Firmenansicht: netto + MwSt ergibt wieder brutto',
      PREISE.rund(r.gesamtNetto + r.mwst) === r.gesamt,
      `${PREISE.euro(r.gesamtNetto)} + ${PREISE.euro(r.mwst)} = ${PREISE.euro(r.gesamt)}`);
    pruefe('Firmenansicht: jeder Posten hat einen Nettopreis',
      r.posten.every(p => p.stueckNetto > 0 && p.stueckNetto < p.stueck));
    const priv = PREISE.warenkorb([{ artikel: 'polo', stufe: 'liebling', menge: 25, zweiteSeite: true }]);
    pruefe('Privatansicht rechnet denselben Bruttobetrag', priv.gesamt === r.gesamt, PREISE.euro(priv.gesamt));
  }
  // Die Mottoseite muss beides koennen - sonst nuetzt die Rechnung nichts.
  const mseite = await fs.readFile('motto-seite.js', 'utf8');
  pruefe('Mottoseite kennt die Firmen-Nettoansicht', /firmaNetto/.test(mseite));
  pruefe('Mottoseite weist die MwSt aus', /zzgl\. ' \+ Math\.round\(r\.mwstSatz/.test(mseite));

  // ---- Stabilitaet: die drei Funde vom 25. September ----
  // Markus: "Gehe ab und zu mal durch den kompletten Code und pruefe auf Fehler und Stabilitaet."
  // Was dabei herauskam, steht hier als Pruefung - sonst schleicht es sich beim naechsten Umbau
  // wieder ein, und gemerkt haette es erst der Kunde.
  {
    const srv = await fs.readFile('server.js', 'utf8');

    // 1. Express 4 leitet eine abgelehnte Zusage aus einem async-Handler NICHT weiter: die
    //    Anfrage bleibt offen, der Kunde sieht ein Rad, das sich dreht. Nachgemessen auf
    //    Express 4.22.2 - nach drei Sekunden keine Antwort. 39 Routen waren so gebaut.
    pruefe('jede Route ist gegen einen Absturz im Handler abgesichert',
      /const original = app\[methode\]\.bind\(app\)/.test(srv) && /ergebnis\.catch\(e => fehlerAntwort\(e, req, res\)\)/.test(srv));
    pruefe('der Schutz haengt an der Stelle, an der Routen entstehen - nicht an 39 Einzelstellen',
      /for \(const methode of \['get', 'post', 'put', 'delete'\]\)/.test(srv));
    pruefe('ein Fehler wird nicht verschluckt, sondern geloggt', /Route', req\.method, req\.originalUrl, 'ist gestolpert:/.test(srv));
    pruefe('was schon gesendet wurde, wird nicht ueberschrieben', /if \(res\.headersSent\) return;/.test(srv));
    pruefe('Fehlerbehandlungen mit vier Parametern bleiben unangetastet', /h\.length < 4/.test(srv));

    // 2. Vier Caches liefen ueber: der Wert lief ab, der Schluessel blieb fuer immer liegen.
    //    Die Schluessel kommen von Kunden (Ortsnamen, Koordinaten, Design-Nummern) - das waechst
    //    also mit der Zahl der Kunden und endet irgendwann in einem Neustart um drei Uhr nachts.
    pruefe('es gibt einen Cache-Helfer mit Grenze', /function cacheSetzen\(map, key, wert, grenze = CACHE_GRENZE\)/.test(srv));
    pruefe('der Helfer wirft erst das Abgelaufene, dann das Aelteste',
      /v\.bis <= jetzt\) map\.delete\(k\)/.test(srv) && /while \(map\.size > grenze\) map\.delete\(map\.keys\(\)\.next\(\)\.value\)/.test(srv));
    for (const name of ['ZETTEL_CACHE']) {   // die drei Orts-Caches sind am 12. Okt. mit der Postkarte gegangen
      pruefe(`${name} waechst nicht mehr unbegrenzt`,
        new RegExp('cacheSetzen\\(' + name + ',').test(srv) && !new RegExp('\\b' + name + '\\.set\\(').test(srv));
    }

    // 3. Netzaufrufe ohne Zeitgrenze: Node bricht von sich aus NIE ab. Drei Stellen hatten keine -
    //    darunter der Mailversand, an dem die Anmeldung haengt.
    const acc = await fs.readFile('accounts.js', 'utf8');
    const gd = await fs.readFile('gdrive.js', 'utf8');
    pruefe('der Mailversand ueber Brevo hat eine Zeitgrenze', /api\.brevo\.com[\s\S]{0,200}?AbortSignal\.timeout/.test(acc));
    pruefe('die Drive-Kontoabfrage hat eine Zeitgrenze', /drive\/v3\/about[\s\S]{0,200}?AbortSignal\.timeout/.test(gd));
    pruefe('der Figuren-Bogen hat eine Zeitgrenze', /fetch\(bogen\.url, \{ signal: AbortSignal\.timeout/.test(srv));
  }

  // ---- Nur Datei oder Textil ----
  // 25. Sept., Markus: "Nimm bitte von der Seite runter, dass wir auch nur die Transfers
  // verkaufen. Nur Datei oder Textil."
  // Der DTF-Transfer war die dritte Kaufform. Er ist aus KAUFFORMEN raus, nicht per Schalter
  // abgeschaltet - sonst koennte ihn eine alte storage/kaufformen.json zurueckholen. Und weil
  // KEYS aus dieser Liste kommt, faellt er damit in einem Zug aus der Auswahl, dem Backend und
  // den erlaubten Werten der Anfrage.
  {
    const { KAUFFORMEN } = await import('./kaufformen.js');
    const keys = KAUFFORMEN.map(f => f.key);
    // 7. Okt., Markus: "Nur die Druckdatei sollte ueberall raus." - es bleibt das fertige Teil
    pruefe('es gibt genau eine Kaufform: das fertige Teil (Druckdatei allein raus)',
      keys.length === 1 && keys[0] === 'textil', keys.join(' · '));
    { const hm = (await fs.readFile('home.html', 'utf8')).replace(/<!--[\s\S]*?-->/g, ''), mh = await fs.readFile('motto.html', 'utf8'), sq = await fs.readFile('server.js', 'utf8');
      pruefe('Druckdatei allein wird nirgends mehr angeboten (So geht\'s, Mottoseite, Artikelliste)',
        !/<h3>Nur die Druckdatei<\/h3>/.test(hm) && !/Oder ihr nehmt nur die Druckdatei/.test(hm + sq) && !/oder nur die Druckdatei/.test(mh)); }
    { const sq = await fs.readFile('server.js', 'utf8'), ms = await fs.readFile('motto-seite.js', 'utf8'), og = await fs.readFile('otto-gespraech.js', 'utf8');
      pruefe('Netto nur fuer angemeldete Firmen mit Unternehmer-Erklaerung (nicht jedes Konto); Einsprechen nur beim Einstieg oben (kein schwebender Knopf)',
        /netto: !!\(u\.firma && u\.firma\.name && u\.firma\.unternehmer && u\.firma\.unternehmerSeit\)/.test(sq) && /firmaNetto = !!d\.netto;/.test(ms) && !/firmaNetto = true;/.test(ms)
        && /start\.style\.display = 'none';\n/.test(og)); }
    pruefe('der DTF-Transfer wird nicht mehr angeboten', !keys.includes('transfer'));
    const kf = await fs.readFile('kaufformen.js', 'utf8');
    pruefe('auch das Backend hat kein Preisfeld mehr fuer den Transfer', !/b\.preise\.transfer/.test(kf));
    // Und auf den Seiten darf er auch nicht mehr beworben werden - dort hat Markus ihn gesehen.
    for (const [datei, text] of [['home.html', await fs.readFile('home.html', 'utf8')],
                                 ['admin.html', await fs.readFile('admin.html', 'utf8')]]) {
      // Der Kommentar, der die Aenderung erklaert, darf das Wort nennen - der sichtbare Text nicht.
      const sichtbar = text.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\/[^\n]*/g, '');
      pruefe(`${datei} bewirbt den DTF-Transfer nicht mehr`, !/DTF-Transfer/.test(sichtbar));
    }
    // Das Druckverfahren heisst weiterhin DTF - das ist die Technik, mit der wir drucken,
    // und nicht etwas, das der Kunde einzeln kaufen kann. Die beiden nicht verwechseln.
    const { VERFAHREN } = await import('./artikel.js');
    pruefe('das Druckverfahren DTF bleibt - es ist die Technik, kein Verkaufsartikel',
      VERFAHREN.dtf && /DTF/.test(VERFAHREN.dtf.label), VERFAHREN.dtf.label);
  }

  // ---- Der Firmenbereich rechnet netto ----
  // 24. Sept., Markus: "Und denk dran, wenn Firmen, wenn die Preise netto angezeigt exklusive
  // Mehrwertsteuer." Gemessen war es das Gegenteil: die Produktliste im Firmenbereich zeigte
  // "39 €" - den BRUTTOPREIS, ohne ein Wort darueber, was die Zahl ueberhaupt ist. Die Rechnung
  // im Warenkorb konnte netto (siehe oben), die Liste davor konnte es nicht.
  {
    const fh = await fs.readFile('firma.html', 'utf8');
    const srv = await fs.readFile('server.js', 'utf8');
    pruefe('Firmen-Produktliste liefert den Nettopreis mit', /preisNetto: \(!darfPreise \|\| t\.preis == null\) \? null : PREISE\.netto\(t\.preis\)/.test(srv));
    pruefe('Firmen-Produktliste nimmt den Steuersatz aus preise.cjs - nicht getippt', /mwstSatz: PREISE\.MWST/.test(srv));
    pruefe('Firmenseite zeigt den Nettopreis, nicht mehr die nackte Bruttozahl',
      /esc\(euro\(t\.preisNetto\)\)/.test(fh) && !/esc\(String\(t\.preis\)\) \+ ' €'/.test(fh));
    pruefe('Firmenseite schreibt "netto" an jeden Preis', /esc\(euro\(t\.preisNetto\)\) \+ '<span class="mwst">netto<\/span>/.test(fh));
    pruefe('Firmenseite nennt den Bruttopreis daneben - niemand muss selbst rechnen', /inkl\. ' \+ esc\(mwstText\(\)\) \+ ' MwSt\./.test(fh));
    // 24. Sept., Markus: "Schreib dahin allgemein: Preise sind Nettopreise zuzueglich
    // Mehrwertsteuer ... kannst du auch gerne noch mal recherchieren, was da die beste
    // Beschreibung ist." Nachgeschlagen: im reinen B2B gilt die Preisangabenverordnung nicht,
    // und die empfohlene Formel lautet "zzgl. gesetzlicher Umsatzsteuer" - der Begriff des
    // Gesetzes, und ohne einen Steuersatz, der sich aendern kann.
    pruefe('Firmenseite nennt die uebliche B2B-Formel ueber der ganzen Liste',
      /Alle Preise sind Nettopreise zzgl\. gesetzlicher Umsatzsteuer und zzgl\. Versandkosten/.test(fh));
    pruefe('der allgemeine Satz nennt keinen Steuersatz - ermaessigt oder geaendert waere er falsch',
      !/Nettopreise zzgl\. [^']*\d+ ?%/.test(fh));
    pruefe('Firmenseite nennt die Versandschwelle aus preise.cjs, nicht abgetippt',
      /produkte\.versand\.freiAbWert/.test(fh) && /versand: \{ kosten: PREISE\.VERSAND, freiAbWert: PREISE\.VERSANDFREI_AB_WERT/.test(srv));
    pruefe('Firmenseite holt den Steuersatz vom Server statt ihn zu tippen', /produkte\.mwstSatz/.test(fh));

    // ---- Preise erst nach der Unternehmer-Erklaerung ----
    // 24. Sept., Markus: "Nimm bitte die Preise runter im Firmenbereich und sag, dass die Preise
    // erst nach Anmeldung sichtbar werden. Und bei der Anmeldung machst du ein Haeckchen zum
    // Auswaehlen, dass das Firmenkunden sein muessen, so dass es rechtlich sauber ist."
    // Nachgeschlagen: Nettopreise duerfen nur Unternehmern gezeigt werden, und ein blosser
    // Hinweis auf der Seite genuegt ausdruecklich nicht - es braucht die Erklaerung des Kunden.
    pruefe('Preise haengen an der Erklaerung, nicht nur am Login',
      /const darfPreise = !!\(who\.user\.firma && who\.user\.firma\.unternehmer && who\.user\.firma\.unternehmerSeit\)/.test(srv));
    // Das Entscheidende: die Zahl wird nicht ausgeblendet, sie wird gar nicht erst geschickt.
    // Was nicht im Browser ankommt, kann auch niemand aufklappen.
    for (const feld of ['preisNetto', 'mwst', 'preis']) {
      pruefe(`ohne Erklaerung verlaesst "${feld}" den Server gar nicht erst`,
        new RegExp(feld + ': \\(!darfPreise \\|\\| t\\.preis == null\\)').test(srv));
    }
    pruefe('auch die Mengenstaffel bleibt ohne Erklaerung drinnen', /staffel: \(!darfPreise \|\| t\.preis == null\) \? \[\]/.test(srv));
    pruefe('die Seite erfaehrt, OB sie Preise zeigen darf', /preiseSichtbar: darfPreise/.test(srv));
    // Das Haeckchen selbst - und das Datum, das den Nachweis ausmacht.
    pruefe('die Firmendaten kennen die Unternehmer-Erklaerung', /unternehmer: f\.unternehmer === true \|\| f\.unternehmer === 'ja'/.test(srv));
    pruefe('WANN erklaert wurde, setzt der Server - nicht das Formular',
      /unternehmerSeit: f\.unternehmer \? \(vorher \|\| new Date\(\)\.toISOString\(\)\) : null/.test(srv));
    pruefe('ein einmal gesetztes Datum bleibt stehen, auch wenn die Firma ihre Daten aendert',
      /const vorher = who\.user\.firma && who\.user\.firma\.unternehmerSeit/.test(srv));
    // Und die Seite: Haeckchen, klarer Satz, und keine leere Stelle.
    pruefe('Firmenseite hat das Haeckchen bei den Firmendaten', /id="f-unternehmer"/.test(fh) && /<h2 id="firmendaten">/.test(fh));
    pruefe('das Haeckchen sagt, worum es geht - Unternehmer, nicht Privatperson',
      /Ich bestelle als <b>Unternehmer<\/b>/.test(fh) && /nicht als Privatperson/.test(fh));
    pruefe('das Haeckchen wird mitgespeichert', /unternehmer: \$\('f-unternehmer'\)\.checked/.test(fh));
    pruefe('nach dem Speichern wird die Produktliste neu geholt - sonst bliebe sie ohne Preise', /produkteLaden\(\);\n\s*sag\('f-msg'/.test(fh));
    pruefe('ohne Erklaerung steht da, warum und was zu tun ist - keine leere Stelle',
      /Die Preise sind noch verdeckt/.test(fh) && /Ich bestelle als Unternehmer/.test(fh));
    pruefe('verdeckter Preis und fehlender Preis sind zwei verschiedene Saetze',
      /Preis nach der Bestätigung/.test(fh) && /Preis steht noch nicht fest/.test(fh) && /preisDa: t\.preis != null/.test(srv));

    // Firmen bestellen in Stueckzahl - ohne die Staffel ist der Nettopreis nur die halbe Antwort.
    pruefe('Firmen-Produktliste liefert die Mengenstaffel netto mit', /stueckNetto: PREISE\.netto\(/.test(srv));
    pruefe('Firmenseite zeigt die Staffel je Textil', /je Stück netto/.test(fh));
    // Und was fehlt, wird benannt: ein Textil ohne Preis kann niemand bestellen, auch wenn
    // morgen das Produktbild da ist.
    pruefe('Firmenseite benennt Textilien ohne Preis, nicht nur die ohne Bild', /Noch ohne Preis: /.test(fh));
    // Die Zahlen selbst: netto + MwSt muss den Katalogpreis wieder ergeben, sonst weicht die
    // Seite von der Rechnung ab - dieselbe Regel wie im Warenkorb, hier fuer die Liste davor.
    const { TEXTILIEN } = await import('./textilien.js');
    for (const t of Object.values(TEXTILIEN)) {
      if (t.preis == null) continue;
      pruefe(`Firmenpreis ${t.label}: netto + MwSt ergibt wieder ${PREISE.euro(t.preis)}`,
        PREISE.rund(PREISE.netto(t.preis) + PREISE.steuer(t.preis)) === PREISE.rund(t.preis),
        `${PREISE.euro(PREISE.netto(t.preis))} + ${PREISE.euro(PREISE.steuer(t.preis))}`);
    }
  }

  // Rechtstexte muessen da sein - ohne sie darf kein Shop online gehen
  for (const teil of ['Impressum', 'Datenschutz', 'Widerruf', 'Allgemeine Geschäftsbedingungen']) {
    pruefe(`Rechtstext "${teil}" vorhanden`, recht.includes(teil));
  }

  // Fassung 77: Startseite und Mottoseite sind Vorlagen mit Platzhaltern (__MOTTOS_JSON__,
  // __ASSET_V__ und Co.), die der Server beim Ausliefern ersetzt. Vergisst man das Ersetzen,
  // steht der Platzhalter im Klartext in der Seite - bei einem Skript bricht dann alles
  // darunter ab, bei einer CSS-Regel oder einer Adresse wird sie still unbrauchbar. Also
  // nachsehen, ob es fuer jeden Platzhalter ein .replace() in server.js gibt, egal ob als
  // Zeichenkette oder als regulaerer Ausdruck geschrieben.
  const serv = await fs.readFile('server.js', 'utf8');
  const motto = await fs.readFile('motto.html', 'utf8');
  let gefunden = 0;
  for (const [datei, text] of [['home.html', home], ['motto.html', motto]]) {
    const platzhalter = [...new Set(text.match(/__[A-Z0-9_]+__/g) || [])];
    gefunden += platzhalter.length;
    for (const p of platzhalter) {
      pruefe(`${datei}: Platzhalter ${p} wird vom Server ersetzt`,
        serv.includes(`.replace('${p}'`) || serv.includes(`.replace(/${p}/g`));
    }
  }
  pruefe('die Vorlagen benutzen ueberhaupt Platzhalter', gefunden > 0, gefunden + ' gefunden');
}

// ---------------------------------------------------------------------------- 6 · Zaehler
// Fassung 74: Ein Zaehler, der still ins Leere zaehlt, ist schlimmer als keiner - man
// entscheidet dann auf Zahlen, die es gar nicht gibt. zaehl() verwirft jede Gruppe, die nicht
// in GRUPPEN steht. Also nachsehen, ob jeder Aufruf im Code eine Gruppe trifft, die es gibt.
async function pruefeZaehler() {
  abschnitt(6, 'Zaehler: zaehlt jeder Aufruf in eine Gruppe, die es gibt?');
  const dateien = ['server.js', 'abstimmung.js', 'kaufformen.js', 'produkte.js', 'vorzeige.js', 'namensliste.js'];
  const unbekannt = new Set();
  let aufrufe = 0;
  for (const f of dateien) {
    let txt = '';
    try { txt = await fs.readFile(f, 'utf8'); } catch (e) { continue; }
    for (const m of txt.matchAll(/\bzaehl\(\s*'([a-z0-9_-]+)'/g)) {
      aufrufe++;
      if (!ZAEHLER_GRUPPEN[m[1]]) unbekannt.add(m[1]);
    }
  }
  pruefe('jeder zaehl()-Aufruf trifft eine bekannte Gruppe', !unbekannt.size, [...unbekannt].join(', '));
  pruefe('es wird ueberhaupt gezaehlt', aufrufe >= 10, aufrufe + ' Zaehlpunkte im Code');
  // Umgekehrt: eine Gruppe, die es gibt, aber die nie gezaehlt wird, ist eine leere Kachel
  // im Backend - kein Fehler, aber es muss sichtbar bleiben.
  const benutzt = new Set();
  for (const f of dateien) {
    let txt = '';
    try { txt = await fs.readFile(f, 'utf8'); } catch (e) { continue; }
    for (const m of txt.matchAll(/\bzaehl\(\s*'([a-z0-9_-]+)'/g)) benutzt.add(m[1]);
  }
  const leer = Object.keys(ZAEHLER_GRUPPEN).filter(g => !benutzt.has(g));
  if (leer.length) console.log('  ' + grau('· Gruppen ohne Zaehlpunkt: ' + leer.join(', ')));
}

// ---------------------------------------------------------------------------- Lauf
console.log('ABNAHME · Motto Otto · ' + new Date().toLocaleString('de-DE'));
const mottos = await mottosLaden();
if (laeuft(1)) await pruefePrompts(mottos);
if (laeuft(2)) { pruefeArtikel(); await pruefeEchteDateien(); }
if (laeuft(3)) await pruefeAnsichten();
if (laeuft(3)) await pruefeSystem();
if (laeuft(4)) await pruefeStile();
if (laeuft(5)) await pruefeVersprechen();
if (laeuft(6)) await pruefeZaehler();
// 7: ein echter Browser auf Laptop-, iPhone- und Android-Masz. Eigene Datei, weil sie
// einen Server startet und Playwright braucht - beides soll die Textpruefungen oben
// nicht belasten.
if (laeuft(7)) { const { pruefeBrowser } = await import('./abnahme-browser.mjs'); await pruefeBrowser({ pruefe, hinweis, abschnitt }); }
// 8: der Magenta-Platzhalter der Vorlagen - messen, entfernen, alte Vorlagen nachputzen.
if (laeuft(8)) { const { pruefeMagenta } = await import('./abnahme-magenta.mjs'); await pruefeMagenta({ pruefe, abschnitt }); }
// 9: Partner, Tor, Firmen-Freigaben, Abfolge, Mockups der Artikel (Rechnung, ohne Netz)
if (laeuft(9)) { const { pruefePartner } = await import('./abnahme-partner.mjs'); await pruefePartner({ pruefe, abschnitt }); }

console.log('\n' + '─'.repeat(70));
console.log(fehler
  ? rot(`${fehler} von ${geprueft} Pruefungen gescheitert`)
  : gruen(`alle ${geprueft} Pruefungen bestanden`));
process.exit(fehler ? 1 : 0);
