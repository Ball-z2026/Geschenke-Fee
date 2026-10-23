// Klick-Vorschlaege fuer das Spruch-Feld, je Motto. Eine Quelle fuer zwei Wege:
//   - seed.json / storage/mottos (neue Installationen)
//   - der Start-Nachtrag in server.js (Mottos, die nur auf dem Volume liegen: Geburtstag,
//     Kegeltour, Firmenausflug, Vereinsjubilaeum - die kamen mit dem Nachtrag Fassung 3 und
//     stehen nicht in seed.json)
// Der Nachtrag traegt nur ein, wo noch KEINE Vorschlaege stehen und das Feld existiert.
// Bis dahin zeigte das Backend den Platzhalter der Textbox (Abi-Beispiele) - der sah aus wie
// falsche Vorschlaege, war aber nur der leere Kasten.
//
// Regel fuer die Texte: kurz, druckbar, ohne Alter oder Jahreszahl - die stehen in eigenen
// Feldern (Geburtstag hat {alter}, Kegeltour {jahr}). Ein Spruch darf zu jedem Alter passen.
export const VORSCHLAEGE = {
  geburtstag: { feld: 'spruch', liste: [
    'Älter, aber nicht erwachsen',
    'In Würde gereift',
    'Ich bin nicht alt, ich bin ein Klassiker',
    'Legende seit Jahrzehnten',
    'Heute betreutes Trinken',
    'So jung kommen wir nicht mehr zusammen',
    'Geburtstagskind – Chef der Party',
    'Vintage. Original. Unbezahlbar.',
    'Level freigeschaltet',
    '18 – mit Erfahrung',
    'Prost auf mich!',
    'Limited Edition',
    'Das Beste kommt noch',
    'Heute wird\'s laut'
  ] },
  'handwerker-shirt': { feld: 'spruch', liste: [
    'Wir können, was andere versprechen',
    'Handwerk hat goldenen Boden',
    'Ohne uns läuft nichts',
    'Aus Meisterhand',
    'Wir bauen, was bleibt',
    'Gebaut, nicht geredet',
    'Qualität hat einen Namen',
    'Präzision seit Generationen'
  ] },
  'meister-shirt': { feld: 'spruch', liste: [
    'Meister! Was sonst.',
    'Wir sind oben',
    'Nicht zu stoppen',
    'Eine Saison für die Ewigkeit',
    'Geschichte geschrieben',
    'Tabellenführer bis zum Schluss',
    'Aufstieg – wir kommen',
    'Unser Jahr'
  ] },
  'tier-shirt': { feld: 'spruch', liste: [
    'Mein bester Freund',
    'Chef im Haus',
    'Wer braucht schon Menschen',
    'Verwöhnt, geliebt, unersetzlich',
    'Alle lieben mich',
    'Wächter, Kuschler, Familienmitglied',
    'Nicht kaputt zu kriegen',
    'Willkommen im Rudel'
  ] },
  kegeltour: { feld: 'spruch', liste: [
    'Alle Neune!',
    'Gut Holz!',
    'Kegeln kann jeder, feiern können wir',
    'Wir kegeln, bis die Bahn glüht',
    'Die Kugel rollt, die Stimmung auch',
    'Trinken kann jeder – wir kegeln dabei',
    'Auswärts sind wir Weltklasse',
    'Einmal Vollbild, bitte'
  ] },
  firmenausflug: { feld: 'spruch', liste: [
    'Teamgeist auf Reisen',
    'Betriebsausflug, kein Betriebsunfall',
    'Chef zahlt, wir feiern',
    'Zusammen unschlagbar',
    'Wir arbeiten, wo andere Urlaub machen',
    'Kollegen sind die beste Abteilung',
    'Heute ohne Dienstplan',
    'Team seit Jahren, Freunde für immer'
  ] },
  vereinsjubilaeum: { feld: 'spruch', liste: [
    'Seit Generationen ein Team',
    'Tradition verpflichtet',
    'Gestern. Heute. Immer.',
    'Ein Verein, eine Familie',
    'Jahre voller Leidenschaft',
    'Stolz auf unsere Geschichte',
    'Gemeinsam durch die Jahrzehnte',
    'Wir feiern uns'
  ] }
};

// Traegt Vorschlaege in ein Motto ein, wenn dort noch keine stehen und das Feld existiert.
// Gibt true zurueck, wenn sich etwas geaendert hat.
export function vorschlaegeErgaenzen(motto) {
  const v = VORSCHLAEGE[motto && motto.slug];
  if (!v) return false;
  if (String(motto.suggestions || '').trim()) return false;
  if (!(motto.fields || []).some(f => f.key === v.feld)) return false;
  motto.suggestions = v.liste.join('\n');
  motto.suggestField = v.feld;
  return true;
}
