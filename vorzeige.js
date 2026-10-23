// Vorzeige-Designs: je Motto und Stil ein fertiges Beispiel, das auf der Motto-Seite auf den Stil-Kacheln
// und in der Stil-Galerie erscheint. Die Beispiele sind echte Designs (Master, Preview, Mockups, Drive-Ablage).
// Sie werden beim Start automatisch aus der im Repo liegenden vorzeige-designs.json angelegt (nur was fehlt),
// zusaetzlich geht Import per Backend/API oder einzeln per URL / Design-Nummer.
//
// Ablage: storage/vorzeige/<slug>.json  ->  { "<stil>": "<designId>", ... }
// Einbindung in server.js (zwei Stellen):
//   import { mountVorzeige } from './vorzeige.js';
//   const vorzeige = mountVorzeige(app, { STORE, mottos, env, adminGuard, makeMaster, makePreview, makeMockup, pushToDrive, newId, STYLE_KEYS });
//   ... und in GET /m/:slug:  JSON.stringify({ ...publicView(m), styleSamples: await vorzeige.publicSamples(m.slug) })
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { ARTIKEL, artikelLeinwand, flaechenVon } from './artikel.js';
// 23. Sept.: welches Textil zu einem Stil gehoert, entscheidet der Stil selbst - siehe
// STIL_TEXTIL in mottos.js. Vorher fiel hier alles still auf 'dunkel' zurueck.
import { textilFuerStil } from './mottos.js';

