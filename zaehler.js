// ---------- Zaehler: was passiert wirklich auf der Seite? ----------
// Fassung 74 (Markus, 17. Sept.: "Ja, baue einen Zaehler, am Tracken koennen, ueberall alles
// ganz genau"). Vorlauf war die Frage, ob ein Knopf "auf dieses Produkt anwenden" Umsatz
// bringt - und die ehrliche Antwort war: wir wissen nicht einmal, ob jemand auf "Kissen"
// tippt. Geraten wird hier nichts mehr.
//
// Grundsaetze, damit der Zaehler nie zum Problem wird:
//
//  1. NUR ZAHLEN. Kein Name, keine E-Mail, keine IP, kein Text des Kunden, keine Design-Nummer.
//     Ein Eintrag ist ein Schluessel und eine Anzahl, pro Tag. Damit ist es keine
//     personenbezogene Verarbeitung - es gibt niemanden, auf den man zurueckrechnen koennte.
//  2. FESTE SCHLUESSEL. Was gezaehlt wird, steht im Code (siehe EREIGNISSE). Freier Text aus
//     einer Anfrage wird nie zum Schluessel: sonst schreibt der erste Bot die Datei voll.
//  3. NIE IM WEG. Zaehlen darf keinen Auftrag aufhalten und keinen Fehler werfen. Jede
//     Funktion hier schluckt alles und gibt im Zweifel auf.
//  4. AUF DAS VOLUME, aber sparsam: gesammelt im Arbeitsspeicher, hoechstens alle 20 Sekunden
//     geschrieben, und beim Herunterfahren einmal sicher.
import fs from 'node:fs/promises';
import path from 'node:path';

// Welche Ereignisse es gibt. Der Teil vor dem Doppelpunkt ist die Gruppe, der Teil danach die
// Ausfuehrung (also "mockup:kissen" = das Kissen-Mockup wurde abgerufen). Eine Gruppe, die hier
// nicht steht, wird verworfen - so bleibt die Datei ueberschaubar und lesbar.
export const GRUPPEN = {
  seite:     'Seitenaufruf je Motto',
  auftrag:   'Design gestartet je Motto',
  fertig:    'Design fertig geworden',
  fehler:    'Design gescheitert (mit Grund)',
  stil:      'Gewaehlter Stil',
  artikel:   'Gewaehlter Artikel',
  flaeche:   'Gewaehlte Druckflaeche',
  mockup:    'Welches Produkt wurde angeschaut',
  ansicht:   'Vorder-, Rueck- oder Brustansicht',
  kaufform:  'Druckdatei, Transfer oder fertiges Produkt',
  anfrage:   'Kaufanfrage abgeschickt',
  foto:      'Kundenfoto hochgeladen, mit Befund',
  // 26. Sept., Markus: "Wenn jemand ein Foto hochlaedt, sollten wir schon erkennen koennen, dass
  // auch ein Mensch da drauf ist oder ein Tier." Gezaehlt wird nur der Ausgang der Pruefung -
  // passt / abgelehnt / ohne-modell. Nie das Bild, nie was darauf war.
  fotoinhalt:'Foto auf Mensch oder Tier geprueft (passt / abgelehnt / ohne Modell)',
  konto:     'Gast oder angemeldet',
  abstimmung:'Abstimmung angelegt, Stimme abgegeben, geteilt',
  sperre:    'Marken- oder Wortsperre hat gegriffen',
  download:  'Druckdatei geholt (Chef oder Druckerei)'
};

const MAX_SCHLUESSEL_PRO_TAG = 600;   // Notbremse gegen unerwartet viele Ausfuehrungen
const TAGE_AUFBEWAHREN = 180;         // ein halbes Jahr reicht fuer jeden Vergleich
const SCHREIB_PAUSE = 20000;

let datei = null;
let stand = {};            // { 'YYYY-MM-DD': { 'mockup:kissen': 12, ... } }
let schmutzig = false;
let timer = null;

const heute = () => new Date().toISOString().slice(0, 10);
// Schluessel duerfen nur das enthalten, was wir selbst vergeben. Alles andere fliegt raus -
// damit kann ein Ereignisname niemals Dateipfade, Anfuehrungszeichen oder HTML einschleppen.
const sauber = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);

