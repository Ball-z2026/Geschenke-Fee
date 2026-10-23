// Client fuer den bestehenden Bildgenerator (ballz-image-mcp, Streamable-HTTP MCP).
// Dadurch braucht dieser Dienst keinen eigenen OpenAI-Schluessel fuer Bilder.

let sessionId = null;
let rpcId = 1;
let initPromise = null;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Fehler, bei denen sich ein erneuter Versuch lohnt (Bilddienst gerade ausgelastet, Netz, kurzer 5xx).
function isTransient(msg) {
  return /HTTP (429|5\d\d)|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|socket hang up|network|timeout|aborted|unlesbare Antwort|fetch failed|terminated|keine PNG-Daten/i.test(String(msg || ''));
}
// Der Bilddienst hat das Motiv inhaltlich abgelehnt (kein Bild geliefert). Ein identischer
// zweiter Versuch bringt dann nichts - der Aufrufer sollte den Prompt aendern.
export function isRefusal(msg) {
  return /keine Bild-URL|refus|safety|policy|moderation|rejected|not allowed|cannot (create|generate)|unable to (create|generate)/i.test(String(msg || ''));
}

// Zeitlimits: Bildgenerierung darf lange dauern, aber nie ewig - sonst haengt der Auftrag und
// blockiert einen der wenigen parallelen Plaetze. Ein Timeout gilt als voruebergehend (Retry).
const T_CALL = 240000, T_INIT = 30000, T_DOWNLOAD = 60000;

function parseBody(text) {
  const t = text.trim();
  if (t.startsWith('{')) return JSON.parse(t);
  const events = t.split('\n\n').map(b => b.split('\n').filter(l => l.startsWith('data:')).map(l => l.slice(5).trim()).join(''));
  for (const e of events.reverse()) {
    if (e) { try { const j = JSON.parse(e); if (j.result || j.error) return j; } catch (err) { /* naechstes Event */ } }
  }
  throw new Error('MCP: unlesbare Antwort');
}

