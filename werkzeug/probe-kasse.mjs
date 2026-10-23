// Nachstellen (6. Okt., Markus: "bitte den zahlungsweg auf der seite ueberpruefen" - "ja alles machen"): der Kaufweg auf der
// Ergebnisseite mit offener Shopify-Kasse. Gemessen war vorher: Karte "Fertiges Produkt" sagte "auf Anfrage", der Kaufknopf lag
// auf dem iPhone bei 4177 px, nur ein Teil je Kasse, Kissen & Co. nur als Anfrage. Hier wird geprueft, auf iPhone und Laptop:
// Preis auf der Karte, Bestellleiste unten im Fenster direkt unter dem Design, ein Tipp oeffnet das Formular mit dem Kassenknopf
// im Fenster, Groesse nur einmal (und nur bei Textil), Warenkorb Shirt + Kissen, Rueckweg gemerkt. Dazu der Server allein:
// Staffel ueber den ganzen Korb, Verrechnung bezahlter Entwuerfe genau einmal, Statusseite. Shopify ist vorgetaeuscht.
// Aufruf: node werkzeug/probe-kasse.mjs [Ordner fuer Bildschirmfotos]   (die Abnahme ruft es auch auf)
import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { mountShopifyKasse } from '../shopify-kasse.js';
import { GARMENTS } from '../mockups.js';
const BILD = process.argv[2] || '';
const E = {};

// ---- 1) Server allein ----
{
  const STORE = await fs.mkdtemp(path.join(os.tmpdir(), 'kasse-'));
  const routes = {}; const app = { get: (p, ...f) => { routes['GET ' + p] = f.pop(); }, post: (p, ...f) => { routes['POST ' + p] = f.pop(); } };
  let gesendet = null;
  const fetchAlt = globalThis.fetch;
  globalThis.fetch = async (url, opt) => {
    if (String(url).includes('oauth')) return new Response(JSON.stringify({ access_token: 't', expires_in: 86399 }));
    gesendet = JSON.parse(opt.body).variables.input;
    return new Response(JSON.stringify({ data: { draftOrderCreate: { draftOrder: { id: 'g', name: '#D9', invoiceUrl: 'https://shop.example/inv', totalPriceSet: null }, userErrors: [] } } }));
  };
  const nutzer = { id: 'u_1', verrechenbarCent: 300 };
  const k = mountShopifyKasse(app, { STORE, GARMENTS, adminGuard: () => {}, readJob: async () => ({ status: 'done', people: [{ name: 'Lena', size: 'S' }, { name: 'Tom', size: 'XL' }] }),
    identify: async () => ({ user: nutzer }), accounts: { byId: async () => nutzer, save: async (u) => u },
    env: { SHOPIFY_KASSE: 'an', SHOPIFY_SHOP: 'probe', SHOPIFY_CLIENT_ID: 'x', SHOPIFY_CLIENT_SECRET: 'x' } });
  const call = async (m, p, body, params) => { const out = { status: 200 }; const res = { status(c) { out.status = c; return res; }, json(j) { out.j = j; return res; }, set() { return res; } }; await routes[m + ' ' + p]({ body, params, headers: {} }, res); return out; };
  const r = await call('POST', '/api/mo/kasse', { designId: 'MO-X-1', posten: [{ garment: 'tee', menge: 2, liste: true }, { garment: 'hoodie', menge: 3, stufe: 'deluxe', zweiteSeite: true, groesse: 'L' }, { garment: 'kissen', menge: 1 }] });
  E.server = { status: r.status, gesamt: r.j && r.j.gesamt, verrechnet: r.j && r.j.verrechnet,
    zeilen: gesendet ? gesendet.lineItems.map(l => l.quantity + 'x ' + l.title + ' ' + l.originalUnitPriceWithCurrency.amount) : [],
    nachlass: gesendet && gesendet.appliedDiscount ? gesendet.appliedDiscount.value : 0 };
  E.server.ohneGroesse = (await call('POST', '/api/mo/kasse', { designId: 'MO-X-1', posten: [{ garment: 'tee', menge: 1 }] })).status;
  const id = r.j && r.j.kasseId;
  E.server.vorher = (await call('GET', '/api/mo/kasse/:id', null, { id })).j.status;
  await k.bestellungEingang({ name: '#1001', note_attributes: [{ name: '_kasseId', value: id }] });
  await k.bestellungEingang({ name: '#1001', note_attributes: [{ name: '_kasseId', value: id }] });
  const nach = (await call('GET', '/api/mo/kasse/:id', null, { id })).j;
  E.server.nachher = nach.status + ' ' + nach.bestellung + (nach.url ? ' mit Kassenlink' : '');
  E.server.guthaben = nutzer.verrechenbarCent;
  globalThis.fetch = fetchAlt;
}

