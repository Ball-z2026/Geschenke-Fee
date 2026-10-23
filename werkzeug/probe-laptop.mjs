// Laptop-Probe (5. Okt., Markus: "Bitte auch am Laptop-Bildschirm ueberpruefen, dass alle Buttons auch direkt zu sehen sind,
// ohne grossartig zu scrollen ... Irgendwann werden betrunkene Menschen drauf sein und das muss schnell gehen").
// Geht Mottos Seite fuer Seite durch und misst je Seite: liegt der unterste sichtbare Knopf (Kachel, Weiter) im Fenster?
// Dazu die einfache Partner-Seite /bei/<slug>/machen. Aufruf: node werkzeug/probe-laptop.mjs [breite hoehe] [motto ...]
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
const B = +process.argv[2] || 1366, H = +process.argv[3] || 768;
const mottos = process.argv.slice(4).length ? process.argv.slice(4) : ['hochzeit', 'freestyle', 'geburtstag', 'abi'];
const ctx = await browser.newContext({ viewport: { width: B, height: H } });
const page = await ctx.newPage();
const fehler = [];
const messen = () => page.evaluate(() => {
  const s = [...document.querySelectorAll('.ab-schritt')].find(x => x.offsetHeight); if (!s) return null;
  const knoepfe = [...s.querySelectorAll('button, .ab-weiter, input[type=file] + *, label.haken')].filter(e => e.offsetWidth && e.offsetHeight && !/Mehr Stile/.test(e.textContent));
  let unten = 0, wer = '';
  for (const k of knoepfe) { const r = k.getBoundingClientRect(); if (r.bottom > unten) { unten = r.bottom; wer = (k.textContent || k.className).trim().slice(0, 30); } }
  return { titel: s.querySelector('.ab-titel') ? s.querySelector('.ab-titel').textContent : '', unten: Math.round(unten), wer, fenster: innerHeight, scrollY: Math.round(scrollY) };
});
for (const slug of mottos) {
  await page.goto(base + '/m/' + slug, { waitUntil: 'load' }); await page.waitForTimeout(900);
  for (let i = 0; i < 30; i++) {
    const m = await messen();
    if (!m || /Alles klar/.test(m.titel)) {
      const g = await page.evaluate(() => { const b = document.getElementById('go'); const r = b.getBoundingClientRect(); return { unten: Math.round(r.bottom), fenster: innerHeight }; });
      const ok = g.unten <= g.fenster; console.log((ok ? 'OK   ' : 'ZU TIEF') + ' ' + slug + ' | Alles klar? | "Otto starten" bei ' + g.unten + ' von ' + g.fenster);
      if (!ok) fehler.push(slug + ': Alles klar? (' + g.unten + ')');
      if (process.env.BILD) await page.screenshot({ path: process.env.BILD + '-' + slug + '.png' });
      break;
    }
    const ok = m.unten <= m.fenster;
    console.log((ok ? 'OK   ' : 'ZU TIEF') + ' ' + slug + ' | ' + m.titel + ' | unterster Knopf "' + m.wer + '" bei ' + m.unten + ' von ' + m.fenster + (m.scrollY ? ' (gescrollt ' + m.scrollY + ')' : ''));
    if (!ok) fehler.push(slug + ': ' + m.titel + ' (' + m.unten + ' > ' + m.fenster + ')');
    const art = await page.evaluate(() => {
      const s = [...document.querySelectorAll('.ab-schritt')].find(x => x.offsetHeight), zu = e => !!(e.offsetWidth || e.offsetHeight);
      const g = [...s.querySelectorAll('.styles, .sugg.groessen')].filter(zu).pop();
      if (g) { const k = [...g.querySelectorAll('button')].filter(zu).find(x => !x.classList.contains('on') && !x.hasAttribute('data-eigen') && !/Mehr/.test(x.textContent)); if (k) { k.setAttribute('data-t', '1'); return 'kachel'; } }
      const v = [...s.querySelectorAll('#f-suggest .s')].find(zu); if (v) { v.setAttribute('data-t', '1'); return 'kachel'; }
      if ([...s.querySelectorAll('input[type=text],input[type=number],input[type=date],textarea')].some(zu)) return 'text';
      return 'weiter';
    });
    const t = m.titel;
    if (art === 'kachel') await page.locator('[data-t]').first().click();
    else if (art === 'text') { const h = page.locator('.ab-schritt:visible :is(input[type=text],input[type=number],input[type=date],textarea):visible').first(); await h.fill(/date/.test(await h.getAttribute('type') || '') ? '2026-10-03' : 'Probe ' + i); await h.press('Enter'); }
    await page.evaluate(() => document.querySelectorAll('[data-t]').forEach(x => x.removeAttribute('data-t')));
    await page.waitForTimeout(600);
    if ((await messen() || {}).titel === t) { const w = page.locator('.ab-schritt:visible .ab-weiter'); if (await w.count()) await w.first().click().catch(() => {}); await page.waitForTimeout(400); }
    if ((await messen() || {}).titel === t) { console.log('   (bleibt stehen - Foto oder Pflicht, weiter mit dem naechsten Motto)'); break; }
  }
}
for (const p of ['luigispizzaug', 'east26']) for (const was of ['teil']) {
  await page.goto(base + '/bei/' + p + '/machen?was=' + was, { waitUntil: 'load' }); await page.waitForTimeout(1200);
  const r = await page.evaluate(() => { const b = document.getElementById('start'); const x = b.getBoundingClientRect(); return { unten: Math.round(x.bottom), fenster: innerHeight, seite: document.documentElement.scrollHeight }; });
  const ok = r.unten <= r.fenster;
  if (process.env.BILD) await page.screenshot({ path: process.env.BILD + '-' + p + '-' + was + '.png' });
  console.log((ok ? 'OK   ' : 'ZU TIEF') + ' /bei/' + p + '/machen?was=' + was + ' | "Otto starten" bei ' + r.unten + ' von ' + r.fenster + ' (Seite ' + r.seite + ' hoch)');
  if (!ok) fehler.push('/bei/' + p + ' ' + was + ' (' + r.unten + ')');
}
console.log(fehler.length ? 'ZU TIEF: ' + fehler.length + '\n  ' + fehler.join('\n  ') : 'alles im Fenster');
await browser.close(); srv.kill();
process.exit(0);
