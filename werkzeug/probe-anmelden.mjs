// Nachstellen (4. Okt., Markus: "mit dem Link dann auch wieder sofort auf die gleiche Stelle zurueckkommen und da
// weitermachen"): ein Gast geht ein Motto bis "Alles klar?", startet, muss sich anmelden, laesst sich den Link
// schicken und oeffnet ihn - im selben Browser (gleich) oder in einem anderen (anderer, wie aus der Mail-App).
// Aufruf: node werkzeug/probe-anmelden.mjs <motto> <gleich|anderer> [mitfoto]   (die Abnahme ruft es auch auf)
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
// Playwright und Chromium wie in abnahme-browser.mjs: erst das Paket (GitHub), dann die Sandbox.
let pw = null;
for (const k of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) { try { pw = await import(k); break; } catch (e) { /* naechster */ } }
if (!pw) { console.error('Playwright nicht gefunden'); process.exit(2); }
const { chromium, devices } = pw;
const port = await new Promise((res) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const base = 'http://127.0.0.1:' + port;
const srv = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(port), BALLZ_MCP_URL: 'http://127.0.0.1:1/mcp', ADMIN_TOKEN: 'probe', MASTER_TOKEN: 'probe', PUBLIC_BASE_URL: base, ABNAHME: '1', ACCOUNTS: 'on' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
for (let i = 0; i < 120; i++) { try { if ((await fetch(base + '/api/mo/me')).ok) break; } catch (e) {} await new Promise(r => setTimeout(r, 500)); }
let browser;
try { browser = await chromium.launch(process.env.PLAYWRIGHT_BROWSERS_PATH ? { executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH + '/chromium' } : {}); }
catch (e) { browser = await chromium.launch(); }
const slug = process.argv[2] || 'hochzeit';
const fall = process.argv[3] || 'gleich';   // gleich | anderer
const ctxA = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctxA.newPage();
const gens = []; page.on('request', r => { if (/\/generate/.test(r.url())) gens.push(r.url()); });
await page.goto(base + '/m/' + slug, { waitUntil: 'load' }); await page.waitForTimeout(900);
const gid = (await ctxA.cookies()).find(c => c.name === 'mo_guest').value;
await fs.writeFile(path.join('storage', 'guests', gid + '.json'), JSON.stringify({ id: gid, designs: ['MO-PROBE-1'] }));
const titel = () => page.evaluate(() => { const s = [...document.querySelectorAll('.ab-schritt')].find(x => x.offsetHeight); return s ? s.querySelector('.ab-titel').textContent : ''; });
for (let i = 0; i < 30; i++) {
  const t = await titel(); if (!t || /Alles klar/.test(t)) break;
  const art = await page.evaluate(() => {
    const s = [...document.querySelectorAll('.ab-schritt')].find(x => x.offsetHeight), zu = e => !!(e.offsetWidth || e.offsetHeight);
    if ([...s.querySelectorAll('.drop, input[type=file]')].some(zu)) return 'foto';
    const g = [...s.querySelectorAll('.styles, .sugg.groessen')].filter(zu).pop();
    if (g) { const k = [...g.querySelectorAll('button')].filter(zu).find(x => !x.classList.contains('on') && !x.hasAttribute('data-eigen') && !/Mehr/.test(x.textContent)); if (k) { k.setAttribute('data-t', '1'); return 'kachel'; } }
    const v = [...s.querySelectorAll('#f-suggest .s')].find(zu); if (v) { v.setAttribute('data-t', '1'); return 'kachel'; }
    const nl = s.querySelector('.nl-name'); if (nl && zu(nl)) return 'namen';
    if ([...s.querySelectorAll('input[type=text],input[type=number],input[type=date],textarea')].some(zu)) return 'text';
    if ([...s.querySelectorAll('select')].some(zu)) return 'liste';
    if ([...s.querySelectorAll('input[type=checkbox]')].some(zu)) return 'haken';
    return 'nichts';
  });
  if (art === 'foto') {
    if (process.argv[4] === 'mitfoto' && !globalThis.fotoDa) { globalThis.fotoDa = 1; await page.setInputFiles('#v_foto', [{ name: 'gruppe.jpg', mimeType: 'image/jpeg', buffer: await (await import('sharp')).default({ create: { width: 1600, height: 1200, channels: 3, background: { r: 150, g: 140, b: 120 } } }).jpeg().toBuffer() }]); await page.waitForTimeout(3000); }
    await page.locator('.ab-schritt:visible .ab-weiter').click(); await page.waitForTimeout(500); continue; }
  if (art === 'kachel') await page.locator('[data-t]').first().click();
  else if (art === 'namen') { const h = page.locator('.ab-schritt:visible .nl-name').first(); await h.fill('Oma Inge'); await h.press('Enter'); await page.waitForTimeout(200); await page.keyboard.press('Enter'); }
  else if (art === 'text') { const h = page.locator('.ab-schritt:visible :is(input[type=text],input[type=number],input[type=date],textarea):visible').first(); await h.fill(/date/.test(await h.getAttribute('type') || '') ? '2026-10-03' : 'Probe ' + i); await h.press('Enter'); }
  else if (art === 'liste') await page.locator('.ab-schritt:visible select:visible').first().selectOption({ index: 1 });
  else if (art === 'haken') await page.locator('.ab-schritt:visible input[type=checkbox]:visible').first().check();
  await page.evaluate(() => document.querySelectorAll('[data-t]').forEach(x => x.removeAttribute('data-t')));
  await page.waitForTimeout(700);
  if (await titel() === t) { await page.locator('.ab-schritt:visible .ab-weiter').click(); await page.waitForTimeout(400); }
}
const vorher = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[id^=v_]')].filter(e => e.value && e.type !== 'hidden').map(e => [e.id, e.value])));
console.log('Ende der Abfolge:', await titel());
await page.locator('#go').click(); await page.waitForTimeout(1500);
console.log('Gate sichtbar:', await page.evaluate(() => !document.getElementById('gate').classList.contains('hide')), '· generate-Aufrufe:', gens.length);
await page.fill('#gate-email', 'probe@motto-otto.de'); await page.click('#gate-send'); await page.waitForTimeout(1200);
const t = (log.match(/\/login\?t=([a-f0-9]{48})/g) || []).pop().split('=')[1];
const ziel = fall === 'anderer' ? await (await browser.newContext({ ...devices['iPhone 13'] })).newPage() : page;
const gens2 = []; ziel.on('response', async r => { if (/\/generate/.test(r.url())) gens2.push(r.status() + ' ' + (await r.text().catch(() => '')).slice(0, 120)); });
await ziel.goto(base + '/login?t=' + t, { waitUntil: 'load' });
// 6. Okt.: mit Foto holt die Seite erst das Foto zurueck, unter Last (volle Abnahme) dauerte das ab und zu laenger als die
// festen 4 s - die Pruefung fiel dann ohne Fehler der Seite. Jetzt: warten, bis der Start kommt, hoechstens 15 s.
for (let w = 0; w < 30 && !gens2.length; w++) await ziel.waitForTimeout(500);
await ziel.waitForTimeout(800);
const nachher = await ziel.evaluate(() => {
  const s = [...document.querySelectorAll('.ab-schritt')].find(x => x.offsetHeight);
  return { url: location.pathname + location.search, schritt: s ? s.querySelector('.ab-titel').textContent : '(keine Abfolge sichtbar)',
    werte: Object.fromEntries([...document.querySelectorAll('[id^=v_]')].filter(e => e.value && e.type !== 'hidden').map(e => [e.id, e.value])),
    meldung: (document.getElementById('msg') || {}).textContent || '' };
});
console.log(JSON.stringify({ fall, slug, vorherFelder: Object.keys(vorher).length, nachherFelder: Object.keys(nachher.werte).length, url: nachher.url, schritt: nachher.schritt, generateNachLogin: gens2, fehlen: Object.keys(vorher).filter(k => vorher[k] !== nachher.werte[k]).map(k => k + '=' + vorher[k] + '|' + nachher.werte[k]), meldung: nachher.meldung.slice(0, 160) }, null, 1));
const zl = log.split('\n').filter(l => /Zwischenstand|foto/i.test(l));
console.log(zl.slice(-8).join('\n'));
console.log('ERGEBNIS ' + JSON.stringify({ schritt: nachher.schritt, start: gens2, fehlen: Object.keys(vorher).filter(k => vorher[k] !== nachher.werte[k] && k !== 'v_foto'), mitFoto: zl.some(l => /zurueckgegeben .*mit Foto/.test(l)), url: nachher.url }));
await browser.close(); srv.kill();