export function mountVorzeige(app, deps) {
  // erzeugeBild ist freiwillig: ist es da, kann ein Aufmacher hier neu GEZEICHNET werden statt
  // nur von einer URL geholt. Der Server reicht die Funktion herein, weil dort Prompt, Leinwand,
  // Modell und Stufe zusammenlaufen - vorzeige.js kennt nur "gib mir ein PNG zu diesem Motto".
  const { STORE, mottos, env, adminGuard, makeMaster, makePreview, makeMockup, pushToDrive, newId, STYLE_KEYS, onImported, erzeugeBild, mitBildarbeit, szeneMoeglich } = deps;
  const DIR = path.join(STORE, 'vorzeige');
  const state = { running: false, done: 0, total: 0, errors: [], log: [] };
  // Reservierter Platz neben den elf Stilen: das Bild fuer die Kachel auf der Startseite. Es taucht nicht in der
  // Stil-Galerie auf, sondern nur als Aufmacher des Mottos - so kann dort z. B. ein Design fuer helles Textil stehen.
  const KACHEL = 'kachel';
  const kennt = (style) => STYLE_KEYS.includes(style) || style === KACHEL;
  // 3. Okt. (Markus: "Warum sind die eigentlich noch nicht ausgetauscht?"): die Designs fuer das
  // Schaufenster der Startseite liegen auf einem eigenen Platz "<stil>#schaufenster" - kein
  // Stilbeispiel (die Galerie zeigt ihn nicht), aber ein echtes, freigegebenes Design im Pool.
  const SCHAU = '#schaufenster';

  const file = (slug) => path.join(DIR, String(slug).replace(/[^a-z0-9-]/g, '') + '.json');

  // Gesperrte Plaetze: ein Bild, das niemand mehr sehen soll, wird hier ausgesperrt - statt es
  // im Backend von Hand wegzuklicken und zu hoffen, dass es nicht ueber einen Zwischenspeicher
  // zurueckkommt. Die Sperre wirkt an EINER Stelle (read), damit sie wirklich ueberall greift:
  // Kopf der Startseite, Anlass-Kachel, Stil-Galerie. Das Design selbst bleibt erhalten.
  const GESPERRT = {};
  try {
    // Beim Aufbau einmal einlesen - die Sperre muss stehen, bevor die erste Seite ausgeliefert wird.
    const roh = JSON.parse(fsSync.readFileSync(new URL('./gesperrte-vorzeige.json', import.meta.url), 'utf8'));
    for (const [slug, e] of Object.entries(roh)) {
      if (slug.startsWith('_') || !e || typeof e !== 'object') continue;
      if (e.komplett === true) { GESPERRT[slug] = 'alles'; continue; }
      if (Array.isArray(e.plaetze)) GESPERRT[slug] = new Set(e.plaetze);
    }
    const n = Object.keys(GESPERRT).length;
    if (n) console.log('Vorzeige: gesperrte Plaetze geladen fuer', Object.keys(GESPERRT).join(', '));
  } catch (e) { /* keine Sperrliste - dann ist nichts gesperrt */ }

  // readRoh liefert die Datei, wie sie auf dem Volume steht - fuer das Backend und zum Schreiben.
  async function readRoh(slug) { try { return JSON.parse(await fs.readFile(file(slug), 'utf8')); } catch (e) { return {}; } }
  // read ist die Sicht fuer den Kunden: hier fallen gesperrte Plaetze raus.
  async function read(slug) {
    const sperre = GESPERRT[slug];
    if (sperre === 'alles') return {};
    const s = await readRoh(slug);
    if (!sperre) return s;
    const out = {};
    for (const [platz, id] of Object.entries(s)) if (!sperre.has(platz)) out[platz] = id;
    return out;
  }
  // Komplett gesperrt heisst: dieses Motto liefert ueberhaupt kein Bild mehr - auch nicht ueber
  // den Rueckfall auf das im Backend gesetzte Beispiel. Genau dieses Loch hatte die erste Sperre.
  function komplettGesperrt(slug) { return GESPERRT[slug] === 'alles'; }
  async function write(slug, data) { await fs.mkdir(DIR, { recursive: true }); await fs.writeFile(file(slug), JSON.stringify(data, null, 2)); }

  // Fuer die Motto-Seite: Stil -> Bild-URL (nur Stile, die ein Beispiel haben)
  async function publicSamples(slug) {
    const s = await read(slug);
    const out = {};
    // 20. Sept.: ein Motto mit festem Artikel (Postkarte) zeigt seine Stilbeispiele als reines
    // Motiv - ein T-Shirt-Mockup mit einer Postkarte darauf waere Unsinn.
    let nurMotiv = false;
    try { const m = await mottos.get(slug); nurMotiv = !!(m && m.artikelFest); } catch (e) { nurMotiv = false; }
    // Plaetze "<stil>@<artikel>" sind fuer einen Artikel gezeichnet - kein Stilbeispiel fuer die Galerie.
    for (const [style, id] of Object.entries(s)) if (id && style !== KACHEL && !style.includes('@') && !style.includes('#')) out[style] = nurMotiv
      ? `/api/mo/entwurf/${slug}/${style}.png?v=${encodeURIComponent(id)}`
      : `/api/mo/stilbeispiel/${slug}/${style}.jpg?v=${encodeURIComponent(id)}`;
    return out;
  }

  // Ein Bild als echtes Design anlegen: Master 4096 px, Preview, Job-Datei, Drive.
  // Das Bild kommt entweder von einer URL (Manifest-Import) ODER fertig als PNG-Puffer
  // (frisch erzeugter Aufmacher). Alles danach ist identisch - die Anmeldung eines
  // Vorzeige-Designs steht damit nur an EINER Stelle im Code.
  // 21. Sept., Markus: "Da muessten auch ein paar andere Artikel zu sehen sein ... Du hast
  // Backend-Zugriff, mach das selber." Ein Vorzeige-Design kann jetzt FUER EINEN ARTIKEL gezeichnet
  // sein (artikel: 'kissen', 'handtuch', 'mousepad' ...): dann liegt es auf der Leinwand dieses
  // Artikels, der Auftragszettel traegt den Artikel (input.artikel) wie bei einem Kundendesign,
  // und die Startseite zeigt es unter "Eigenes Design fuer das Kissen". Der Platz im Fach heisst
  // "<stil>@<artikel>", damit die Stil-Galerie (nur T-Shirt-Stile) ihn nicht fuer einen Stil haelt.
  async function importOne({ slug, style, url, png: pngRein, values, textile, prompt, artikel, schaufenster }) {
    const motto = await mottos.get(slug);
    if (!motto) throw new Error('unbekanntes Motto ' + slug);
    if (!kennt(style)) throw new Error('unbekannter Stil ' + style);
    const aId = artikel ? String(artikel).replace(/[^a-z0-9_-]/g, '') : '';
    if (aId && !ARTIKEL[aId]) throw new Error('unbekannter Artikel ' + artikel);
    const platz = schaufenster ? style + SCHAU : aId ? style + '@' + aId : style;
    let png = pngRein;
    if (!png) {
      const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!r.ok) throw new Error('HTTP ' + r.status + ' bei ' + url);
      png = Buffer.from(await r.arrayBuffer());
    }

    // 6. Okt., Markus: "Kunden-Dateien duerfen ohne meine Zustimmung nicht ueberschrieben werden." Die Nummer wurde hier gewuerfelt,
    // ohne nachzusehen, ob sie schon vergeben ist - eine Kollision haette ein Kundendesign ersetzt. Jetzt nur eine freie Nummer.
    const kopf = `MO-${motto.slug.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-`;
    let designId = '';
    for (let i = 0; i < 20 && !designId; i++) {
      const id = kopf + newId();
      const belegt = await Promise.any([path.join(STORE, 'jobs', id + '.json'), path.join(STORE, 'masters', id + '_PRINT_MASTER.png')].map(p => fs.access(p))).then(() => true, () => false);
      if (!belegt) designId = id;
    }
    if (!designId) throw new Error('keine freie Design-Nummer fuer ' + motto.slug);
    // 21. Sept.: die Stilbeispiele der Postkarte kamen mit SCHWARZEM Himmel und schwarzem Papier
    // aus dem Import - makeMaster hat die Karte wie ein Shirt-Motiv freigestellt, und das Helle
    // (Himmel, Aquarellpapier) wurde als Hintergrund weggeschnitten. Genau so war schon das
    // Aquarell vom 20. Sept. schwarz. Ein Motto mit festem, vollflaechigem Artikel (Postkarte)
    // bekommt sein Bild ganz, wie ein Kundendesign auch (server.js: vollflaechig -> nicht
    // freistellen), auf der Leinwand des Artikels.
    const artikelId = aId || motto.artikelFest || '';
    const aFest = artikelId && ARTIKEL[artikelId];
    const vollflaechig = !!(aFest && aFest.motivart === 'vollflaechig');
    let leinwand, flaeche = '';
    if (vollflaechig) {
      try { flaeche = Object.keys(flaechenVon(artikelId))[0] || ''; const lw = artikelLeinwand(artikelId, flaeche); if (lw) leinwand = { dpi: lw.dpi, dpiExakt: lw.dpiExakt, cm: lw.brutto }; } catch (e) { leinwand = undefined; }
    }
    const master = vollflaechig
      ? await makeMaster(png, { schonFrei: true, randLuft: false, leinwand })
      : await makeMaster(png, { targetWidth: env.MASTER_WIDTH, erwarte: 'alpha' });   // 6. Okt.: nur transparente Bilder, nie freistellen
    await fs.mkdir(path.join(STORE, 'masters'), { recursive: true });
    await fs.mkdir(path.join(STORE, 'previews'), { recursive: true });
    await fs.mkdir(path.join(STORE, 'jobs'), { recursive: true });
    await fs.writeFile(path.join(STORE, 'masters', `${designId}_PRINT_MASTER.png`), master);
    await fs.writeFile(path.join(STORE, 'previews', `${designId}.png`), await makePreview(master));
    await fs.writeFile(path.join(STORE, 'jobs', `${designId}.json`), JSON.stringify({
      designId, motto: motto.slug, values: values || {}, style: style || 'standard', colors: '', variation: '', user: null,
      via: pngRein ? 'vorzeige-neu' : 'vorzeige',
      names: [], nameZone: motto.nameZone, nameFont: motto.nameFont, textile: textile || 'dunkel', research: null,
      prompt: prompt || '(Vorzeige-Design, importiert)', sourceUrl: url || '', vorzeige: true, ...(schaufenster ? { schaufenster: true } : {}), qa: [], created: new Date().toISOString(), upload: null,
      // Fuer einen Artikel gezeichnet: der Zettel sagt es wie bei einem Kundendesign (flachwareKarten
      // der Startseite und die Ergebnisseite lesen input.artikel).
      ...(aId ? { artikel: aId, input: { artikel: { id: aId, name: aFest.name, label: aFest.label, motivart: aFest.motivart, verfahren: aFest.verfahren, flaeche } } } : {})
    }, null, 2));

    // Auch hier readRoh: mit read() kam bei einem gesperrten Motto ein leeres Fach zurueck,
    // und write() hat damit die ganze Datei ueberschrieben - alle anderen Stile weg.
    const cur = await readRoh(slug);
    cur[platz] = designId;
    await write(slug, cur);
    // Neues Vorzeige-Design dem Bewertungs-Pool melden (optional, darf den Import nie stoeren)
    try { if (typeof onImported === 'function') await onImported({ designId, slug, style, values: values || {}, textile: textile || 'dunkel', artikel: aId || '' }); } catch (e) { /* Pool ist Beiwerk */ }
    // Mockup-Cache fuer die Kachel leeren
    try { await fs.rm(path.join(STORE, 'mockups', `stil_${slug}_${platz}.jpg`), { force: true }); } catch (e) { /* egal */ }
    setTimeout(() => pushToDrive(designId).catch(e => console.error('Drive (Vorzeige):', e && e.message ? e.message : e)), 1000);
    return designId;
  }

  // ---- Aufmacher neu zeichnen ----
  // Bisher konnte ein Vorzeige-Design nur von aussen kommen: irgendwo erzeugen, URL ins Manifest,
  // Import. Damit haengt jedes neue Bild an einem Menschen, der ein Werkzeug laufen laesst - und
  // an dessen Zeitgrenze. Hier laeuft es im Server selbst: derselbe Weg wie bei einem echten
  // Kundendesign (Prompt aus mottos.js, groesste Leinwand, eingestellte Stufe), nur ohne Auftrag.
  let manifestCache = null;
  async function manifestLesen() {
    if (manifestCache) return manifestCache;
    try { manifestCache = JSON.parse(await fs.readFile(new URL('./vorzeige-designs.json', import.meta.url), 'utf8')); }
    catch (e) { manifestCache = { mottos: {} }; }
    return manifestCache;
  }
  // Womit ist dieser Platz beschriftet? Erste Quelle ist der Auftragszettel des Bildes, das gerade
  // dort steht - der beschreibt genau, was zu sehen ist. Erst danach das Manifest im Repo.
  async function vorgabeFuer(slug, style) {
    const have = (await readRoh(slug))[style];
    if (have) {
      try {
        const job = JSON.parse(await fs.readFile(path.join(STORE, 'jobs', `${have}.json`), 'utf8'));
        if (job.values && Object.keys(job.values).length) return { values: job.values, textile: job.textile || 'dunkel', stil: job.style || '' };
      } catch (e) { /* kein Zettel - dann das Manifest */ }
    }
    const m = (await manifestLesen()).mottos || {};
    const e = m[slug];
    if (!e) return null;
    if (style === KACHEL) return { values: e.kachelValues || e.values || {}, textile: e.kachelTextile || e.textile || 'dunkel', stil: '' };
    return { values: e.values || {}, textile: textilFuerStil(style, (e.styleTextile && e.styleTextile[style]) || e.textile), stil: '' };
  }

  async function erzeuge({ slug, style, values, textile, stil }) {
    if (typeof erzeugeBild !== 'function') throw new Error('Auf diesem Server ist das Erzeugen nicht eingerichtet');
    const motto = await mottos.get(slug);
    if (!motto) throw new Error('unbekanntes Motto ' + slug);
    if (!kennt(style)) throw new Error('unbekannter Stil ' + style);
    let werte = values, textil = textile, artStil = stil;
    if (!werte || !Object.keys(werte).length) {
      const v = await vorgabeFuer(slug, style);
      if (!v) throw new Error('Fuer ' + slug + ' ist nicht hinterlegt, was auf dem Bild stehen soll - Werte mitschicken');
      werte = v.values; textil = textil || v.textile; artStil = artStil || v.stil;
    }
    // Der Aufmacher ist kein eigener Kunststil - ohne Angabe wird er im Grundstil gezeichnet.
    const gemalt = artStil || (style === KACHEL ? 'standard' : style);
    const { png, prompt } = await erzeugeBild({ motto, style: gemalt, values: werte, textile: textil || 'dunkel' });
    return importOne({ slug, style, png, prompt, values: werte, textile: textil || 'dunkel' });
  }

  async function runImport(items) {
    state.running = true; state.done = 0; state.total = items.length; state.errors = []; state.log = [];
    try {
      for (const it of items) {
        try {
          const id = it.neu ? await erzeuge(it) : await importOne(it);
          state.log.push(`${it.slug}/${it.style} -> ${id}`);
        } catch (e) {
          state.errors.push(`${it.slug}/${it.style}: ${e && e.message ? e.message : e}`);
        }
        state.done++;
      }
    } finally { state.running = false; }
  }

  // ---- oeffentlich: Mockup-Bild je Motto und Stil (ohne Wasserzeichen) ----
  // Ohne Angabe kommt das T-Shirt - so, wie die Stil-Galerie es seit jeher zeigt. Mit ?a=<artikel>
  // dasselbe Design auf einem anderen Teil (Hoodie, Beutel, Kissen ...). Die Startseite baut daraus
  // ihre gemischte Reihe: es ist derselbe Weg und dasselbe Bild, nur ein anderes Teil drumherum.
  //
  // Der Dateiname traegt den Artikel nur, wenn es nicht das T-Shirt ist - sonst waeren alle bisher
  // gebauten Bilder auf einen Schlag ungueltig und muessten neu gerechnet werden.
  // 9. Okt. (Markus, Bild: die alte Robotic-Hochzeit auf Schwarz, laengst ersetzt): der Name trug die Design-Nummer nicht -
  // wurde ein Platz neu belegt, lieferte der Zwischenspeicher das alte Bild weiter (importOne loeschte nur die T-Shirt-Datei,
  // nicht die Szene). Jetzt gehoert die Nummer in den Namen: ein neues Design ist eine neue Datei.
  const stilDatei = (slug, style, artikel, szene, id) => path.join(STORE, 'mockups',
    `stil_${slug}_${style}_${id}_${artikel}${szene ? '-szene' : ''}.jpg`);
  const stilFertig = async (slug, style, artikel, szene) => {
    const id = (await read(slug))[style];
    if (!id) return false;
    try { await fs.access(stilDatei(slug, style, artikel, szene, id)); return true; } catch (e) { return false; }
  };

  // Ein Stilbeispiel auf einem Teil bauen - und zwar IMMER durch die Bildarbeits-Schlange.
  // Fassung 84b: Genau hier fehlte sie. Ein Master ist 4096 x 5433 Pixel; entpackt sind das rund
  // 89 MB, und sharp braucht sie am Stueck. Solange nur das T-Shirt gezeigt wurde, lagen die
  // Bilder laengst im Zwischenspeicher und niemand baute etwas. Mit der gemischten Reihe wollte
  // ein Browser acht NEUE Mockups auf einmal - acht Master gleichzeitig offen. Das ist mehr
  // Arbeitsspeicher, als der Container hat. Die Schlange laesst hoechstens drei zugleich rechnen;
  // sie steht seit Fassung 70 an allen anderen Stellen und hat hier gefehlt.
  // szeneGewollt (Fassung 86): das Teil in Benutzung statt sachlich vor grauem Grund. Fehlt die
  // Vorlage dafuer, kommt stillschweigend die sachliche Ansicht - ein fehlendes Wohnzimmer darf
  // nie dazu fuehren, dass gar kein Bild kommt.
  async function stilMockup(slug, style, artikel, szeneGewollt, { hintergrund = false } = {}) {
    const id = (await read(slug))[style];
    if (!id) throw new Error('kein Beispiel fuer ' + slug + '/' + style);
    let textile = 'dunkel';
    try { textile = JSON.parse(await fs.readFile(path.join(STORE, 'jobs', `${id}.json`), 'utf8')).textile || 'dunkel'; } catch (e) { /* Standard */ }
    const farbe = textile === 'hell' ? 'white' : 'black';
    const szene = !!szeneGewollt && await szeneMoeglich(artikel, farbe);
    const ziel = stilDatei(slug, style, artikel, szene, id);
    try { return await fs.readFile(ziel); } catch (e) { /* bauen */ }
    const bauen = async () => {
      const master = await fs.readFile(path.join(STORE, 'masters', `${id}_PRINT_MASTER.png`));
      return makeMockup(master, artikel, farbe, false, { ansicht: szene ? 'szene' : undefined, linie: 'bc' });   // Ottos Liebling: das Herstellerfoto von B&C
    };
    const jpg = typeof mitBildarbeit === 'function' ? await mitBildarbeit('Stilbeispiel ' + slug + '/' + artikel, bauen, { hintergrund }) : await bauen();
    await fs.mkdir(path.join(STORE, 'mockups'), { recursive: true });
    await fs.writeFile(ziel, jpg);
    return jpg;
  }

  app.get('/api/mo/stilbeispiel/:slug/:file', async (req, res) => {
    const slug = String(req.params.slug);
    const style = String(req.params.file).replace(/\.jpg$/i, '');
    const artikel = String(req.query.a || '').replace(/[^a-z]/g, '') || 'tee';
    const szene = String(req.query.szene || '') === '1';
    try {
      const jpg = await stilMockup(slug, style, artikel, szene);
      res.type('jpeg').set('cache-control', 'public, max-age=86400').send(jpg);
    } catch (e) { console.warn('Stilbeispiel ohne Bild:', slug, style, artikel, '-', e && e.message ? e.message : e); res.status(404).end(); }
  });

  // ---- oeffentlich: der reine Entwurf, ohne Textil drumherum ----
  // Fuer die Startseite ("So laeuft das", Schritt 2): dort soll ein echtes Design stehen und nicht das
  // fertige Shirt - das kommt erst in Schritt 3. Vorzeige-Designs sind Schaustuecke, deshalb ohne Signatur.
  app.get('/api/mo/entwurf/:slug/:file', async (req, res) => {
    const slug = String(req.params.slug);
    const style = String(req.params.file).replace(/\.png$/i, '');
    const id = (await read(slug))[style];
    if (!id) return res.status(404).end();
    try {
      const png = await fs.readFile(path.join(STORE, 'previews', `${id}.png`));
      res.type('png').set('cache-control', 'public, max-age=86400').send(png);
    } catch (e) { res.status(404).end(); }
  });

  // ---- Backend ----
  // Stand: welche Stile je Motto ein Beispiel haben
  app.get('/api/admin/vorzeige', adminGuard, async (req, res) => {
    const out = {}, gesperrt = {};
    for (const m of await mottos.all()) {
      out[m.slug] = await readRoh(m.slug);
      if (GESPERRT[m.slug]) gesperrt[m.slug] = GESPERRT[m.slug] === 'alles' ? ['alles'] : [...GESPERRT[m.slug]];
    }
    res.json({ samples: out, gesperrt, import: state });
  });

  // Manifest importieren (= Inhalt von vorzeige-designs.json), oder { manifestUrl: "https://..." }, oder einzeln { motto, style, url }
  app.post('/api/admin/vorzeige/import', adminGuard, async (req, res) => {
    if (state.running) return res.status(409).json({ error: 'Import laeuft bereits', import: state });
    let manifest = req.body || {};
    try {
      if (manifest.manifestUrl) {
        const r = await fetch(manifest.manifestUrl, { signal: AbortSignal.timeout(30000) });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        manifest = await r.json();
      }
    } catch (e) { return res.status(400).json({ error: 'Manifest nicht ladbar: ' + (e && e.message ? e.message : e) }); }
    let items = [];
    if (manifest.base && manifest.mottos) {
      // Manifest v2 (vorzeige-designs.json): { base, ext, mottos: { <slug>: { values, textile, styles: { <stil>: <bild-id> } } } }
      for (const [slug, m] of Object.entries(manifest.mottos)) {
        for (const [style, id] of Object.entries(m.styles || {})) {
          items.push({ slug, style, url: manifest.base + id + (manifest.ext || '.png'), textile: textilFuerStil(style, (m.styleTextile && m.styleTextile[style]) || m.textile), values: m.values || {} });
        }
        if (m.kachel) items.push({ slug, style: KACHEL, url: manifest.base + m.kachel + (manifest.ext || '.png'), textile: m.kachelTextile || m.textile || 'dunkel', values: m.values || {} });
      }
    } else if (Array.isArray(manifest.items)) {
      const vals = manifest.mottos || {};
      items = manifest.items.map(i => ({ slug: i.motto, style: i.style, url: i.url, textile: i.textile || 'dunkel', values: vals[i.motto] && vals[i.motto].values || {} }));
    } else if (manifest.motto && manifest.style && manifest.url) {
      items = [{ slug: manifest.motto, style: manifest.style, url: manifest.url, textile: manifest.textile || 'dunkel', values: manifest.values || {} }];
    }
    const only = req.query.motto ? String(req.query.motto) : null;
    if (only) items = items.filter(i => i.slug === only);
    if (!items.length) return res.status(400).json({ error: 'keine Eintraege' });
    runImport(items).catch(e => console.error('Vorzeige-Import:', e));
    res.json({ ok: true, gestartet: items.length });
  });

  // Aufmacher (oder ein Stilbeispiel) fuer ein Motto NEU ZEICHNEN LASSEN - im Server, in der
  // eingestellten Stufe, ohne dass jemand ein Werkzeug von Hand laufen laesst. Der Lauf dauert
  // ein paar Minuten und laeuft deshalb im Hintergrund; der Stand steht in derselben Anzeige
  // wie beim Import.
  app.post('/api/admin/vorzeige/erzeugen', adminGuard, async (req, res) => {
    if (state.running) return res.status(409).json({ error: 'Es laeuft gerade schon ein Lauf', import: state });
    if (typeof erzeugeBild !== 'function') return res.status(501).json({ error: 'Auf diesem Server ist das Erzeugen nicht eingerichtet' });
    const b = req.body || {};
    const slug = String(b.motto || '').trim();
    const style = String(b.style || KACHEL).trim();
    if (!slug) return res.status(400).json({ error: 'motto fehlt' });
    if (!kennt(style)) return res.status(400).json({ error: 'unbekannter Stil ' + style });
    if (!(await mottos.get(slug))) return res.status(404).json({ error: 'unbekanntes Motto ' + slug });
    // Was gesperrt ist, wird auch nicht neu gezeichnet - sonst entsteht Arbeit, die niemand sehen darf.
    if (komplettGesperrt(slug)) return res.status(409).json({ error: 'Dieses Motto ist gesperrt' });
    if (GESPERRT[slug] instanceof Set && GESPERRT[slug].has(style)) return res.status(409).json({ error: 'Dieser Platz ist gesperrt' });
    const vorgabe = await vorgabeFuer(slug, style);
    const werte = (b.values && Object.keys(b.values).length) ? b.values : (vorgabe && vorgabe.values);
    if (!werte || !Object.keys(werte).length) return res.status(400).json({ error: 'Fuer dieses Motto ist nicht hinterlegt, was auf dem Bild stehen soll - values mitschicken' });
    const anzahl = Math.min(4, Math.max(1, +b.anzahl || 1));
    const items = [];
    for (let i = 0; i < anzahl; i++) items.push({ neu: true, slug, style, values: werte, textile: b.textile || (vorgabe && vorgabe.textile) || 'dunkel', stil: b.stil || '' });
    runImport(items).catch(e => console.error('Vorzeige-Erzeugen:', e));
    res.json({ ok: true, gestartet: anzahl, motto: slug, style, values: werte });
  });

  // Einzelnen Stil auf ein vorhandenes Design setzen (z. B. ein besonders gutes Kundendesign) oder loeschen
  app.put('/api/admin/vorzeige/:slug/:style', adminGuard, async (req, res) => {
    const { slug, style } = req.params;
    if (!kennt(style)) return res.status(400).json({ error: 'unbekannter Stil' });
    const cur = await readRoh(slug);
    const id = String((req.body && req.body.designId) || '').replace(/[^A-Za-z0-9_-]/g, '');
    if (id) {
      try { await fs.access(path.join(STORE, 'masters', `${id}_PRINT_MASTER.png`)); } catch (e) { return res.status(404).json({ error: 'Design nicht gefunden' }); }
      cur[style] = id;
    } else delete cur[style];
    await write(slug, cur);
    // Zwischenspeicher mitloeschen, sonst kommt das entfernte Bild ueber den Cache zurueck.
    // Der Aufmacher ('kachel') steckt zusaetzlich in den Startseiten-Mockups sample_<slug>_<id>_*.
    try { await fs.rm(path.join(STORE, 'mockups', `stil_${slug}_${style}.jpg`), { force: true }); } catch (e) { /* egal */ }
    try {
      const mk = path.join(STORE, 'mockups');
      for (const f of await fs.readdir(mk)) {
        if (f.startsWith(`sample_${slug}_`) || f.startsWith(`stil_${slug}_${style}`)) await fs.rm(path.join(mk, f), { force: true });
      }
    } catch (e) { /* kein Mockup-Ordner - dann gibt es auch nichts zu loeschen */ }
    res.json({ ok: true, samples: cur });
  });

  // Automatischer Import beim Start: liegt im Repo eine vorzeige-designs.json, werden alle darin genannten
  // Motto/Stil-Paare angelegt, die noch fehlen ODER deren Bild sich im Manifest geaendert hat. Kein Handgriff im Backend noetig.
  // Ein Vorzeige-Bild aus dem Repo (vorzeige/<motto>/<name>.jpg|png|webp): sourceUrl "repo:<datei>:<Groesse>" wie beim Schaufenster.
  async function repoBild(datei) {
    const d = String(datei || '').replace(/[^A-Za-z0-9_./-]/g, '');
    if (!/^vorzeige\/[a-z0-9-]+\/[a-z0-9-]+\.(jpg|png|webp)$/.test(d)) { console.error('Vorzeige: Datei ' + d + ' liegt nicht unter vorzeige/<motto>/ - uebersprungen'); return null; }
    try { const png = await fs.readFile(new URL('./' + d, import.meta.url)); return { url: 'repo:' + d + ':' + png.length, png }; }
    catch (err) { console.error('Vorzeige: ' + d + ' fehlt im Repo (' + err.message + ')'); return null; }
  }
  async function autoImport() {
    let manifest;
    try { manifest = JSON.parse(await fs.readFile(new URL('./vorzeige-designs.json', import.meta.url), 'utf8')); }
    catch (e) { return { skipped: 'keine vorzeige-designs.json im Repo' }; }
    if (!manifest.base || !manifest.mottos) return { skipped: 'Manifest-Format unbekannt' };
    const items = [];
    for (const [slug, m] of Object.entries(manifest.mottos)) {
      // readRoh, NICHT read: die Sperrliste ist eine ANZEIGEregel ("zeig das nicht"), keine
      // Speicherregel. Mit read() sah der Import bei einem gesperrten Motto ein leeres Fach,
      // hielt alle Stile fuer fehlend und legte sie bei JEDEM Serverstart komplett neu an.
      // Jeder Deploy also ein neuer Satz Designs - ausgerechnet die gesperrten Motive - und
      // alle landeten in der Druckliste zwischen der Kundenarbeit.
      const have = await readRoh(slug);
      if (!(await mottos.get(slug))) continue;
      // Was ohnehin niemand sehen darf, wird auch nicht mehr geholt und angelegt.
      if (komplettGesperrt(slug)) continue;
      const gesperrt = GESPERRT[slug] instanceof Set ? GESPERRT[slug] : null;
      // 9. Okt.: "plaetzeWeg" nimmt alte Plaetze heraus, die das Manifest nicht mehr fassen kann (Hochzeit: ein zweiter
      // Shopper "streetart@shopper" vom 21. Sept. mit gesperrtem Vornamen; den Shopper traegt seit 23. Sept. graffiti@shopper).
      const weg = (m.plaetzeWeg || []).filter(p => have[p]);
      if (weg.length) { for (const p of weg) delete have[p]; await write(slug, have); console.log('Vorzeige: ' + slug + ' Plaetze entfernt: ' + weg.join(', ')); }
      const paare = Object.entries(m.styles || {});
      if (m.kachel || m.kachelDatei) paare.push([KACHEL, m.kachelDatei ? 'datei:' + m.kachelDatei : m.kachel]);
      for (const [style, id] of paare) {
        if (!kennt(style)) continue;
        if (gesperrt && gesperrt.has(style)) continue;
        // 9. Okt.: ein Eintrag "datei:vorzeige/<motto>/<name>" liegt im Repo (wie das Schaufenster) - Adressen des Bilddienstes laufen ab,
        // und ein nachtraeglich berichtigtes Bild (Name "Anna" ersetzt) hat gar keine.
        const repo = String(id).startsWith('datei:') ? await repoBild(String(id).slice(6)) : null;
        if (String(id).startsWith('datei:') && !repo) continue;
        // Fassung 83: Bisher war jeder Eintrag eine nackte Kennung, an die vorne die eine
        // base und hinten die ext geklebt wurde. Die neu erzeugten Designs liegen aber auf
        // einem anderen Namen desselben Dienstes (ballz-image-mcp-production.up.railway.app
        // statt mcp.markusassemacher.de). Statt zu RATEN, dass eine Kennung unter beiden
        // Namen erreichbar ist, darf ein Eintrag jetzt auch eine vollstaendige Adresse sein -
        // dann gilt sie, wie sie dasteht. Alle bisherigen Eintraege bleiben unveraendert.
        const url = repo ? repo.url : /^https?:\/\//i.test(String(id)) ? String(id) : manifest.base + id + (manifest.ext || '.png');
        if (have[style]) {
          // Schon da - aber ist es noch dasselbe Bild? Wenn das Manifest ein neues nennt, wird ersetzt (z. B. Strandhaie statt Papagei).
          let same = true;
          try { same = JSON.parse(await fs.readFile(path.join(STORE, 'jobs', `${have[style]}.json`), 'utf8')).sourceUrl === url; } catch (e) { same = false; }
          if (same) continue;
        }
        // Der Stil entscheidet das Textil, nicht das Motto: er bringt seine Palette mit.
        // Aquarell auf Hell, weil der hellste Wert unbemaltes Papier ist; Vintage auf Hell,
        // weil ausgewaschene Mitteltoene auf Schwarz absaufen; Neon auf Dunkel, weil
        // Leuchtroehren nur nachts leuchten. Die ganze Tabelle steht in mottos.js.
        const textile = style === KACHEL ? (m.kachelTextile || m.textile || 'dunkel')
          : textilFuerStil(style, (m.styleTextile && m.styleTextile[style]) || m.textile);
        // Fassung 83: kachelValues schlaegt values - genau wie kachelTextile schon das Textil
        // schlaegt. Grund: der Auftragszettel muss beschreiben, was WIRKLICH auf dem Bild
        // steht. Das Kachelbild fuer Abi zeigt "ABIrama", die zwoelf Stilbeispiele desselben
        // Mottos zeigen "ABInauten". Mit einem gemeinsamen values-Fach wuerde einer der
        // beiden Auftragszettel luegen - und aus dem Zettel lebt spaeter die Druckdatei.
        const werte = style === KACHEL ? (m.kachelValues || m.values || {}) : (m.values || {});
        items.push({ slug, style, url, ...(repo ? { png: repo.png } : {}), textile, values: werte });
      }
      // 21. Sept.: Designs, die fuer EINEN Artikel gezeichnet sind (Kissen, Handtuch, Mousepad ...):
      //   "artikel": { "kissen": { "style": "aquarell", "textile": "hell", "url": "https://..." } }
      // Platz im Fach "<stil>@<artikel>"; ersetzt wird wie oben nur, wenn das Manifest ein neues Bild nennt.
      for (const [aId, e] of Object.entries(m.artikel || {})) {
        if (!e || !(e.url || e.datei) || !ARTIKEL[aId]) continue;
        const style = e.style || 'standard';
        if (!kennt(style)) continue;
        const platz = style + '@' + aId;
        const repo = e.datei ? await repoBild(e.datei) : null;
        if (e.datei && !repo) continue;
        const url = repo ? repo.url : /^https?:\/\//i.test(String(e.url)) ? String(e.url) : manifest.base + e.url + (manifest.ext || '.png');
        if (have[platz]) {
          let same = true;
          try { same = JSON.parse(await fs.readFile(path.join(STORE, 'jobs', `${have[platz]}.json`), 'utf8')).sourceUrl === url; } catch (err) { same = false; }
          if (same) continue;
        }
        items.push({ slug, style, url, ...(repo ? { png: repo.png } : {}), textile: e.textile || m.textile || 'dunkel', values: e.values || m.values || {}, artikel: aId });
      }
    }
    // 3. Okt.: die Schaufenster-Designs liegen im REPO (startseite/schaufenster/<motto>.webp), nicht beim
    // Bilddienst - dessen Adressen laufen ab. "sourceUrl" ist dann "repo:<datei>:<Groesse>", damit ein
    // getauschtes Bild beim naechsten Start neu angelegt wird und ein gleiches nicht noch einmal.
    for (const [slug, m] of Object.entries(manifest.mottos)) {
      const e = m.schaufenster;
      if (!e || !e.datei || !kennt(e.style) || !(await mottos.get(slug))) continue;
      const datei = String(e.datei).replace(/[^A-Za-z0-9_./-]/g, '');
      if (!/^startseite\/schaufenster\/[a-z0-9-]+\.(webp|png)$/.test(datei)) { console.error('Vorzeige-Schaufenster: Datei ' + datei + ' liegt nicht unter startseite/schaufenster - uebersprungen'); continue; }
      let png;
      try { png = await fs.readFile(new URL('./' + datei, import.meta.url)); } catch (err) { console.error('Vorzeige-Schaufenster: ' + datei + ' fehlt im Repo (' + err.message + ')'); continue; }
      const url = 'repo:' + datei + ':' + png.length;
      const have = await readRoh(slug);
      const alt = have[e.style + SCHAU];
      if (alt) {
        let same = false;
        try { same = JSON.parse(await fs.readFile(path.join(STORE, 'jobs', `${alt}.json`), 'utf8')).sourceUrl === url; } catch (err) { same = false; }
        if (same) continue;
      }
      items.push({ slug, style: e.style, url, png, textile: e.textile || textilFuerStil(e.style, m.textile), values: e.values || {}, schaufenster: true });
    }
    if (!items.length) return { skipped: 'alles vorhanden' };
    if (state.running) return { skipped: 'Import laeuft bereits' };
    console.log('Vorzeige-Designs: importiere', items.length, 'Beispiele aus vorzeige-designs.json');
    runImport(items).then(() => console.log('Vorzeige-Designs: fertig,', state.errors.length, 'Fehler', state.errors.slice(0, 5)))
      .catch(e => console.error('Vorzeige-Import:', e));
    return { started: items.length };
  }
  // ---------- Fassung 15: die alten Street-Art-Bilder heissen jetzt Graffiti ----------
  // Street Art ist neu definiert (Kiezwand mit Ebenen). Die vorhandenen Bilder sind aber mit
  // dem ALTEN Text entstanden - und genau dieser Text lebt als eigener Stil "Graffiti" weiter.
  // Also gehoeren die Bilder dorthin. Street Art bleibt danach ohne Beispiel, bis neue Bilder
  // da sind: lieber kein Bild als ein falsches, das den Stil verspricht, den es nicht zeigt.
  // Laeuft genau einmal, die Merkdatei verhindert eine Wiederholung.
  async function graffitiUmzug() {
    const marke = path.join(DIR, '.graffiti-umzug');
    try { await fs.access(marke); return; } catch (e) { /* noch nicht gelaufen */ }
    let n = 0;
    try {
      await fs.mkdir(DIR, { recursive: true });
      for (const m of await mottos.all()) {
        const s = await read(m.slug);
        if (!s.streetart || s.graffiti) continue;
        s.graffiti = s.streetart;
        delete s.streetart;
        await write(m.slug, s);
        // Das zwischengespeicherte Mockup traegt den alten Stilnamen im Dateinamen
        try { await fs.rm(path.join(STORE, 'mockups', `stil_${m.slug}_streetart.jpg`), { force: true }); } catch (e2) { /* egal */ }
        n++;
      }
      await fs.writeFile(marke, new Date().toISOString());
      if (n) console.log('Fassung 15:', n, 'Street-Art-Beispiele zu Graffiti umgezogen');
    } catch (e) { console.error('Graffiti-Umzug:', e && e.message ? e.message : e); }
  }

  // 20 s nach dem Start, damit Vorlagen/Logo erst geladen sind
  // Nicht in der Abnahme: die mountet das Modul mit einem Pruefordner und darf nie 259 Bilder holen.
  if (!process.env.ABNAHME) setTimeout(() => autoImport().catch(e => console.error('Vorzeige-Autoimport:', e && e.message ? e.message : e)), 20000);
  graffitiUmzug().catch(e => console.error('Graffiti-Umzug:', e));

  return { publicSamples, importOne, erzeuge, read, readRoh, autoImport, komplettGesperrt, stilMockup, stilFertig };
}
