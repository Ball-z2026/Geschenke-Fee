// Probe im Browser: Gast beim Partner startet eine Karte, macht die Seite zu, kommt wieder.
const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
import sharp from 'sharp';
const BASE = process.argv[2] || 'http://127.0.0.1:4310', OUT = process.argv[3] || '/tmp';
const foto = OUT + '/probe-foto.jpg';
await sharp({ create: { width: 1200, height: 900, channels: 3, background: '#7aa7c7' } }).jpeg().toFile(foto);
const browser = await chromium.launch(process.env.PLAYWRIGHT_BROWSERS_PATH ? { executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH + '/chromium' } : {});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
let page = await ctx.newPage();
const url = BASE + '/bei/luigispizzaug/machen';
await page.goto(url);
await page.waitForSelector('#stile [data-stil]');
await page.setInputFiles('#foto', foto);
await page.waitForSelector('#rechte-zeile:not(.hide)');
await page.check('#rechte');
await page.click('#start');
await page.waitForSelector('#warten:not(.hide)', { timeout: 30000 });
await page.waitForSelector('#wa-block:not(.hide)', { timeout: 5000 });
await page.screenshot({ path: OUT + '/nw-1-warten.png' });
await page.fill('#wa-nummer', '0171 2345678');
await page.click('#wa-senden');
await page.waitForSelector('#wa-meldung:not(.hide)');
console.log('WhatsApp-Meldung:', await page.textContent('#wa-meldung'));
await page.screenshot({ path: OUT + '/nw-2-bestaetigt.png' });
const lauf = await page.evaluate(() => localStorage.getItem('mo_partner_lauf_luigispizzaug'));
console.log('gemerkt:', lauf);
await page.close();                     // Gast macht die Seite zu
page = await ctx.newPage();             // ... und scannt spaeter den QR-Code noch einmal
await page.goto(url);
await page.waitForURL(/\/m\//, { timeout: 240000 });
console.log('weitergeleitet auf:', page.url());
await page.waitForTimeout(4000);
await page.screenshot({ path: OUT + '/nw-3-ergebnis.png' });
await page.goto(url);                   // dritter Besuch: Hinweis statt Weiterleitung
await page.waitForSelector('#letztes:not(.hide)', { timeout: 10000 });
await page.screenshot({ path: OUT + '/nw-4-letztes.png' });
console.log('dritter Besuch: Hinweis "Dein letztes Motiv" sichtbar, keine Weiterleitung:', page.url());
// Link aus der WhatsApp in einem fremden Browser (ohne Speicher)
const j = JSON.parse(lauf);
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 } });
const p2 = await ctx2.newPage();
await p2.goto(url + '?lauf=' + j.jobId + '&m=' + j.motto);
await p2.waitForURL(/\/m\//, { timeout: 30000 });
console.log('WhatsApp-Link im fremden Browser ->', p2.url());
await browser.close();
