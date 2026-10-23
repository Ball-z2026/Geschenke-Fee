import fs from 'node:fs/promises';
import path from 'node:path';

// Google Drive ohne SDK: OAuth (einmal im Backend verbinden), danach laedt der Dienst jede Druckdatei
// selbst hoch: Motto Otto / <motto> / <designId> / <designId>[_Name]_PRINT_MASTER.png
const SCOPE = 'https://www.googleapis.com/auth/drive.file';

export function gdrive({ clientId, clientSecret, storeDir, baseUrl, rootName }) {
  const file = path.join(storeDir, 'gdrive.json');
  const redirect = baseUrl + '/api/admin/gdrive/callback';
  let state = null;          // { refresh_token, access_token, expires, email, folders: {path: id} }
  let loaded = false;

  async function load() {
    if (loaded) return state;
    loaded = true;
    try { state = JSON.parse(await fs.readFile(file, 'utf8')); } catch (e) { state = null; }
    return state;
  }
  async function save() { await fs.writeFile(file, JSON.stringify(state, null, 2)); }

  const enabled = () => !!(clientId && clientSecret);

  function authUrl() {
    const p = new URLSearchParams({
      client_id: clientId, redirect_uri: redirect, response_type: 'code', scope: SCOPE,
      access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true'
    });
    return 'https://accounts.google.com/o/oauth2/v2/auth?' + p.toString();
  }

  async function tokenRequest(params) {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, ...params }).toString(),
      signal: AbortSignal.timeout(20000)
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('Google Token: ' + (j.error_description || j.error || r.status));
    return j;
  }

  async function connect(code) {
    const t = await tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: redirect });
    await load();
    state = { ...(state || {}), refresh_token: t.refresh_token || (state && state.refresh_token), access_token: t.access_token, expires: Date.now() + (t.expires_in || 3600) * 1000 - 60000, folders: {} };
    try {
      // 25. Sept.: auch dieser Nebenaufruf braucht eine Zeitgrenze - ohne sie haengt das
      // Verbinden des Drive-Kontos, obwohl der Name des Kontos nur Beiwerk ist.
      const me = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', { headers: { authorization: 'Bearer ' + state.access_token }, signal: AbortSignal.timeout(15000) }).then(r => r.json());
      state.email = me.user && me.user.emailAddress;
    } catch (e) { /* egal */ }
    await save();
    return state;
  }

  async function token() {
    await load();
    if (!state || !state.refresh_token) throw new Error('Google Drive nicht verbunden');
    if (state.access_token && state.expires > Date.now()) return state.access_token;
    const t = await tokenRequest({ refresh_token: state.refresh_token, grant_type: 'refresh_token' });
    state.access_token = t.access_token; state.expires = Date.now() + (t.expires_in || 3600) * 1000 - 60000;
    await save();
    return state.access_token;
  }

  async function api(url, opts = {}) {
    const tk = await token();
    const r = await fetch(url, { ...opts, headers: { authorization: 'Bearer ' + tk, ...(opts.headers || {}) }, signal: AbortSignal.timeout(120000) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('Drive ' + r.status + ': ' + (j.error && j.error.message ? j.error.message : url));
    return j;
  }

  // Ordner anlegen oder finden (gemerkt, damit nicht jedes Mal gesucht wird)
  async function folder(parts) {
    let parent = 'root';
    let key = '';
    for (const name of parts) {
      key += '/' + name;
      if (state.folders && state.folders[key]) { parent = state.folders[key]; continue; }
      const q = `name = '${name.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and '${parent}' in parents and trashed = false`;
      const found = await api('https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(q) + '&fields=files(id)');
      let id = found.files && found.files[0] && found.files[0].id;
      if (!id) {
        const made = await api('https://www.googleapis.com/drive/v3/files?fields=id', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parent] })
        });
        id = made.id;
      }
      state.folders = state.folders || {};
      state.folders[key] = id;
      await save();
      parent = id;
    }
    return parent;
  }

  // Datei hochladen (ersetzt gleichnamige Datei im Ordner)
  async function upload(parts, filename, buffer, mime) {
    const parentId = await folder([rootName, ...parts]);
    const q = `name = '${filename.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed = false`;
    const found = await api('https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(q) + '&fields=files(id)');
    const existing = found.files && found.files[0] && found.files[0].id;

    const boundary = 'mo' + Date.now().toString(16);
    const meta = existing ? { name: filename } : { name: filename, parents: [parentId] };
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\ncontent-type: ${mime}\r\n\r\n`),
      buffer,
      Buffer.from(`\r\n--${boundary}--`)
    ]);
    const url = existing
      ? `https://www.googleapis.com/upload/drive/v3/files/${existing}?uploadType=multipart&fields=id,webViewLink`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink';
    return api(url, { method: existing ? 'PATCH' : 'POST', headers: { 'content-type': `multipart/related; boundary=${boundary}` }, body });
  }

  // Einen Design-Ordner (und damit alle enthaltenen Druckdateien) in den Drive-Papierkorb legen.
  // Sucht nach dem exakten Ordnernamen (= Design-Nummer) - unabhaengig vom Motto-Unterordner.
  async function removeFolderByName(name) {
    await load();
    if (!(state && state.refresh_token)) return { skipped: true };
    const nm = String(name || '').trim();
    if (!nm) return { skipped: true };
    const q = `name = '${nm.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const found = await api('https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(q) + '&fields=files(id)');
    let n = 0;
    for (const f of (found.files || [])) {
      await api(`https://www.googleapis.com/drive/v3/files/${f.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ trashed: true }) });
      n++;
    }
    if (state.folders) { for (const k of Object.keys(state.folders)) if (k.endsWith('/' + nm)) delete state.folders[k]; await save(); }
    return { trashed: n };
  }

  // Aeltere Dateien in einem Ordner in den Papierkorb legen; nur die neuesten `keep` (nach Name, absteigend) bleiben.
  // Fuer die Backups: Dateinamen tragen das Datum, damit sortiert "neu" = "oben".
  async function pruneFolder(parts, keep) {
    await load();
    if (!(state && state.refresh_token)) return { skipped: true };
    const parentId = await folder([rootName, ...parts]);
    const q = `'${parentId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`;
    const found = await api('https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(q) + '&fields=files(id,name)&pageSize=200');
    const files = (found.files || []).sort((a, b) => String(b.name).localeCompare(String(a.name)));
    const k = Math.max(1, keep | 0);
    let n = 0;
    for (const f of files.slice(k)) {
      await api(`https://www.googleapis.com/drive/v3/files/${f.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ trashed: true }) });
      n++;
    }
    return { trashed: n, kept: Math.min(files.length, k) };
  }

  // ---------- Der Rueckweg ----------
  // Bisher konnte dieses Modul nur hochladen. Das reicht, solange die Druckdateien auch
  // lokal liegen. Sobald sie nach einer Aufbewahrungszeit geloescht werden, ist Drive das
  // Original - und dann muss man sie auch wieder holen koennen: aus der Druckdatei werden
  // Mockups, Namensvarianten, Brust-Print, Vektor und Rueckseite erst bei Bedarf gebaut.

  /** Datei im Ordner suchen. Rueckgabe: null oder { id, name, size, md5 }. */
  async function find(parts, filename) {
    // Ohne Verbindung gibt es hier nichts zu finden. Ohne diese Zeile stuerzt folder()
    // ueber das leere state ab ("Cannot read properties of null") - und der Aufrufer
    // sieht einen technischen Fehler statt eines klaren "liegt nicht im Archiv".
    await load();
    if (!state || !state.refresh_token) return null;
    const parentId = await folder([rootName, ...parts]);
    const q = `name = '${String(filename).replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed = false`;
    const found = await api('https://www.googleapis.com/drive/v3/files?q=' + encodeURIComponent(q) + '&fields=files(id,name,size,md5Checksum)');
    const f = found.files && found.files[0];
    return f ? { id: f.id, name: f.name, size: +f.size || 0, md5: f.md5Checksum || '' } : null;
  }

  /** Datei-Inhalt holen. Liefert einen Buffer. */
  async function download(fileId) {
    const tk = await token();
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
      headers: { authorization: 'Bearer ' + tk }, signal: AbortSignal.timeout(120000)
    });
    if (!r.ok) throw new Error('Drive Download ' + r.status + ' fuer ' + fileId);
    return Buffer.from(await r.arrayBuffer());
  }

  /** Suchen und holen in einem Schritt. null, wenn es die Datei dort nicht gibt. */
  async function fetchFile(parts, filename) {
    const f = await find(parts, filename);
    if (!f) return null;
    return { ...f, buffer: await download(f.id) };
  }

  async function status() {
    await load();
    return { enabled: enabled(), connected: !!(state && state.refresh_token), email: state && state.email || null, root: rootName };
  }

  async function disconnect() { state = null; loaded = true; await fs.rm(file, { force: true }); }

  return { enabled, authUrl, connect, upload, find, download, fetchFile, removeFolderByName, pruneFolder, status, disconnect, redirect };
}