// ---- 2) Seite im Browser ----
let pw = null;
for (const k of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) { try { pw = await import(k); break; } catch (e) { /* naechster */ } }
if (!pw) { console.log('ERGEBNIS ' + JSON.stringify({ ...E, fehler: 'Playwright nicht gefunden' })); process.exit(0); }
const { chromium, devices } = pw;
const port = await new Promise((res) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const base = 'http://127.0.0.1:' + port;
const srv = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(port), BALLZ_MCP_URL: 'http://127.0.0.1:1/mcp', ADMIN_TOKEN: 'probe', MASTER_TOKEN: 'probe', PUBLIC_BASE_URL: base, ABNAHME: '1',
  SHOPIFY_KASSE: 'an', SHOPIFY_SHOP: 'probe-shop', SHOPIFY_CLIENT_ID: 'x', SHOPIFY_CLIENT_SECRET: 'x' }, stdio: ['ignore', 'pipe', 'pipe'] });
for (let i = 0; i < 120; i++) { try { if ((await fetch(base + '/api/mo/me')).ok) break; } catch (e) { /* startet noch */ } await new Promise(r => setTimeout(r, 500)); }
let browser;
try { browser = await chromium.launch(process.env.PLAYWRIGHT_BROWSERS_PATH ? { executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH + '/chromium' } : {}); }
catch (e) { browser = await chromium.launch(); }
const id = 'MO-PROBE-20261006-KAUF', q = '?exp=1&sig=x';
const mk = (g, c) => `${base}/api/mo/mockup/${id}/${g}/${c}.jpg${q}`;
const job = { status: 'done', designId: id, preview: `${base}/api/mo/preview/${id}.png${q}`, names: [], people: [], aufteilung: 'vorne', sig: { exp: 1, sig: 'x' }, textile: 'weiss',
  mockups: { tee: { label: 'T-Shirt', view: 'front', sizes: true, black: mk('tee', 'black'), white: mk('tee', 'white') },
    hoodie: { label: 'Hoodie', view: 'front', sizes: true, black: mk('hoodie', 'black'), white: mk('hoodie', 'white') },
    kissen: { label: 'Kissen', view: 'front', white: mk('kissen', 'white') } } };