async function rpc(url, method, params, isNotification = false) {
  const body = { jsonrpc: '2.0', method, params };
  if (!isNotification) body.id = rpcId++;
  const headers = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
  if (sessionId) headers['mcp-session-id'] = sessionId;
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(method === 'tools/call' ? T_CALL : T_INIT) });
  const sid = r.headers.get('mcp-session-id');
  if (sid) sessionId = sid;
  if (isNotification) return null;
  if (!r.ok) throw new Error(`MCP HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = parseBody(await r.text());
  if (j.error) throw new Error(`MCP: ${j.error.message || JSON.stringify(j.error)}`);
  return j.result;
}

async function ensureSession(url) {
  if (sessionId) return;
  // Nur EINE Initialisierung gleichzeitig, auch wenn viele Anfragen parallel kommen.
  if (!initPromise) {
    initPromise = (async () => {
      await rpc(url, 'initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'motto-otto', version: '1.0.0' } });
      await rpc(url, 'notifications/initialized', {}, true);
    })().finally(() => { initPromise = null; });
  }
  await initPromise;
}

async function callTool(url, name, args) {
  const MAX = 3;
  let lastErr = null;
  for (let attempt = 1; attempt <= MAX; attempt++) {
    try {
      await ensureSession(url);
      return await rpc(url, 'tools/call', { name, arguments: args });
    } catch (e) {
      lastErr = e;
      const msg = e && e.message ? e.message : String(e);
      // Abgelaufene/ungueltige Session: neu aufbauen und sofort erneut versuchen.
      if (/session/i.test(msg)) { sessionId = null; initPromise = null; continue; }
      // Bilddienst ausgelastet oder kurzer Netzfehler: mit wachsender Pause erneut versuchen.
      if (isTransient(msg) && attempt < MAX) { await sleep(attempt * 1500); continue; }
      throw e;
    }
  }
  throw lastErr;
}

// Der Bilddienst meldet Fehler NICHT als JSON-RPC-Fehler, sondern als ganz normale Antwort
// mit isError und dem Grund als Text darin. Ohne diese Auswertung wurde daraus das
// nichtssagende "keine Bild-URL in Antwort", waehrend die eigentliche Ursache ungelesen
// im Text stand. Genau so verstecken sich Fehler monatelang.
const kurzText = (s) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > 400 ? t.slice(0, 400) + ' …' : t;
};

async function pullImage(result) {
  const text = (result.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
  if (result.isError) throw new Error('Bilddienst meldet einen Fehler: ' + (kurzText(text) || 'ohne Text'));
  const m = text.match(/https?:\/\/\S+?\.png/);
  if (!m) throw new Error('MCP: keine Bild-URL in Antwort. Der Dienst antwortete: ' + (kurzText(text) || '(leere Antwort)'));
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const img = await fetch(m[0], { signal: AbortSignal.timeout(T_DOWNLOAD) });
      if (!img.ok) throw new Error(`Bild-Download HTTP ${img.status}`);
      const png = Buffer.from(await img.arrayBuffer());
      // Nur echte PNG-Daten akzeptieren (Fehlerseite o. Ae. wuerde sonst spaeter in sharp abstuerzen)
      if (png.length < 100 || png[0] !== 0x89 || png[1] !== 0x50 || png[2] !== 0x4e || png[3] !== 0x47) throw new Error('Bild-Download: keine PNG-Daten');
      return { png, url: m[0] };
    } catch (e) {
      lastErr = e;
      if (attempt < 3) { await sleep(attempt * 1000); continue; }
    }
  }
  throw lastErr;
}

/** Neues Bild aus reinem Text. */
// model ist freiwillig: ohne Angabe nimmt der Bildserver sein eingestelltes Modell.
// Damit laufen eine schnelle und eine aufwendige Linie ueber denselben Server.
// task (Fassung 85): Standard bleibt 'design' - der Bilddienst liefert dann Transparenz, und
// genau die braucht jedes Motiv. Fuer ein Produktfoto IN einer Umgebung waere sie falsch: ein
// Handtuch am Strand braucht den Strand. Dafuer gibt es 'photo' (Hintergrund bleibt drin).
// Der Standard ist bewusst unveraendert - kein bestehender Aufruf aendert sein Verhalten.
export async function generateViaBallz(url, { prompt, size, quality, model, task, background }) {
  // inline_image: false - der Bilddienst kann das fertige Bild als Bildblock mitschicken,
  // damit ein Mensch es gleich sieht. Hier holt der Server die Datei ohnehin ueber die
  // Preview-URL. Mitgeschickt waeren es bei jedem Kundendesign mehrere MB base64 zusaetzlich,
  // die niemand ansieht - Uebertragung und Arbeitsspeicher fuer nichts.
  const args = { prompt, size, quality, task: task || 'design', output_format: 'png', inline_image: false };
  // 6. Okt., Markus: "100 % alles transparent ausgeliefert, direkt so produziert". Nicht auf die Voreinstellung des
  // Bilddienstes verlassen ('design' -> transparent): jedes Motiv bestellt den Alphakanal ausdruecklich.
  if (args.task === 'design') args.background = 'transparent';
  else if (background) args.background = background;   // 7. Okt.: Szenen-Fotos bestellen ausdruecklich 'opaque'
  if (model) args.model = model;
  return pullImage(await callTool(url, 'generate_ballz_image', args));
}

/** Bild auf Basis einer Kundenvorlage (Foto, Zeichnung) neu zeichnen. */
// background (24. Sept.): Stufe 1 der Postkarte malt ein VOLLFLAECHIGES Bild - die Menschen samt
// Strasse, Haeusern und Himmel. Mit der Vorgabe 'design' liefert der Bilddienst Transparenz, und
// damit waere genau der Hintergrund weg, den die Karte braucht. Also durchreichen statt raten.
export async function editViaBallz(url, { prompt, size, quality, imageBase64, mimeType, model, maskBase64, inputFidelity, referenceImageUrls, referenceImagesBase64, background }) {
  // task 'design' wie beim Erzeugen: der Bilddienst liefert dann Transparenz (Alphakanal) -
  // fuer Korrektur, Nachzeichnen, Vorlage und Kundenfoto genauso noetig wie fuer ein neues Motiv.
  const args = {
    prompt, size, quality, task: 'design', output_format: 'png', inline_image: false,
    image_base64: imageBase64, mime_type: mimeType || 'image/png'
  };
  args.background = background || 'transparent';   // 6. Okt.: ausdruecklich transparent; nur die Postkarte bestellt 'opaque'
  if (model) args.model = model;
  // Maske (Fassung 55, Logo als Grundlage): wo sie deckt, darf das Modell NICHT malen. Nur so
  // bleibt ein platziertes Logo wirklich stehen - per Prompt allein malt das Modell alles neu.
  if (maskBase64) args.mask_base64 = maskBase64;
  if (inputFidelity) args.input_fidelity = inputFidelity;
  // 20. Sept., "Gruesse aus": weitere Vorlagen neben dem Kundenfoto - echte Fotos der
  // Sehenswuerdigkeiten (Wikipedia). Der Bilddienst reicht sie als image[] an das Modell.
  if (Array.isArray(referenceImageUrls) && referenceImageUrls.length) args.reference_image_urls = referenceImageUrls.slice(0, 8);
  // 26. Sept., Markus: "Bis zu fuenf Fotos hochladen, und es wird aus den Fotos was gebaut."
  // EIGENE Fotos des Kunden haben keine Adresse im Netz - und sollen auch keine bekommen. Sie
  // gehen als Daten mit, genau wie das Selfie selbst (Hausregel: kein Kundenfoto auf der Platte,
  // und erst recht keins unter einer abrufbaren URL).
  if (Array.isArray(referenceImagesBase64) && referenceImagesBase64.length) args.reference_images_base64 = referenceImagesBase64.slice(0, 8);
  return pullImage(await callTool(url, 'edit_ballz_image', args));
}
