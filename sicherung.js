// sicherung.js - wann ein fester Sicherungsstand faellig ist
// =============================================================================================
// Markus, 22. Sept. 2026: "Wir muessen noch eine Sicherheit einbauen, dass wir eine feste Uhrzeit
// haben, auf die wir zurueckgreifen koennen - dass am Tag mal irgendwas schiefgelaufen ist. Das
// war ueberhaupt nicht gut. Dass wir zumindest auf den Stand von mir aus um 8:00 Uhr morgens und
// einmal um 14:00 Uhr zurueckgehen koennen."
//
// Vorher gab es EINEN Stand pro Tag, nachts um 3 Uhr UTC. Geht zwischen morgens und abends etwas
// kaputt, ist der einzige Rueckkehrpunkt die vergangene Nacht - die Arbeit des Tages waere weg.
//
// Zwei Dinge sind hier Absicht:
//  1. DEUTSCHE ZEIT, nicht UTC. "8 Uhr" soll im Juli dasselbe heissen wie im Januar. Mit UTC
//     waere der Stand im Sommer um 10 Uhr deutscher Zeit entstanden.
//  2. Die ZULETZT ERREICHTE Uhrzeit gilt, nicht die exakt getroffene. Stand der Server um 8 Uhr
//     still (Deploy, Neustart) und kommt um 9 wieder hoch, wird der 8-Uhr-Stand nachgeholt statt
//     stillschweigend ausgelassen.
// Reine Rechnung, ohne Netz und ohne Platte - die Abnahme rechnet sie nach.
// =============================================================================================

/** Standard: morgens und mittags. Ueber BACKUP_ZEITEN in der Umgebung aenderbar. */
export const ZEITEN_STANDARD = [8, 14];

/** Datum und Stunde in der gewuenschten Zeitzone. */
export function jetztInZone(d = new Date(), zone = 'Europe/Berlin') {
  const t = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23'
  }).formatToParts(d).reduce((o, p) => (o[p.type] = p.value, o), {});
  return { tag: `${t.year}-${t.month}-${t.day}`, stunde: +t.hour };
}

/** Die Uhrzeiten aus der Umgebung lesen ("8,14"), sortiert und entdoppelt. */
export function zeitenAus(text) {
  const roh = String(text == null || text === '' ? ZEITEN_STANDARD.join(',') : text)
    .split(',').map(t => parseInt(String(t).trim(), 10))
    .filter(t => Number.isFinite(t) && t >= 0 && t <= 23);
  return [...new Set(roh)].sort((a, b) => a - b);
}

/**
 * Welcher feste Stand ist jetzt faellig?
 * Gibt { tag, stunde } der zuletzt erreichten Uhrzeit - oder null, wenn heute noch keine kam.
 */
export function faelligerStand(d = new Date(), { zeiten = ZEITEN_STANDARD, zone = 'Europe/Berlin' } = {}) {
  const { tag, stunde } = jetztInZone(d, zone);
  const erreicht = (zeiten || []).filter(h => stunde >= h);
  return erreicht.length ? { tag, stunde: erreicht[erreicht.length - 1] } : null;
}

/**
 * Die naechste laufende Nummer - Markus, 22. Sept.: "Die Rueckkehrpunkte sollten mit Datum und
 * fortlaufender Nummer sein." Dieselbe Idee wie bei den Auftragsnummern: eine Zahl, die man
 * aussprechen kann ("geh auf Stand 43 zurueck"), waehrend das Datum sagt, wann er entstand.
 * Gezaehlt wird aus dem Protokoll, nicht aus einer eigenen Datei - dann kann die Nummer nicht
 * von der Liste abweichen.
 */
export function naechsteNummer(protokoll) {
  const hoechste = (protokoll || []).reduce((m, e) => Math.max(m, +(e && e.nr) || 0), 0);
  return hoechste + 1;
}

/**
 * Der Dateiname eines Standes: laufende Nummer, Datum, Uhrzeit.
 * Die Nummer steht vorn, damit die Staende im Archiv in ihrer Reihenfolge liegen und sich einer
 * davon in einem Satz benennen laesst. Die Stunde MUSS mit hinein: sonst traegt der Mittagsstand
 * denselben Namen wie der Morgenstand, und am Ende liegt nur noch einer der beiden im Archiv.
 */
export function standName(stand, nr = 0) {
  return `motto-otto-${String(nr || 0).padStart(4, '0')}-${stand.tag}-${String(stand.stunde).padStart(2, '0')}.tar.gz`;
}

/** Ist dieser Stand schon gesichert? Gezaehlt wird je TAG UND UHRZEIT, nicht je Tag. */
export function schonGesichert(protokoll, stand) {
  return (protokoll || []).some(e => e && e.ok && e.tag === stand.tag && e.stunde === stand.stunde);
}