const jpg = await sharp({ create: { width: 600, height: 600, channels: 3, background: '#bbb' } }).jpeg().toBuffer();
for (const [name, dev] of [['iphone', devices['iPhone 13']], ['laptop', { viewport: { width: 1366, height: 768 } }]]) {
  const ctx = await browser.newContext({ ...dev });
  await ctx.addInitScript(() => { try { localStorage.setItem('mo_lauf', JSON.stringify({ jobId: 'mo_probekasse', started: Date.now(), slug: 'abi' })); } catch (e) { /* egal */ } });
  const p = await ctx.newPage();
  let kasse = null, status = 'offen';
  await p.route('**/api/mo/job/mo_probekasse', r => r.fulfill({ json: job }));
  await p.route('**/api/mo/mockup/**', r => r.fulfill({ body: jpg, contentType: 'image/jpeg' }));
  await p.route('**/api/mo/preview/**', r => r.fulfill({ body: jpg, contentType: 'image/jpeg' }));
  await p.route('**/api/mo/kasse', r => { kasse = JSON.parse(r.request().postData() || 'null'); r.fulfill({ json: { ok: true, url: base + '/kasse-probe', gesamt: 99.6, kasseId: 'kas_probe123456' } }); });
  await p.route('**/kasse-probe', r => r.fulfill({ body: 'KASSE', contentType: 'text/html' }));
  await p.route('**/api/mo/kasse/kas_probe123456', r => r.fulfill({ json: { id: 'kas_probe123456', status, bestellung: status === 'bezahlt' ? '#1001' : null, url: status === 'offen' ? base + '/kasse-probe' : null, zeilen: [], gesamt: 99.6 } }));
  const e = {};
  try {
    await p.goto(base + '/m/abi');
    await p.waitForSelector('#kaufformen:not(.hide)', { timeout: 30000 });
    await p.waitForTimeout(600);
    const lage = (sel) => p.evaluate((s) => { const el = document.querySelector(s); if (!el || !el.offsetParent) return null; const r = el.getBoundingClientRect(); return { oben: Math.round(r.top), unten: Math.round(r.bottom) }; }, sel);
    e.fenster = await p.evaluate(() => innerHeight);
    await p.evaluate(() => document.querySelector('#result').scrollIntoView({ block: 'start' })); await p.waitForTimeout(250);
    e.leiste = await lage('#kauf-leiste');
    e.leisteText = (await p.textContent('#kauf-jetzt')).trim();
    e.groesseAmBild = !!(await lage('#sizesel'));
    e.karte = await p.$eval('#kf-row .kf-card[data-k="textil"] .preis', x => x.textContent.trim());
    e.kopf = (await p.textContent('#kaufformen .kf-h span')).trim();
    if (BILD) await p.screenshot({ path: `${BILD}/kasse-${name}-1.png` });
    await p.click('#kauf-jetzt'); await p.waitForTimeout(600);
    e.kassenknopf = await lage('#kf-send');
    e.knopf = (await p.textContent('#kf-send')).trim();
    e.felder = await p.$$eval('#kf-form .kf-fields label', ls => ls.filter(l => l.offsetParent).map(l => (l.firstChild && l.firstChild.textContent || '').trim()));
    if (BILD) await p.screenshot({ path: `${BILD}/kasse-${name}-2.png` });
    await p.selectOption('#kf-groesse', 'L');
    await p.fill('#kf-menge', '3'); await p.dispatchEvent('#kf-menge', 'input');
    await p.click('#kf-dazu'); await p.waitForTimeout(250);
    await p.selectOption('#kf-garment', 'kissen'); await p.waitForTimeout(250);
    e.kissen = { knopf: (await p.textContent('#kf-send')).trim(), groesse: !!(await lage('#kf-groesse-box')), stufen: !!(await lage('#kf-stufen')) };
    e.gesamt = (await p.textContent('#kf-rechnung .z.gesamt b')).trim();
    await p.click('#kf-send'); await p.waitForTimeout(1000);
    e.posten = kasse && kasse.posten ? kasse.posten.map(x => x.menge + 'x ' + x.garment + (x.groesse ? ' ' + x.groesse : '')) : null;
    e.zurKasse = p.url().endsWith('/kasse-probe');
    // Rueckweg: wieder auf einer Mottoseite - erst offen, dann bezahlt
    await p.goto(base + '/m/abi'); await p.waitForSelector('#kasse-hinweis', { timeout: 15000 });
    e.hinweisOffen = (await p.textContent('#kasse-hinweis')).replace(/\s+/g, ' ').trim();
    status = 'bezahlt';
    await p.goto(base + '/m/abi'); await p.waitForSelector('#kasse-hinweis', { timeout: 15000 });
    e.hinweisBezahlt = (await p.textContent('#kasse-hinweis')).replace(/\s+/g, ' ').trim();
    const bs = await p.goto(base + '/bestellung/kas_probe123456');
    e.bestellseite = bs.status();
  } catch (err) { e.fehler = String(err && err.message || err).slice(0, 300); }
  E[name] = e;
  await ctx.close();
}
console.log('ERGEBNIS ' + JSON.stringify(E));
await browser.close(); srv.kill();
