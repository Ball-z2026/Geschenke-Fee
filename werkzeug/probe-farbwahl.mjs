// Nachstellen (4. Okt., Markus: "Natuerlich sollen die auch bestellbar sein"): ein fertiges Design mit gemessenen Farben
// fuer das T-Shirt. Auf der Ergebnisseite (iPhone) stehen die Farben neben Schwarz und Weiss, ein Tipp zeigt das T-Shirt in
// der Farbe, die Zeile darunter nennt sie, ein Teil ohne Farben (Hoodie) faellt auf Weiss zurueck, und die Anfrage traegt
// die Farbe. Der Auftrag und die Bilder sind vorgetaeuscht - es geht um die Seite.
// Aufruf: node werkzeug/probe-farbwahl.mjs   (die Abnahme ruft es auch auf)
import { spawn } from 'node:child_process';
import net from 'node:net';
import sharp from 'sharp';
let pw = null;
for (const k of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) { try { pw = await import(k); break; } catch (e) { /* naechster */ } }
if (!pw) { console.error('Playwright nicht gefunden'); process.exit(2); }
const { chromium, devices } = pw;
const port = await new Promise((res) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const base = 'http://127.0.0.1:' + port;
const srv = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(port), BALLZ_MCP_URL: 'http://127.0.0.1:1/mcp', ADMIN_TOKEN: 'probe', MASTER_TOKEN: 'probe', PUBLIC_BASE_URL: base, ABNAHME: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
for (let i = 0; i < 120; i++) { try { if ((await fetch(base + '/api/mo/me')).ok) break; } catch (e) {} await new Promise(r => setTimeout(r, 500)); }
let browser;
try { browser = await chromium.launch(process.env.PLAYWRIGHT_BROWSERS_PATH ? { executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH + '/chromium' } : {}); }
catch (e) { browser = await chromium.launch(); }
const id = 'MO-PROBE-20261004-FARB', q = '?exp=1&sig=x';
const mk = (g, c, x = '') => `${base}/api/mo/mockup/${id}/${g}/${c}.jpg${q}${x}`;
const tee = { label: 'T-Shirt', view: 'front', sizes: true, black: mk('tee', 'black'), white: mk('tee', 'white'),
  farben: [{ key: 'rot', name: 'Rot', bc: 'Red', hex: '#C8102E' }, { key: 'gelb', name: 'Gelb', bc: 'Solar Yellow', hex: '#F6D33C' }] };
tee['f-rot'] = mk('tee', 'white', '&farbe=rot'); tee['f-gelb'] = mk('tee', 'white', '&farbe=gelb');
const job = { status: 'done', designId: id, preview: `${base}/api/mo/preview/${id}.png${q}`, names: [], people: [], aufteilung: 'vorne', sig: { exp: 1, sig: 'x' }, textile: 'weiss',
  mockups: { tee, hoodie: { label: 'Hoodie', view: 'front', sizes: true, black: mk('hoodie', 'black'), white: mk('hoodie', 'white') } } };
const jpg = await sharp({ create: { width: 60, height: 60, channels: 3, background: '#888' } }).jpeg().toBuffer();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
await ctx.addInitScript(() => { try { localStorage.setItem('mo_lauf', JSON.stringify({ jobId: 'mo_probefarbe', started: Date.now(), slug: 'abi' })); } catch (e) {} });
const p = await ctx.newPage();
let anfrage = null;
await p.route('**/api/mo/job/mo_probefarbe', r => r.fulfill({ json: job }));
await p.route('**/api/mo/mockup/**', r => r.fulfill({ body: jpg, contentType: 'image/jpeg' }));
await p.route('**/api/mo/preview/**', r => r.fulfill({ body: jpg, contentType: 'image/jpeg' }));
await p.route('**/api/mo/anfrage', r => { anfrage = JSON.parse(r.request().postData() || 'null'); r.fulfill({ json: { ok: true, form: 'Textil' } }); });
const e = {};
try {
  await p.goto(base + '/m/abi');
  await p.waitForSelector('#colors button[data-c="f-rot"]', { timeout: 30000 });
  e.knoepfe = await p.$$eval('#colors button', bs => bs.map(x => x.textContent.trim()));
  await p.click('#colors button[data-c="f-rot"]'); await p.waitForTimeout(400);
  e.bild = await p.evaluate(() => [...document.querySelectorAll('img')].map(i => i.src).filter(s => /\/tee\/white\.jpg/.test(s)).pop() || '');
  e.meta = (await p.textContent('#meta')) || '';
  await p.click('#tabs button[data-t="hoodie"]'); await p.waitForTimeout(300);
  e.hoodie = await p.$$eval('#colors button', bs => bs.map(x => x.dataset.c + (x.classList.contains('on') ? '*' : '')));
  await p.click('#tabs button[data-t="tee"]'); await p.click('#colors button[data-c="f-gelb"]');
  await p.click('#kf-row .kf-card[data-k="textil"]'); await p.fill('#kf-email', 'probe@example.org'); await p.click('#kf-send'); await p.waitForTimeout(800);
  e.anfrage = anfrage && { garment: anfrage.garment, farbe: anfrage.farbe };
} catch (err) { e.fehler = String(err && err.message || err).slice(0, 300); }
console.log('ERGEBNIS ' + JSON.stringify(e));
await browser.close(); srv.kill();
