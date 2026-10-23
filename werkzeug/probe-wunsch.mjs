// Wunsch-Knopf auf der Startseite (5. Okt.): tippen -> /otto (fuer wen?) -> /api/mo/wunsch -> Mottoseite ausgefuellt auf "Alles klar?".
// Ohne Textmodell (ABNAHME) wird es Dein Freestyle mit dem Wunsch als Motiv. Aufruf: node werkzeug/probe-wunsch.mjs [BILD-pfad]
import { spawn } from 'node:child_process';
import net from 'node:net';
let pw = null;
for (const k of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) { try { pw = await import(k); break; } catch (e) { /* naechster */ } }
const { chromium, devices } = pw;
const port = await new Promise((res) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const base = 'http://127.0.0.1:' + port;
const srv = spawn(process.execPath, ['server.js'], { env: { ...process.env, PORT: String(port), BALLZ_MCP_URL: 'http://127.0.0.1:1/mcp', ADMIN_TOKEN: 'probe', MASTER_TOKEN: 'probe', PUBLIC_BASE_URL: base, ABNAHME: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
let log = ''; srv.stdout.on('data', d => log += d); srv.stderr.on('data', d => log += d);
for (let i = 0; i < 120; i++) { try { if ((await fetch(base + '/api/mo/me')).ok) break; } catch (e) {} await new Promise(r => setTimeout(r, 500)); }
const browser = await chromium.launch(process.env.PLAYWRIGHT_BROWSERS_PATH ? { executablePath: process.env.PLAYWRIGHT_BROWSERS_PATH + '/chromium' } : {});
let fehler = 0;
for (const [name, ctxOpt] of [['iPhone', devices['iPhone 13']], ['Laptop', { viewport: { width: 1366, height: 768 } }]]) {
  const ctx = await browser.newContext(ctxOpt); const page = await ctx.newPage();
  await page.goto(base + '/', { waitUntil: 'load' });
  if (process.argv[2]) await page.screenshot({ path: process.argv[2] + '-start-' + name + '.png' });
  const box = await page.evaluate(() => { const r = document.getElementById('wunsch-los').getBoundingClientRect(); return { unten: Math.round(r.bottom), fenster: innerHeight }; });
  await page.fill('#wunsch-text', 'Ein Shirt mit einem Dackel auf dem Surfbrett, Sylt 2026');
  await page.click('#wunsch-los');
  // 6. Okt. (Otto-Weg): der Wunsch geht erst zu Otto (/otto) - Artikel und Idee stehen schon drin, er fragt nur noch "fuer wen?"
  await page.waitForURL(/\/otto\?w=/, { timeout: 15000 });
  await page.locator('#kacheln .kachel', { hasText: 'Für mich' }).click();
  await page.waitForURL(/\/m\/freestyle\?wunsch=/, { timeout: 15000 });
  await page.waitForTimeout(3500);
  const st = await page.evaluate(() => { const s = [...document.querySelectorAll('.ab-schritt')].find(x => x.offsetHeight); return { titel: s ? s.querySelector('.ab-titel').textContent : '', motiv: (document.getElementById('v_motiv') || {}).value || '', go: !document.getElementById('go').disabled }; });
  const ok = /Alles klar/.test(st.titel) && /Dackel/.test(st.motiv) && st.go;
  if (!ok) fehler++;
  console.log((ok ? 'OK    ' : 'FEHLER') + ' ' + name + ' | Knopf bei ' + box.unten + ' von ' + box.fenster + ' | ' + st.titel + ' | Motiv: ' + st.motiv.slice(0, 50) + ' | Start frei: ' + st.go);
  if (process.argv[2]) await page.screenshot({ path: process.argv[2] + '-' + name + '.png' });
  await ctx.close();
}
console.log((log.match(/Wunsch:.*$/m) || [''])[0]);
await browser.close(); srv.kill(); process.exit(fehler ? 1 : 0);
