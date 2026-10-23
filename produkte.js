// Welche (gebauten) Produkte bietet ein Motto an? Pro Motto per Klick im Backend an/aus.
// Ablage: storage/produkte.json = { "<slug>": ["tee","hoodie",...] }  (nur gebaute GARMENTS-Keys)
// Kein Eintrag fuer ein Motto => alle Produkte an (Rueckwaerts-kompatibel).
// Beim ersten Start wird die abgestimmte Belegung als Startwert geschrieben.
import fs from 'node:fs/promises';
import path from 'node:path';

// Abgestimmte Start-Belegung (gebaute Produkte je Motto). Keys = mockups.js GARMENTS.
const SEED = {
  abi:               ['tee', 'hoodie', 'zip', 'tasse', 'beutel', 'poster', 'sticker'],
  junggesellenabschied: ['tee', 'tasse', 'beutel', 'sticker'],
  'malle-fahrt':     ['tee', 'tasse', 'beutel', 'strandtuch', 'sticker'],
  fanclub:           ['tee', 'hoodie', 'zip', 'tasse', 'beutel', 'poster', 'sticker'],
  'tier-shirt':      ['tee', 'tasse', 'beutel', 'kissen'],
  abschlussfahrt:    ['tee', 'hoodie', 'tasse', 'beutel', 'poster', 'sticker'],
  'kinder-tiershirt':['tee', 'hoodie', 'tasse', 'beutel', 'kissen', 'sticker'],
  'angler-shirt':    ['tee', 'hoodie', 'tasse', 'beutel'],
  'jaeger-shirt':    ['tee', 'hoodie', 'tasse'],
  'landwirt-shirt':  ['tee', 'hoodie', 'zip', 'tasse', 'beutel', 'poster', 'sticker'],
  'motorrad-shirt':  ['tee', 'hoodie', 'tasse', 'beutel', 'poster', 'sticker'],
  'sprueche-shirt':  ['tee', 'hoodie', 'tasse', 'beutel', 'kissen', 'poster', 'sticker'],
  familie:           ['tee', 'hoodie', 'tasse', 'beutel', 'kissen', 'poster'],
  karneval:          ['tee', 'hoodie', 'tasse', 'beutel', 'sticker'],
  'geburt-baby':     ['kissen', 'poster', 'tee', 'hoodie', 'tasse', 'beutel', 'strandtuch', 'sticker'],
  'fan-shirt':       ['tee', 'hoodie', 'zip', 'tasse', 'beutel', 'strandtuch', 'poster', 'sticker'],
  geburtstag:        ['tee', 'hoodie', 'tasse', 'beutel', 'kissen', 'poster', 'sticker'],
  kegeltour:         ['tee', 'hoodie', 'tasse', 'beutel', 'sticker'],
  vereinsjubilaeum:  ['tee', 'hoodie', 'zip', 'tasse', 'beutel', 'poster', 'sticker'],
  firmenausflug:     ['tee', 'zip', 'tasse', 'beutel', 'poster'],
  schulmotto:        ['tee', 'hoodie', 'tasse', 'beutel', 'poster', 'sticker'],
  weihnachtsfeier:   ['tee', 'hoodie', 'tasse', 'beutel', 'kissen', 'poster', 'sticker']
};

