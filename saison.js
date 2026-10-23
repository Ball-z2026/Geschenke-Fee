// Welcher Anlass steht gerade an? Der Aufmacher der Startseite wechselt mit dem Jahr.
//
// Markus, 26. Sept. 2026: "Ich finde die Idee mit der Saison hervorragend. Waere schoen, wenn
// Postkarte und unser Kerngeschaeft gleichzeitig zu sehen sind."
//
// Daraus folgt der Aufbau des Aufmachers: ZWEI Karten nebeneinander, immer beide sichtbar.
//   links  - die Postkarte, das Aushaengeschild (bleibt stehen)
//   rechts - das Motto, das JETZT dran ist (wechselt mit dem Monat)
// Darunter eine Zeile in alle Mottos. Der Besucher sieht also auf dem ersten Bildschirm
// beides: das, was neugierig macht, und das, wovon der Laden lebt.
//
// Warum ueberhaupt nach Monat: die Anlaesse haben harte Termine, und wer im Maerz nach einem
// Abimotto sucht, sucht im November nach der Weihnachtsfeier. Eine Startseite, die das ganze
// Jahr dasselbe zeigt, trifft elf Monate lang daneben.
//
// Die Tabelle ist mit Absicht im Code und nicht in der Datenbank: sie aendert sich einmal im
// Jahr, nicht einmal am Tag. Wer sie kurzfristig uebersteuern will (Aktion, Messe, Wetter),
// schreibt storage/saison.json - das schlaegt den Kalender, bis es wieder geloescht wird.

// Monat (1-12) -> was in diesem Monat ansteht. slug muss ein aktives Motto sein.
// Die Reihenfolge folgt dem deutschen Jahr, nicht dem Kalender der Werbebranche:
//   Karneval hat feste Tage, Abi wird im Fruehjahr gewaehlt, Klassenfahrten und JGA fallen in
//   den Fruehsommer, im Hochsommer wird verreist (und geschrieben), im September faengt die
//   Vereinssaison an, ab Oktober planen Firmen ihre Weihnachtsfeier.
export const KALENDER = {
  1:  { slug: 'karneval',         badge: 'Jetzt: Karneval',        zeile: 'Kostüm steht, Shirt fehlt noch' },
  2:  { slug: 'karneval',         badge: 'Jetzt: Karneval',        zeile: 'Für die ganze Clique, rechtzeitig zum Zug' },
  3:  { slug: 'abi',              badge: 'Jetzt: Abi 2026',        zeile: 'Motto gefunden? Dann fehlt nur noch das Shirt' },
  4:  { slug: 'abi',              badge: 'Jetzt: Abi 2026',        zeile: 'Vom Motto zum fertigen Entwurf, für den ganzen Jahrgang' },
  5:  { slug: 'abschlussfahrt',   badge: 'Jetzt: Klassenfahrt',    zeile: 'Damit man euch im Gewühl wiederfindet' },
  6:  { slug: 'junggesellenabschied', badge: 'Jetzt: JGA',         zeile: 'Einer sieht anders aus als der Rest. Mit Absicht.' },
  7:  { slug: 'malle-fahrt',      badge: 'Jetzt: Urlaub',          zeile: 'Die Crew in einem Shirt, vom Flughafen bis zurück' },
  8:  { slug: 'malle-fahrt',      badge: 'Jetzt: Urlaub',          zeile: 'Die Crew in einem Shirt, vom Flughafen bis zurück' },
  9:  { slug: 'meister-shirt',    badge: 'Jetzt: Saisonstart',     zeile: 'Aufstieg, Titel, Pokal - und alle tragen es' },
  10: { slug: 'firmenausflug',    badge: 'Jetzt: Firmenausflug',   zeile: 'Ein Tag raus, ein Shirt für alle' },
  11: { slug: 'weihnachtsfeier',  badge: 'Jetzt: Weihnachtsfeier', zeile: 'Das Shirt, über das im Januar noch geredet wird' },
  12: { slug: 'weihnachtsfeier',  badge: 'Jetzt: Weihnachtsfeier', zeile: 'Das Shirt, über das im Januar noch geredet wird' }
};

// Ersatz, wenn das Saison-Motto abgeschaltet oder geloescht wurde: lieber ein vorhandenes
// Motto als ein leerer Aufmacher. Reihenfolge = Rangfolge.
const NOTNAGEL = ['geburtstag', 'sprueche-shirt', 'familie', 'abi'];

/**
 * Welches Motto ist jetzt dran?
 * @param {Array} mottos   alle Mottos (mit slug, name, active, accent)
 * @param {object} opts    { datum, uebersteuert }
 *   datum         - Date, sonst jetzt. Nur zum Pruefen; im Betrieb bleibt es leer.
 *   uebersteuert  - { slug, badge, zeile, bis } aus storage/saison.json. bis ist ein
 *                   ISO-Datum; danach gilt wieder der Kalender, damit eine vergessene
 *                   Aktion nicht ein halbes Jahr stehen bleibt.
 * @returns {{ motto: object, badge: string, zeile: string, quelle: string }|null}
 */
export function saisonJetzt(mottos, opts = {}) {
  const liste = (mottos || []).filter((m) => m && m.active !== false);
  if (!liste.length) return null;
  const finde = (slug) => liste.find((m) => m.slug === slug) || null;

  const u = opts.uebersteuert;
  if (u && u.slug) {
    const abgelaufen = u.bis && new Date(u.bis) < (opts.datum || new Date());
    const m = abgelaufen ? null : finde(u.slug);
    if (m) return { motto: m, badge: u.badge || '', zeile: u.zeile || '', quelle: 'von Hand gesetzt' };
  }

  const d = opts.datum || new Date();
  const eintrag = KALENDER[d.getMonth() + 1];
  let m = eintrag ? finde(eintrag.slug) : null;
  let badge = eintrag ? eintrag.badge : '';
  let zeile = eintrag ? eintrag.zeile : '';
  let quelle = 'Kalender';

  if (!m) {
    // Das Saison-Motto gibt es nicht (mehr). Kein leerer Aufmacher - lieber ein anderes.
    for (const slug of NOTNAGEL) { m = finde(slug); if (m) break; }
    if (!m) m = liste.find((x) => !x.highlight) || liste[0];
    badge = 'Beliebt gerade';
    zeile = '';
    quelle = 'Notnagel - das Saison-Motto war nicht verfuegbar';
  }
  return { motto: m, badge, zeile, quelle };
}

/** Nur zum Anzeigen im Backend: was steht in den naechsten Monaten an? */
export function saisonVorschau(mottos, ab = new Date()) {
  const out = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(ab.getFullYear(), ab.getMonth() + i, 1);
    const s = saisonJetzt(mottos, { datum: d });
    out.push({
      monat: d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }),
      slug: s && s.motto ? s.motto.slug : null,
      name: s && s.motto ? s.motto.name : null,
      badge: s ? s.badge : ''
    });
  }
  return out;
}
