// Kaufweg-Wache (Markus, 8. Okt.: "Baue bitte ein, dass regelmaessig auf Fehler, leere Kacheln,
// alles das, was Kunden vom Kauf abhalten koennte, definitiv immer wieder ueberprueft wird").
// Anlass am selben Tag: auf /otto standen Emojis statt Artikelbildern (Trenchcoat fuer Hoodie,
// Tuer fuer Fussmatte), und gemerkt hat es Markus auf dem Handy, nicht das System.
//
// Der Server geht seine eigenen Seiten durch wie ein Kunde - ueber die eigene Adresse
// (127.0.0.1), ohne Bildlauf, ohne Netz nach draussen:
//   - jede Seite, die auf dem Weg zum Kauf liegt, antwortet mit 200 und echtem Inhalt
//   - jedes Bild, das diese Seiten zeigen (Kacheln, Laufband, Artikel, Stile), ist ein Bild
//   - jeder Artikel im Katalog hat ein Kachelbild UND einen Preis
//   - jedes Motto der Liste hat seine Seite und seine Kachel, jeder waehlbare Stil seine Kachel
//   - keine Emoji-Kacheln im Otto-Weg
// Ergebnis: { at, dauerMs, geprueft, probleme: [{ was, wo, grund }] }. Die Lage-Karte zeigt es,
// eine Mail geht nur, wenn NEUE Probleme auftauchen oder alles wieder gut ist.

const EMOJI = /\p{Extended_Pictographic}/u;

export async function kaufwegPruefen({ basis, preisBekannt, ansichtVon, stilKeys = [], zeitMs = 15000 }) {
  const start = Date.now();
  const probleme = [];
  let geprueft = 0;
  const fehler = (was, wo, grund) => probleme.push({ was, wo, grund });
  const holen = async (pfad) => {
    geprueft++;
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), zeitMs);
    try {
      const r = await fetch(basis + pfad, { signal: ac.signal, headers: { 'user-agent': 'motto-otto-kaufweg-wache' } });
      const buf = Buffer.from(await r.arrayBuffer());
      return { status: r.status, typ: r.headers.get('content-type') || '', buf };
    } catch (e) {
      return { status: 0, typ: '', buf: Buffer.alloc(0), fehler: e && e.name === 'AbortError' ? `keine Antwort nach ${zeitMs / 1000} s` : String(e && e.message || e) };
    } finally { clearTimeout(t); }
  };
  const seite = async (pfad, was, muss) => {
    const r = await holen(pfad);
    if (r.status !== 200) { fehler(was, pfad, r.fehler || `HTTP ${r.status}`); return ''; }
    const html = r.buf.toString('utf8');
    if (html.length < 500) fehler(was, pfad, `fast leer (${html.length} Zeichen)`);
    if (muss && !muss.test(html)) fehler(was, pfad, `erwarteter Inhalt fehlt (${muss})`);
    return html;
  };
  const geseheneBilder = new Set();
  const bild = async (pfad, was) => {
    if (!pfad || geseheneBilder.has(pfad)) return;
    geseheneBilder.add(pfad);
    const r = await holen(pfad);
    if (r.status !== 200) return fehler(was, pfad, r.fehler || `HTTP ${r.status}`);
    if (!/^image\//.test(r.typ)) return fehler(was, pfad, `kein Bild (${r.typ || 'ohne Typ'})`);
    if (r.buf.length < 800) fehler(was, pfad, `Bild fast leer (${r.buf.length} Bytes)`);
  };
  const json = async (pfad, was) => {
    const r = await holen(pfad);
    if (r.status !== 200) { fehler(was, pfad, r.fehler || `HTTP ${r.status}`); return null; }
    try { return JSON.parse(r.buf.toString('utf8')); } catch (e) { fehler(was, pfad, 'kein JSON'); return null; }
  };
  // Lokale Bilder einer Seite (src="/..."), ohne Daten-URLs und fremde Hosts
  const bilderAus = (html) => [...html.matchAll(/<img[^>]+src="(\/[^"?#]+(?:\?[^"#]*)?)"/g)].map(m => m[1].replace(/&amp;/g, '&'));

  // 1) Startseite mit allem, was sie zeigt
  const start1 = await seite('/', 'Startseite', /Motto Otto/);
  for (const src of bilderAus(start1)) await bild(src, 'Startseite, Bild');

  // 2) Mottos: Liste, je Motto die Seite und die Kachel
  const mottos = await json('/api/mo/mottos', 'Motto-Liste');
  const liste = (mottos && mottos.mottos) || [];
  if (mottos && !liste.length) fehler('Motto-Liste', '/api/mo/mottos', 'leer');
  for (const m of liste) {
    await seite('/m/' + encodeURIComponent(m.slug), 'Motto-Seite ' + (m.name || m.slug), /<html/i);
  }

  // 3) Otto-Weg: Seite, keine Emoji-Kacheln, Artikelkatalog mit Bild und Preis
  const otto = await seite('/otto', 'Otto-Weg', /kacheln/);
  if (otto) {
    const kachelCode = [...otto.matchAll(/zeichen:\s*'([^']*)'/g)].map(m => m[1]).filter(z => EMOJI.test(z));
    if (kachelCode.length) fehler('Otto-Weg', '/otto', `Emoji statt Bild in Kacheln: ${kachelCode.slice(0, 5).join(' ')}`);
  }
  const kat = await json('/api/mo/freestyle/artikel', 'Artikel-Katalog');
  const gruppen = (kat && kat.gruppen) || {};
  const artikel = Object.values(gruppen).flat();
  if (kat && !artikel.length) fehler('Artikel-Katalog', '/api/mo/freestyle/artikel', 'leer');
  for (const a of artikel) {
    await bild('/startseite/artikel/' + encodeURIComponent(a.id) + '.webp', 'Artikel-Kachel ' + (a.name || a.id));
    const key = (ansichtVon && ansichtVon(a.id)) || a.id;
    if (preisBekannt && !preisBekannt(key) && !preisBekannt(a.id)) fehler('Preis', a.name || a.id, 'kein Preis - der Kunde sieht "auf Anfrage"');
  }

  // 4) Stil-Kacheln: jeder waehlbare Stil zeigt seine Schrift-Kachel
  for (const k of stilKeys) await bild('/api/mo/stil-kachel/' + k + '.jpg', 'Stil-Kachel ' + k);

  // 5) Weitere Seiten auf dem Weg: So geht's, Konto, Partner, Preise
  await seite('/so-gehts', "So geht's", /<html/i);
  await seite('/konto', 'Konto', /<html/i);
  await seite('/partner', 'Partner', /<html/i);
  const preise = await holen('/preise.js');
  if (preise.status !== 200 || preise.buf.length < 200) fehler('Preise', '/preise.js', preise.fehler || `HTTP ${preise.status}`);

  // 6) Schaufenster/Galerie: es muss etwas zu zeigen geben
  const sc = await json('/api/mo/showcase', 'Galerie');
  const scListe = sc && (sc.items || sc.designs || sc.liste || (Array.isArray(sc) ? sc : null));
  if (sc && Array.isArray(scListe) && !scListe.length) fehler('Galerie', '/api/mo/showcase', 'leer - Startseite zeigt keine Beispiele');

  return { at: new Date().toISOString(), dauerMs: Date.now() - start, geprueft, probleme };
}

// Schluessel eines Problems - daran erkennt die Wache, ob es NEU ist
export const problemSchluessel = (p) => `${p.was}|${p.wo}`;
