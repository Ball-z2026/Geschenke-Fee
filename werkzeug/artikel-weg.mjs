// 6. Okt. (Regel 45): jeden Artikel durchgehen - /m/<motto>?artikel=<id> und /m/freestyle?artikel=<id>,
// je Artikel: Kasten "Einfach einsprechen", Textil-, Groessen-, Flaechenfrage sichtbar? Aufruf: node werkzeug/artikel-weg.mjs familie
import { spawn } from 'node:child_process';


const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
const port = 4377;
const kind = spawn(process.execPath, ['server.js'], { cwd: new URL('..', import.meta.url).pathname, env: { ...process.env, PORT: String(port), BALLZ_MCP_URL: 'http://127.0.0.1:1/mcp', ADMIN_TOKEN: 'probe', MASTER_TOKEN: 'probe', PUBLIC_BASE_URL: 'http://127.0.0.1:' + port, ABNAHME: '1' }, stdio: 'ignore' });
const B = 'http://127.0.0.1:' + port;
for (let i = 0; i < 60; i++) { try { const r = await fetch(B + '/api/mo/freestyle/artikel'); if (r.ok) break; } catch {} await new Promise(r => setTimeout(r, 500)); }
const kat = await (await fetch(B + '/api/mo/freestyle/artikel')).json();
const alle = []; Object.entries(kat.gruppen).forEach(([g, l]) => l.forEach(a => alle.push({ g, id: a.id, name: a.name, verfahren: a.verfahren, motivart: a.motivart, fl: a.flaechen.length, frei: !!a.freieGroesse })));
const br = await chromium.launch(); const p = await br.newPage({ viewport: { width: 1280, height: 900 } });
const motto = process.argv[2] || 'familie';
async function titel(url) {
  await p.goto(B + url, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
  return await p.evaluate(() => {
    const box = document.getElementById('art-einsprechen');
    const sichtbar = id => { const e = document.getElementById(id); return !!e && !e.classList.contains('hide'); };
    return { box: box ? box.innerText.split('\n')[0] : '', textil: sichtbar('f-textile'), groesse: sichtbar('f-druckmass'), flaeche: sichtbar('f_flaeche'), artikelWahl: sichtbar('f_artikel'), stil: sichtbar('f-style') };
  });
}
for (const a of alle) {
  const n = await titel(`/m/${motto}?artikel=${a.id}`);
  const f = await titel(`/m/freestyle?artikel=${a.id}`);
  console.log(JSON.stringify({ ...a, normal: n, freestyle: f }));
}
await br.close(); kind.kill();