export async function initZaehler(storeDir) {
  try {
    datei = path.join(storeDir, 'zaehler.json');
    try { stand = JSON.parse(await fs.readFile(datei, 'utf8')) || {}; } catch (e) { stand = {}; }
    if (!stand || typeof stand !== 'object' || Array.isArray(stand)) stand = {};
    aufraeumen();
    const tage = Object.keys(stand).length;
    console.log('Zaehler geladen:', tage, tage === 1 ? 'Tag' : 'Tage', '· Datei:', datei);
  } catch (e) {
    console.error('Zaehler konnte nicht geladen werden:', e && e.message ? e.message : e);
    datei = null;
  }
}

// Der eigentliche Aufruf. Bewusst kurz, damit er ueberall hinpasst, wo er hingehoert:
//   zaehl('mockup', garment)      -> mockup:kissen
//   zaehl('fehler', 'marke')      -> fehler:marke
//   zaehl('seite', motto.slug)    -> seite:sprueche-shirt
export function zaehl(gruppe, ausfuehrung = 'alle', anzahl = 1) {
  try {
    const g = sauber(gruppe);
    if (!g || !GRUPPEN[g]) return;
    const a = sauber(ausfuehrung) || 'alle';
    const tag = heute();
    const t = (stand[tag] = stand[tag] || {});
    const key = `${g}:${a}`;
    if (t[key] === undefined && Object.keys(t).length >= MAX_SCHLUESSEL_PRO_TAG) return;
    t[key] = (t[key] || 0) + (+anzahl > 0 ? Math.min(+anzahl, 1000) : 1);
    // Eine Gruppensumme mitzaehlen: sonst muss jede Auswertung alle Ausfuehrungen addieren und
    // verliert dabei die, die an der Notbremse haengengeblieben sind.
    if (a !== 'alle') t[`${g}:alle`] = (t[`${g}:alle`] || 0) + 1;
    schmutzig = true;
    if (!timer) { timer = setTimeout(() => { timer = null; sichern(); }, SCHREIB_PAUSE); if (timer.unref) timer.unref(); }
  } catch (e) { /* zaehlen darf nie stoeren */ }
}

function aufraeumen() {
  const grenze = new Date(Date.now() - TAGE_AUFBEWAHREN * 86400e3).toISOString().slice(0, 10);
  for (const tag of Object.keys(stand)) if (tag < grenze) delete stand[tag];
}

export async function sichern() {
  if (!datei || !schmutzig) return;
  schmutzig = false;
  try {
    aufraeumen();
    await fs.writeFile(datei, JSON.stringify(stand));
  } catch (e) {
    console.error('Zaehler schreiben:', e && e.message ? e.message : e);
    schmutzig = true;   // beim naechsten Mal nochmal versuchen
  }
}

// Auswertung fuers Backend. tage = wie weit zurueck (1 = nur heute).
// Liefert die Tagesreihe UND eine Summe je Gruppe, nach Haeufigkeit sortiert - also genau die
// Frage "was klicken die Leute", ohne dass jemand eine Tabelle im Kopf addieren muss.
export function bericht({ tage = 14 } = {}) {
  const alle = Object.keys(stand).sort().reverse().slice(0, Math.max(1, Math.min(+tage || 14, TAGE_AUFBEWAHREN)));
  const summe = {};
  for (const tag of alle) {
    for (const [key, n] of Object.entries(stand[tag] || {})) {
      const i = key.indexOf(':');
      const g = key.slice(0, i), a = key.slice(i + 1);
      if (a === 'alle') { (summe[g] = summe[g] || { gesamt: 0, teile: {} }).gesamt += n; continue; }
      const s = (summe[g] = summe[g] || { gesamt: 0, teile: {} });
      s.teile[a] = (s.teile[a] || 0) + n;
    }
  }
  // Gruppen ohne eigene Gesamtsumme (nur 'alle'-Ereignisse) sauber auffuellen
  for (const [g, s] of Object.entries(summe)) {
    const teilSumme = Object.values(s.teile).reduce((x, y) => x + y, 0);
    if (!s.gesamt) s.gesamt = teilSumme;
    s.liste = Object.entries(s.teile).sort((x, y) => y[1] - x[1]).map(([name, n]) => ({
      name, n, anteil: s.gesamt ? Math.round(n / s.gesamt * 100) : 0
    }));
    s.label = GRUPPEN[g] || g;
    delete s.teile;
  }
  return {
    vonTag: alle.length ? alle[alle.length - 1] : heute(),
    bisTag: alle.length ? alle[0] : heute(),
    tage: alle.length,
    gruppen: Object.entries(summe).sort((a, b) => b[1].gesamt - a[1].gesamt).map(([key, s]) => ({ key, ...s })),
    reihe: alle.map(tag => ({ tag, werte: stand[tag] || {} }))
  };
}
