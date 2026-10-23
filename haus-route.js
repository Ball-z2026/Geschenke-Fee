// haus-route.js - das Tor je Betrieb: QR am Tisch -> Motto Otto im Design des Hauses
// =============================================================================================
// Markus, 1. Okt. 2026: "Der Gast scannt den QR-Code auf dem Tisch, dann geht Motto Otto im
// Design des Gastronomen auf: ... Merchandise, passend zum Gastronomen, nur mit der Moeglichkeit,
// dass es noch personalisiert werden kann." Und: "Mach das komplett fertig mit 20 % Lizenzgebuehr fuer EAST26, generiere mir
// auch einen QR-Code dazu, und mit dem QR-Code soll diese Seite direkt so aufgehen und auch
// schon das EAST26-Logo direkt anzeigen."
//
// /bei/<slug>                    die Seite des Hauses: Logo, Hausfarben, Shop (Shirt & Co.)
// /bei/<slug>/aufsteller         der Tischaufsteller zum Drucken (A6, Logo + QR)
// /api/mo/bei/<slug>/qr.png      der QR-Code (1200 px, fuer den Druck)
// /api/mo/bei/<slug>/<teil>.jpg  das Design des Hauses auf einem Artikel (vorgebaut)
// /api/admin/lizenzen?firma=     Designs mit Lizenz je Betrieb (fuer die Abrechnung der 20 %)
// /api/admin/firmen/<slug>/stripe Connect-Konto des Betriebs anlegen (dorthin geht die Lizenz)
// =============================================================================================

import fs from 'node:fs/promises';
import path from 'node:path';
import { qrPng } from './qr.js';
import { angebotVon } from './partner-route.js';
import { SHOP_TEILE } from './partner.js';
import { dominantColors } from './images.js';
import { connectKontoAnlegen, connectEinrichtungsLink, connectKontoStand } from './billing.js';

const HIER = path.dirname(new URL(import.meta.url).pathname);
const HAUS_DIR = path.join(HIER, 'postkarte', 'haus');

/** Die Teile, die das Tor zeigt - in dieser Reihenfolge, mit Listenpreis aus preise.cjs. */
// 1. Okt., Markus zur ersten Fassung: "Beutel sieht Katastrophe aus ... und das Schneidebrett
// nehmen wir komplett raus, ueberall." Dann: "Zum EAST in Mallorca wuerde natuerlich auch ein
// Handtuch passen, richtig?" - ja: das Strandtuch (70 x 140, vollflaechig) ist drin.
export const TOR_TEILE = ['tee', 'hoodie', 'tasse', 'kissen', 'poster', 'strandtuch', 'acrylbild', 'fussmatte'];

