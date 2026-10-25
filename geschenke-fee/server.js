// Geschenke-Fee: liefert die Seite aus (seite/) und malt das Bild zum Wunsch (/api/bild).
// Ohne Abhaengigkeiten. Das Bild kommt vom bestehenden Bildgenerator (BALLZ_MCP_URL, nano_banana);
// Schluessel stehen nur als Railway-Variable, nie im Code.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORT = fileURLToPath(new URL('.', import.meta.url));
const SEITE = join(ORT, 'seite');
const PORT = process.env.PORT || 8080;
const BILD_URL = process.env.BALLZ_MCP_URL || '';
const BILD_TOKEN = process.env.BALLZ_MCP_TOKEN || '';
const PRO_IP = Number(process.env.WUENSCHE_PRO_IP || 8);          // Bilder je IP und Stunde
const PRO_TAG = Number(process.env.WUENSCHE_PRO_TAG || 150);      // Bilder insgesamt je Tag
const TYPEN = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.jpg': 'image/jpeg' };

/* Mengenbegrenzung: schuetzt vor Missbrauch und unerwarteten Kosten */
const proIp = new Map(); let tag = { datum: '', n: 0 };
function erlaubt(ip) {
  const jetzt = Date.now(), heute = new Date().toISOString().slice(0, 10);
  if (tag.datum !== heute) tag = { datum: heute, n: 0 };
  if (tag.n >= PRO_TAG) return 'tag';
  const liste = (proIp.get(ip) || []).filter(t => jetzt - t < 3600e3);
  if (liste.length >= PRO_IP) { proIp.set(ip, liste); return 'ip'; }
  liste.push(jetzt); proIp.set(ip, liste); tag.n++; return '';
}
setInterval(() => { const j = Date.now(); for (const [ip, l] of proIp) { const n = l.filter(t => j - t < 3600e3); n.length ? proIp.set(ip, n) : proIp.delete(ip); } }, 600e3).unref();

/* Minimaler MCP-Client (Streamable HTTP) fuer genau einen Aufruf */
async function mcpPost(koerper, sitzung) {
  const kopf = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
  if (BILD_TOKEN) kopf.authorization = 'Bearer ' + BILD_TOKEN;
  if (sitzung) kopf['mcp-session-id'] = sitzung;
  const r = await fetch(BILD_URL, { method: 'POST', headers: kopf, body: JSON.stringify(koerper), signal: AbortSignal.timeout(150000) });
  const text = await r.text();
  if (!r.ok) throw new Error('Bilddienst antwortet ' + r.status);
  let daten = null;
  if ((r.headers.get('content-type') || '').includes('text/event-stream')) {
    const z = text.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).filter(Boolean);
    for (const e of z) { try { const j = JSON.parse(e); if (j.id === koerper.id) daten = j; } catch {} }
  } else if (text) daten = JSON.parse(text);
  return { daten, sitzung: r.headers.get('mcp-session-id') || sitzung };
}
async function malen(prompt) {
  if (!BILD_URL) throw Object.assign(new Error('Bilddienst nicht eingerichtet'), { code: 503 });
  let s = await mcpPost({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'geschenke-fee', version: '1' } } });
  const sitzung = s.sitzung;
  try { await mcpPost({ jsonrpc: '2.0', method: 'notifications/initialized' }, sitzung); } catch {}
  s = await mcpPost({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'nano_banana', arguments: { prompt, aspect_ratio: '1:1', image_size: '1K', inline_image: false } } }, sitzung);
  const inhalt = s.daten && s.daten.result && s.daten.result.content || [];
  const text = inhalt.map(b => b.text || '').join(' ');
  const u = text.match(/https:\/\/[^\s"')]+\.(?:jpg|jpeg|png|webp)/i);
  if (!u) throw new Error('Kein Bild im Ergebnis');
  return u[0];
}

/* Bildauftrag pruefen und zu einem sicheren Prompt zusammensetzen */
const kurz = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f"<>]/g, ' ').trim().slice(0, n);
function promptAus(k) {
  const farben = (Array.isArray(k.farben) ? k.farben : []).filter(f => /^#[0-9a-fA-F]{6}$/.test(f)).slice(0, 3);
  const schrift = kurz(k.schrift, 40);
  return 'Hochwertiges Produktfoto: ' + kurz(k.artikel, 40) + ' für den Anlass ' + (kurz(k.anlass, 60) || 'Geschenk') + ', weiches Tageslicht, ruhiger heller Hintergrund, der Artikel steht im Mittelpunkt. ' +
    'Auf dem Artikel ist ein liebevoll gemaltes, gedrucktes Motiv zu sehen: ' + kurz(k.motiv, 500) + (farben.length ? ' Farben: ' + farben.join(', ') : '') + (kurz(k.stimmung, 30) ? ', Stimmung ' + kurz(k.stimmung, 30) : '') + '.' +
    (schrift ? ' Der gedruckte Text lautet genau "' + schrift + '", keine weiteren Wörter oder Buchstaben.' : ' Auf dem Artikel steht kein Text.') +
    ' Das Motiv ist sauber und passend auf den Artikel gedruckt.';
}

function lesen(req) {
  return new Promise((ok, nein) => { let n = 0; const t = []; req.on('data', c => { n += c.length; if (n > 8000) { nein(new Error('zu gross')); req.destroy(); } else t.push(c); }); req.on('end', () => ok(Buffer.concat(t).toString('utf8'))); req.on('error', nein); });
}
const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); };

