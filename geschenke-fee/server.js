// Vorschau-Dienst fuer Geschenke-fee.de: zeigt den Entwurf, das Logo und die Recherche.
// Bewusst ohne Abhaengigkeiten und ohne Motto-Otto-Code - Tammy soll den Stand ansehen koennen.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORT = fileURLToPath(new URL('.', import.meta.url));
const PORT = process.env.PORT || 8080;
const TYPEN = { '.svg': 'image/svg+xml', '.png': 'image/png', '.md': 'text/plain; charset=utf-8' };
const DATEIEN = {
  '/logo/fee-zeichen.svg': 'logo/fee-zeichen.svg',
  '/logo/geschenke-fee-logo.svg': 'logo/geschenke-fee-logo.svg',
  '/logo/geschenke-fee-logo.png': 'logo/geschenke-fee-logo.png',
  '/recherche': 'recherche-geschenkartikel.md',
  '/README': 'README.md',
};

async function startseite() {
  const html = await readFile(join(ORT, 'entwurf-seite.html'), 'utf8');
  if (/^\s*<!doctype/i.test(html)) return html;
  return '<!doctype html><html lang="de"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="robots" content="noindex"></head><body>' + html + '</body></html>';
}

http.createServer(async (req, res) => {
  const pfad = new URL(req.url, 'http://x').pathname;
  try {
    if (pfad === '/' || pfad === '/index.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' });
      return res.end(await startseite());
    }
    if (pfad === '/gesund') { res.writeHead(200); return res.end('ok'); }
    const datei = DATEIEN[pfad];
    if (!datei) { res.writeHead(404); return res.end('Nicht gefunden'); }
    res.writeHead(200, { 'content-type': TYPEN[extname(datei)] || 'application/octet-stream', 'x-robots-tag': 'noindex' });
    res.end(await readFile(join(ORT, datei)));
  } catch (fehler) {
    console.error('Geschenke-Fee Vorschau: Fehler bei', pfad, fehler);
    res.writeHead(500); res.end('Fehler');
  }
}).listen(PORT, () => console.log('Geschenke-Fee Vorschau laeuft auf Port', PORT));