export function mountHaus(app, { STORE, env, adminGuard, firmenListe, firmenSlug, umfang, readTpl, escHtml, preise, lizenzen = null, lizenzDeps = () => ({}), bilderDir = '', logoBild = null, nachweisLesen = async () => ({}), nachweisSchreiben = async () => {}, log = console }) {
  const basis = () => String(env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');
  const kern = (s) => firmenSlug(s).replace(/[-_]/g, '');
  async function eintragFuer(slug) {
    const s = kern(slug);
    if (!s) return null;
    return (await firmenListe()).find(e => kern(e.firma) === s || (e.namen || []).some(n => kern(n) === s)) || null;
  }
  const hell = (hex) => { const m = String(hex || '').match(/^#?([0-9a-f]{6})$/i); if (!m) return 0.5; const n = parseInt(m[1], 16); return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };
  // 2. Okt.: Bestes vom Elbdeich Hamburg trug als Hausfarbe Creme (#FFF2D5) - "zum Mitnehmen", die
  // Etiketten und die Knoepfe waren auf dem Papier unsichtbar. Eine Farbe, die als Schrift taugen
  // muss, darf nicht hell sein: dann die naechste dunkle Hausfarbe, sonst die kraeftigste Farbe aus
  // dem Logo (bunt, nicht hell, mindestens 4 % der Flaeche), sonst Tinte.
  const AKZENTE = new Map();
  const hexVon = (c) => '#' + [c.r, c.g, c.b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  async function akzentVon(e) {
    const farben = (Array.isArray(e.farben) ? e.farben : []).filter(f => /^#?[0-9a-f]{6}$/i.test(String(f)));
    const dunkel = farben.find(f => hell(f) <= 0.6);
    if (farben[0] && hell(farben[0]) <= 0.6) return farben[0];
    if (dunkel) return dunkel;
    const schluessel = firmenSlug(e.firma) + '|' + farben.join(',') + '|' + (e.datei || '');
    if (AKZENTE.has(schluessel)) return AKZENTE.get(schluessel);
    let akzent = '#1B1710';
    try {
      const png = logoBild ? await logoBild(e) : null;
      if (png) {
        const bunt = (await dominantColors(png)).filter(c => c.share >= 0.04 && Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b) >= 60).map(hexVon).find(h => hell(h) <= 0.6);
        if (bunt) akzent = bunt;
      }
    } catch (err) { log.error('Tor-Akzent aus dem Logo:', e.firma, err && err.message ? err.message : err); }
    log.log('Tor-Akzent: ' + e.firma + ' · Hausfarbe ' + (farben[0] || 'keine') + ' zu hell -> ' + akzent);
    AKZENTE.set(schluessel, akzent);
    return akzent;
  }
  // 2. Okt.: Partner ohne vorgebaute Bilder (selbst angemeldet) haben ihre Logo-Bilder auf dem
  // Volume (storage/partner/bilder, partner-route.js bilderBauen). Erst das Repo, dann das Volume.
  async function bildDatei(name) {
    for (const d of [HAUS_DIR, bilderDir].filter(Boolean)) { try { await fs.access(path.join(d, name)); return path.join(d, name); } catch (e) { /* weiter */ } }
    return null;
  }

  const heldZeile = (h) => (h.art === 'verein' ? 'Dein Verein, <em>zum Mitnehmen.</em>' : h.gastro ? 'Dein Abend hier, <em>zum Mitnehmen.</em>' : 'Dein Besuch hier, <em>zum Mitnehmen.</em>');
  /** Was die Seite ueber ein Haus wissen muss - nur Dinge aus der Freigabe, nie Kundendaten. */
  async function haus(e) {
    const slug = firmenSlug(e.firma);
    const akzent = (Array.isArray(e.farben) && e.farben.length) ? await akzentVon(e) : '#C03A2B';
    // 2. Okt., Markus: "... wo sie eigenstaendig einstellen koennen, was die Leute kaufen koennen."
    // Der Shop zeigt, was der Partner anbietet (angebotVon) - und nur Teile, die man im einfachen
    // Weg auch wirklich machen kann (SHOP_TEILE; die Tasse fehlt dort, Chat-1-Befund vom 1. Okt.).
    const angebot = angebotVon(e);
    const teile = [];
    for (const t of SHOP_TEILE) if (angebot.teile.includes(t.id) && await bildDatei(slug + '-' + t.id + '.jpg')) teile.push({ id: t.id, name: preise.label(t.id), preis: preise.listenpreis(t.id) });
    // 2. Okt., Markus: "Auch der Name kann nicht aus der kompletten Firmenbezeichnung genommen
    // werden. Bei Luigi gehoert Luigi drauf, und nicht Luigi's Pizza UG." Der Kunde sieht den
    // Anzeigenamen (Eintrag anzeige), die Firmenbezeichnung bleibt fuer Abrechnung und Backend.
    return {
      slug, name: String(e.anzeige || e.firma), akzent, akzentHell: hell(akzent) > 0.6, gastro: !!e.gastro, art: e.art || (e.gastro ? 'gastro' : 'betrieb'),
      ort: String(e.adresse || e.ort || '').split(',').pop().replace(/^\s*\d{4,5}\s*/, '').trim() || e.ort || '',
      webseite: String(e.webseite || '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, ''),
      logo: umfang(e) === 'voll' ? '/api/mo/firmenlogo/' + slug + '.png' : '',
      teile, lizenz: e.lizenz || null
    };
  }

  app.get('/bei/:slug', async (req, res) => {
    const e = await eintragFuer(req.params.slug);
    if (!e || !(e.freigabe && e.freigabe.datum)) return res.redirect('/');
    const h = await haus(e);
    const teileHtml = h.teile.map(t =>
      `<a class="teil" href="/bei/${encodeURIComponent(h.slug)}/machen?was=teil&amp;teil=${encodeURIComponent(t.id)}"><img src="/api/mo/bei/${h.slug}/${t.id}.jpg" alt="${escHtml(t.name)} mit dem Design von ${escHtml(h.name)}" loading="lazy"><span class="teil-name">${escHtml(t.name)}</span><span class="teil-marke">mit deinem Namen</span><span class="teil-preis">ab ${escHtml(preise.euro ? preise.euro(t.preis) : String(t.preis).replace('.', ',') + ' €')}</span></a>`
    ).join('');
    const html = (await readTpl('haus.html'))
      .replace(/__NAME__/g, escHtml(h.name))
      .replace(/__SLUG__/g, escHtml(h.slug))
      .replace(/__ORT__/g, escHtml(h.ort))
      .replace(/__WEBSEITE__/g, escHtml(h.webseite))
      .replace(/__AKZENT__/g, escHtml(h.akzent))
      .replace(/__AKZENT_INK__/g, h.akzentHell ? '#1B1710' : '#FFFFFF')
      .replace(/__LOGO__/g, h.logo ? `<img class="logo" src="${h.logo}" alt="${escHtml(h.name)}">` : `<span class="logo-wort">${escHtml(h.name)}</span>`)
      .replace(/__TEE__/g, h.teile.some(t => t.id === 'tee') ? `<img src="/api/mo/bei/${h.slug}/tee.jpg" alt="Shirt mit dem Design von ${escHtml(h.name)}">` : '<span class="zeichen">◎</span>')
      .replace(/__TEILE__/g, teileHtml)
      .replace(/__TEILE_KLASSE__/g, h.teile.length ? '' : 'hide')
      // 2. Okt.: ein Verein ist kein Abendessen - die Kopfzeile richtet sich nach der Art des Partners.
      .replace(/__HELD__/g, heldZeile(h));
    // Die Lizenz (Prozent, Vertrag) steht nicht auf der Kundenseite - Markus, 1. Okt.: "Das ist doch Kundenseite!"
    res.set('Cache-Control', 'no-cache').type('html').send(html);
  });

  // Der Aufsteller fuer den Tisch: A6 hoch, Logo oben, QR in der Mitte, drei Worte darunter.
  app.get('/bei/:slug/aufsteller', async (req, res) => {
    const e = await eintragFuer(req.params.slug);
    if (!e || !(e.freigabe && e.freigabe.datum)) return res.redirect('/');
    const h = await haus(e);
    res.set('Cache-Control', 'no-cache').type('html').send(`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tischaufsteller · ${escHtml(h.name)}</title>
<style>
@page{size:A6 portrait;margin:0}
*{box-sizing:border-box}body{margin:0;background:#777;font-family:"Archivo",system-ui,-apple-system,sans-serif}
.blatt{width:105mm;height:148mm;margin:10mm auto;background:#F7F1E4;color:#1B1710;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:9mm 8mm 7mm;border:0.6mm solid ${escHtml(h.akzent)};position:relative}
.blatt .logo{max-width:60mm;max-height:26mm;object-fit:contain}
.blatt .wort{font-size:9mm;font-weight:800;letter-spacing:.02em;color:${escHtml(h.akzent)}}
.qr{width:62mm;height:62mm;display:block}
h1{font-size:6.2mm;margin:0;text-align:center;line-height:1.2;font-weight:800}
p{margin:1.5mm 0 0;font-size:3.6mm;text-align:center;color:#4a4238;line-height:1.35}
.fuss{font-size:3mm;color:#7a7066;text-align:center}
.fuss b{color:${escHtml(h.akzent)}}
@media print{body{background:#fff}.blatt{margin:0;border:0}}
.hinweis{max-width:105mm;margin:0 auto 10mm;color:#eee;font-size:13px;text-align:center}
@media print{.hinweis{display:none}}
</style></head><body>
<div class="blatt">
  ${h.logo ? `<img class="logo" src="${h.logo}" alt="${escHtml(h.name)}">` : `<div class="wort">${escHtml(h.name)}</div>`}
  <div><h1>${heldZeile(h).replace(', <em>', ',<br>').replace('</em>', '')}</h1><p>Scannen, Wunsch sagen, fertig: dein Motiv mit dem Logo von ${escHtml(h.name)} auf Shirt &amp; Co.</p></div>
  <img class="qr" src="/api/mo/bei/${h.slug}/qr.png" alt="QR-Code">
  <div class="fuss">motto-otto.de/bei/<b>${escHtml(h.slug)}</b></div>
</div>
<p class="hinweis">Drucken: A6, ohne Rand. Der Rahmen zeigt die Kante.</p>
</body></html>`);
  });

  app.get('/api/mo/bei/:slug/qr.png', async (req, res) => {
    const e = await eintragFuer(req.params.slug);
    if (!e) return res.status(404).end();
    try {
      const png = await qrPng(basis() + '/bei/' + firmenSlug(e.firma), 1200, { dunkel: '#1B1710', hell: '#FFFFFF' });
      res.type('png').set('Cache-Control', 'public, max-age=86400').send(png);
    } catch (err) { log.error('Tisch-QR:', e.firma, err && err.message ? err.message : err); res.status(500).end(); }
  });

  app.get('/api/mo/bei/:slug/:datei', async (req, res) => {
    const e = await eintragFuer(req.params.slug);
    const datei = String(req.params.datei || '').replace(/[^a-z0-9.-]/g, '');
    if (!e || !/^[a-z0-9-]+\.jpg$/.test(datei)) return res.status(404).end();
    const name = firmenSlug(e.firma) + '-' + datei;
    const pfad = await bildDatei(name);
    try { if (!pfad) throw new Error('fehlt'); res.type('jpeg').set('Cache-Control', 'public, max-age=3600').send(await fs.readFile(pfad)); }
    catch (err) { res.status(404).end(); }
  });

  // Stripe-Konto des Betriebs anlegen (oder den Einrichtungs-Link neu holen) - auf dieses Konto
  // ueberweist lizenzen.js die Lizenz. Die Konto-Nummer steht im Nachweis (stripeKonto).
  app.post('/api/admin/firmen/:slug/stripe', adminGuard, async (req, res) => {
    const e = await eintragFuer(req.params.slug);
    if (!e) return res.status(404).json({ error: 'Betrieb unbekannt' });
    const key = env.STRIPE_SECRET_KEY || '';
    if (!key) return res.status(503).json({ error: 'STRIPE_SECRET_KEY fehlt' });
    try {
      const nw = await nachweisLesen().catch(() => ({}));
      let konto = e.stripeKonto || (nw[e.firma] || {}).stripeKonto || '';
      let url;
      if (konto) url = await connectEinrichtungsLink({ secretKey: key, account: konto, baseUrl: basis(), zurueck: '/admin' });
      else {
        const k = await connectKontoAnlegen({ secretKey: key, email: String((req.body || {}).email || ''), name: e.firma, baseUrl: basis(), zurueck: '/admin' });
        konto = k.account; url = k.url;
        const neu = await nachweisLesen().catch(() => ({}));
        neu[e.firma] = { ...(neu[e.firma] || {}), stripeKonto: konto, stripeAngelegt: new Date().toISOString() };
        await nachweisSchreiben(neu);
      }
      const stand = await connectKontoStand({ secretKey: key, account: konto }).catch(() => null);
      log.log('Stripe-Konto:', e.firma, konto, stand ? JSON.stringify(stand) : '');
      res.json({ ok: true, firma: e.firma, konto, einrichtung: url, stand });
    } catch (err) { log.error('Stripe-Konto:', e.firma, err.message); res.status(502).json({ error: err.message }); }
  });

  // Die Lizenz-Abrechnung (lizenzen.js): jeder Satz je Bestellzeile mit Lizenz, Summen je
  // Betrieb, und der Knopf, eine offene oder gescheiterte Ueberweisung noch einmal anzustossen.
  app.get('/api/admin/lizenzen', adminGuard, async (req, res) => {
    if (!lizenzen) return res.json({ anzahl: 0, saetze: [], summen: [] });
    const firma = String(req.query.firma || '');
    const saetze = await lizenzen.liste(STORE, { firmaSlug: firma ? firmenSlug(firma) : '', status: String(req.query.status || '') });
    res.json({ anzahl: saetze.length, summen: lizenzen.summen(saetze), saetze });
  });
  app.post('/api/admin/lizenzen/:id/ueberweisen', adminGuard, async (req, res) => {
    if (!lizenzen) return res.status(503).json({ error: 'Lizenzen nicht eingehaengt' });
    try { res.json({ ok: true, lizenz: await lizenzen.ueberweisen(STORE, req.params.id, lizenzDeps()) }); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
  // Probe fuers Backend: eine Bestellung mit EINER Zeile durchspielen, ohne Shopify - damit Markus
  // sieht, was mit einem echten Konto passieren wuerde (Satz, Betrag, Status).
  app.post('/api/admin/lizenzen/probe', adminGuard, async (req, res) => {
    if (!lizenzen) return res.status(503).json({ error: 'Lizenzen nicht eingehaengt' });
    const b = req.body || {};
    const order = { id: 'probe-' + Date.now(), name: '#PROBE', currency: 'EUR', line_items: [{ sku: 'MO-' + String(b.designId || '') + '__' + String(b.produkt || 'tee') + '__', price: +b.preis || 24.9, quantity: +b.menge || 1 }] };
    try { res.json({ ok: true, saetze: await lizenzen.beiBestellung(STORE, order, lizenzDeps()) }); }
    catch (e) { res.status(400).json({ error: e.message }); }
  });
}