http.createServer(async (req, res) => {
  const pfad = new URL(req.url, 'http://x').pathname;
  try {
    if (pfad === '/gesund') { res.writeHead(200); return res.end('ok'); }
    if (pfad === '/api/bild' && req.method === 'POST') {
      const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
      let k; try { k = JSON.parse(await lesen(req)); } catch { return json(res, 400, { fehler: 'Anfrage nicht lesbar.' }); }
      if (!kurz(k.motiv, 500) || !kurz(k.artikel, 40)) return json(res, 400, { fehler: 'Motiv und Artikel fehlen.' });
      const sperre = erlaubt(ip);
      if (sperre === 'ip') return json(res, 429, { fehler: 'Die Fee braucht eine kleine Pause. Bitte in ein paar Minuten nochmal.' });
      if (sperre === 'tag') return json(res, 429, { fehler: 'Die Fee hat heute schon sehr viele Wünsche gemalt. Bitte morgen wieder.' });
      try { return json(res, 200, { url: await malen(promptAus(k)) }); }
      catch (e) { console.error('Bild fehlgeschlagen:', e.message); return json(res, e.code === 503 ? 503 : 502, { fehler: 'Das Bild hat gerade nicht geklappt. Bitte nochmal versuchen.' }); }
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
    let rel = pfad === '/' ? 'vorschau-index.html' : decodeURIComponent(pfad.slice(1));
    const voll = normalize(join(SEITE, rel));
    if (!voll.startsWith(SEITE + sep) || rel.startsWith('quelle/') || rel === 'bauen.py' || rel === 'index.html') { res.writeHead(404); return res.end('Nicht gefunden'); }
    const typ = TYPEN[extname(voll)]; if (!typ) { res.writeHead(404); return res.end('Nicht gefunden'); }
    const datei = await readFile(voll);
    res.writeHead(200, { 'content-type': typ, 'cache-control': extname(voll) === '.html' ? 'no-cache' : 'public, max-age=3600', 'x-content-type-options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : datei);
  } catch (e) {
    if (e.code === 'ENOENT') { res.writeHead(404); return res.end('Nicht gefunden'); }
    console.error('Fehler bei', pfad, e); res.writeHead(500); res.end('Fehler');
  }
}).listen(PORT, () => console.log('Geschenke-Fee laeuft auf Port', PORT));