export function mountProdukte(app, deps) {
  const { STORE, mottos, adminGuard, GARMENTS } = deps;
  const FILE = path.join(STORE, 'produkte.json');
  const ALL = () => Object.keys(GARMENTS);
  let map = {};

  async function persist() {
    await fs.mkdir(STORE, { recursive: true });
    // __produkte haelt fest, welche Produkte es zum Zeitpunkt des Speicherns gab. Beim naechsten
    // Start ist daran zu erkennen, was seitdem neu dazugekommen ist.
    await fs.writeFile(FILE, JSON.stringify({ ...map, __produkte: ALL() }, null, 2));
  }
  (async () => {
    let bekannt = [];
    try {
      const d = JSON.parse(await fs.readFile(FILE, 'utf8')) || {};
      // Die Liste der bekannten Produkte liegt unter einem Schluessel, der kein Motto sein kann.
      bekannt = Array.isArray(d.__produkte) ? d.__produkte : [];
      delete d.__produkte;
      map = d;
    } catch (e) { map = {}; }
    let changed = false;
    for (const [slug, arr] of Object.entries(SEED)) if (!map[slug]) { map[slug] = arr.filter(k => ALL().includes(k)); changed = true; }

    // Fassung 73 (Markus, 17. Sept.: "Also die ganze Palette an Artikeln - ich kann sie halt
    // dann im Backend ausschalten, was nicht passt"): Ein NEU gebautes Produkt war bisher
    // ueberall aus. Die Belegung je Motto liegt als feste Liste auf dem Volume, und was dort
    // nicht drinsteht, gilt als abgewaehlt - ein spaeter hinzugekommenes Handtuch waere also
    // still bei keinem Motto erschienen, obwohl es nie jemand abgewaehlt hat.
    // Darum merkt sich die Datei, welche Produkte sie schon kannte. Alles, was neu dazukommt,
    // wird bei JEDEM Motto eingeschaltet - abwaehlen kann Markus im Backend.
    if (!bekannt.length) bekannt = ALL().slice();        // erste Fassung mit dieser Liste
    const neu = ALL().filter(k => !bekannt.includes(k));
    if (neu.length) {
      for (const slug of Object.keys(map)) {
        if (!Array.isArray(map[slug])) continue;
        for (const k of neu) if (!map[slug].includes(k)) map[slug].push(k);
      }
      console.log('Produkt-Belegung: neue Produkte ueberall eingeschaltet:', neu.join(', '));
      changed = true;
    }
    if (JSON.stringify(bekannt) !== JSON.stringify(ALL())) changed = true;
    if (changed) {
      try { await persist(); console.log('Produkt-Belegung gespeichert'); } catch (e) { /* egal */ }
    }
  })();

  // Aktive gebaute Produkte eines Mottos (Standard: alle). Reihenfolge = GARMENTS-Reihenfolge.
  function enabledFor(slug) {
    // 1. Okt., Markus: "das Schneidebrett nehmen wir komplett raus, ueberall" - GARMENTS[k].aus
    const all = ALL().filter(k => !(GARMENTS[k] && GARMENTS[k].aus));
    const e = map && map[slug];
    if (!Array.isArray(e)) return all.slice();
    return all.filter(k => e.includes(k));
  }

  app.get('/api/admin/produkte', adminGuard, async (req, res) => {
    const produkte = ALL().map(k => ({ key: k, label: GARMENTS[k].label }));
    const list = (await mottos.all()).sort((a, b) => (a.order || 0) - (b.order || 0)).map(m => ({ slug: m.slug, name: m.name }));
    const state = {}; for (const m of list) state[m.slug] = enabledFor(m.slug);
    res.json({ produkte, mottos: list, state });
  });

  // Speichern: {slug, key, on}  (ein Haken)  ODER {slug, keys:[...]}  ODER {state:{slug:[...]}}
  app.post('/api/admin/produkte', adminGuard, async (req, res) => {
    const b = req.body || {};
    if (b.state && typeof b.state === 'object') {
      for (const [s, arr] of Object.entries(b.state)) map[s] = ALL().filter(k => Array.isArray(arr) && arr.includes(k));
    } else if (b.slug) {
      const slug = String(b.slug);
      if (Array.isArray(b.keys)) map[slug] = ALL().filter(k => b.keys.includes(k));
      else if (b.key) {
        let cur = enabledFor(slug);
        if (b.on) { if (!cur.includes(b.key)) cur.push(b.key); } else cur = cur.filter(k => k !== b.key);
        map[slug] = ALL().filter(k => cur.includes(k));
      }
    }
    try { await persist(); } catch (e) { return res.status(500).json({ error: 'speichern fehlgeschlagen' }); }
    res.json({ ok: true });
  });

  return { enabledFor };
}
