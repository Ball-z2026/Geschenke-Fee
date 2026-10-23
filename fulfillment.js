// Bestellungen aus Shopify an die Dienstleister weiterleiten (Bauweise wie vorzeige.js / abstimmung.js).
// Jede Bestellzeile wird nach ROUTE aufgeteilt:
//   - 'eigendruck'  -> unser eigener Druck (Textilien): wird als Druckauftrag erfasst (Druckdatei-Link je Zeile).
//   - 'pod'         -> Print-on-Demand-Dienstleister (Tasse, Kissen, Poster, Strandtuch, Sticker ...):
//                      Bestellung wird per API an den Anbieter geschickt (Gelato / Printful / Printify).
//
// Die Anbieter sind ABSTRAKT gehalten (channels-Prinzip): tatsaechlich gesendet wird nur, wenn der jeweilige
// API-Key gesetzt ist UND ein Produkt-Mapping vorliegt - sonst wird die Zeile als 'ausstehend' vermerkt.
// So ist alles startklar, bevor Store und Anbieter-Konten final verbunden sind.
//
// Zuordnung Bestellzeile -> unser Design/Produkt (in Shopify pro Variante hinterlegen):
//   a) line_item.properties:  _designId, _produkt, _groesse, (_printUrl optional)
//   b) oder SKU:              MO-<designId>__<produkt>__<groesse>     z. B. MO-ABI-20260907-AB12__tasse__
// Die Druckdatei wird in ECHTER Groesse (max 36x46 cm, 300 dpi) ueber eine signierte URL bereitgestellt.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const PRODUKT_SYNONYME = {
  tee: 'tee', tshirt: 'tee', 't-shirt': 'tee', shirt: 'tee',
  hoodie: 'hoodie', kapuzenpullover: 'hoodie', pulli: 'hoodie',
  polo: 'polo', poloshirt: 'polo',
  zip: 'zip', 'zip-jacke': 'zip', zipjacke: 'zip', jacke: 'zip',
  tasse: 'tasse', mug: 'tasse', becher: 'tasse',
  beutel: 'beutel', tasche: 'beutel', tote: 'beutel',
  strandtuch: 'strandtuch', handtuch: 'strandtuch', towel: 'strandtuch',
  kissen: 'kissen', cushion: 'kissen', pillow: 'kissen',
  poster: 'poster', print: 'poster',
  sticker: 'sticker', aufkleber: 'sticker'
};
const normProdukt = (v) => PRODUKT_SYNONYME[String(v || '').trim().toLowerCase()] || String(v || '').trim().toLowerCase();

// Standard-Routing (per storage/fulfillment-routes.json ueberschreibbar). Eigendruck = Textil, Rest = POD.
const DEFAULT_ROUTES = {
  tee:        { route: 'eigendruck' },
  hoodie:     { route: 'eigendruck' },
  polo:       { route: 'eigendruck' }, // 5. Okt.: Polo kommt ueber die Shopify-Kasse - eigener Druck wie das Shirt
  zip:        { route: 'eigendruck' },
  beutel:     { route: 'eigendruck' },
  tasse:      { route: 'pod', map: {} },
  strandtuch: { route: 'pod', map: {} },
  kissen:     { route: 'pod', map: {} },
  poster:     { route: 'pod', map: {} },
  sticker:    { route: 'pod', map: {} }
};

export function mountFulfillment(app, deps) {
  const { STORE, env, signPreview, SIGN_SECRET, adminGuard } = deps;
  const DIR = path.join(STORE, 'fulfillment');
  const ROUTES_FILE = path.join(STORE, 'fulfillment-routes.json');
  const base = () => String(env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  const defaultProvider = () => String(env.POD_PROVIDER || 'gelato').toLowerCase();

  let ROUTES = { ...DEFAULT_ROUTES };
  (async () => { try { ROUTES = { ...DEFAULT_ROUTES, ...JSON.parse(await fs.readFile(ROUTES_FILE, 'utf8')) }; } catch (e) { /* Standard */ } })();

  const orderFile = (id) => path.join(DIR, String(id).replace(/[^A-Za-z0-9_.-]/g, '') + '.json');
  async function readOrder(id) { try { return JSON.parse(await fs.readFile(orderFile(id), 'utf8')); } catch (e) { return null; } }
  async function writeOrder(o) { await fs.mkdir(DIR, { recursive: true }); await fs.writeFile(orderFile(o.orderId), JSON.stringify(o, null, 2)); }

  const providerActive = (p) => ({
    gelato: !!env.GELATO_API_KEY,
    printful: !!env.PRINTFUL_API_KEY,
    printify: !!(env.PRINTIFY_API_KEY && env.PRINTIFY_SHOP_ID)
  })[p] || false;

  // Signierte, echt-grosse Druckdatei (PNG, 36x46 cm @300dpi) - vom Dienstleister abrufbar.
  function printFileUrl(designId) {
    const id = String(designId).replace(/[^A-Za-z0-9_-]/g, '');
    const exp = Date.now() + 120 * 86400e3; // 120 Tage gueltig (Produktion + Nachdruck)
    return `${base()}/api/mo/druck/${id}.png?exp=${exp}&sig=${signPreview(id, exp, SIGN_SECRET)}`;
  }

  app.get('/api/mo/druck/:file', async (req, res) => {
    const designId = String(req.params.file).replace(/\.png$/i, '').replace(/[^A-Za-z0-9_-]/g, '');
    const { exp, sig } = req.query;
    if (!exp || +exp < Date.now() || signPreview(designId, exp, SIGN_SECRET) !== sig) return res.status(403).end();
    try {
      const buf = await fs.readFile(path.join(STORE, 'masters', `${designId}_PRINT_MASTER.png`));
      res.type('png').set('cache-control', 'private, max-age=3600').send(buf);
    } catch (e) { res.status(404).end(); }
  });

  // ---- Bestellzeilen aus Shopify lesen ----
  function parseLineItem(li) {
    const props = {};
    (li.properties || []).forEach(p => { if (p && p.name != null) props[String(p.name).replace(/^_/, '').toLowerCase()] = p.value; });
    let designId = props.designid || props.design || '';
    let produkt = props.produkt || props.product || '';
    let groesse = props.groesse || props.size || props['größe'] || '';
    let printUrl = props.printurl || props.print || '';
    if ((!designId || !produkt) && li.sku && /__/.test(li.sku)) {
      const parts = String(li.sku).split('__');
      if (!designId) designId = (parts[0] || '').replace(/^MO-/i, '');
      if (!produkt) produkt = parts[1] || '';
      if (!groesse) groesse = parts[2] || '';
    }
    return {
      designId: String(designId).replace(/[^A-Za-z0-9_-]/g, ''),
      produkt: normProdukt(produkt),
      groesse: String(groesse || ''),
      printUrl: printUrl || '',
      qty: +li.quantity || 1,
      title: li.title || li.name || '',
      sku: li.sku || ''
    };
  }

  function routeOf(produkt) { return (ROUTES[produkt] && ROUTES[produkt].route) || (produkt ? 'pod' : 'unbekannt'); }

  // ---- Dienstleister (abstrakt). Sendet nur, wenn Key + Mapping da; sonst 'ausstehend'. ----
  async function forwardPOD(provider, order, items) {
    const log = [];
    if (!providerActive(provider)) return { status: 'ausstehend', reason: `kein ${provider.toUpperCase()}_API_KEY gesetzt`, produkte: [...new Set(items.map(i => i.produkt))] };
    // Produkt-Mapping je Anbieter pruefen (productUid / variant_id ...). Fehlt es -> ausstehend.
    const missing = items.filter(i => !(ROUTES[i.produkt] && ROUTES[i.produkt].map && ROUTES[i.produkt].map[provider]));
    if (missing.length) return { status: 'ausstehend', reason: `Produkt-Mapping fehlt fuer: ${[...new Set(missing.map(i => i.produkt))].join(', ')}`, hint: 'in storage/fulfillment-routes.json ergaenzen' };
    try {
      const payload = buildProviderPayload(provider, order, items);
      const r = await callProvider(provider, payload);
      log.push('gesendet an ' + provider + ': ' + (r && r.id ? r.id : 'ok'));
      return { status: 'gesendet', providerOrderId: r && r.id ? r.id : null, log };
    } catch (e) {
      return { status: 'fehler', reason: (e && e.message ? e.message : String(e)).slice(0, 200) };
    }
  }

  function shipTo(order) {
    const s = order.shipping_address || order.customer && order.customer.default_address || {};
    return {
      name: s.name || [s.first_name, s.last_name].filter(Boolean).join(' ') || (order.customer && order.customer.first_name) || 'Kunde',
      address1: s.address1 || '', address2: s.address2 || '',
      city: s.city || '', zip: s.zip || '', province: s.province || '',
      country: s.country_code || s.country || 'DE', phone: s.phone || '', email: order.email || ''
    };
  }
  function buildProviderPayload(provider, order, items) {
    const to = shipTo(order);
    const line = (i) => ({ produkt: i.produkt, qty: i.qty, printUrl: i.printUrl || printFileUrl(i.designId), map: ROUTES[i.produkt].map[provider] });
    if (provider === 'gelato') {
      return {
        orderReferenceId: 'MO-' + (order.id || order.name),
        items: items.map(i => { const l = line(i); return { productUid: l.map.productUid, quantity: l.qty, files: [{ type: 'default', url: l.printUrl }] }; }),
        shippingAddress: { firstName: to.name, addressLine1: to.address1, addressLine2: to.address2, city: to.city, postCode: to.zip, country: to.country, email: to.email }
      };
    }
    if (provider === 'printful') {
      return {
        external_id: 'MO-' + (order.id || order.name),
        recipient: { name: to.name, address1: to.address1, address2: to.address2, city: to.city, zip: to.zip, country_code: to.country, email: to.email },
        items: items.map(i => { const l = line(i); return { variant_id: l.map.variant_id, quantity: l.qty, files: [{ url: l.printUrl }] }; })
      };
    }
    // printify u. a. spaeter
    return { external_id: 'MO-' + (order.id || order.name), items: items.map(line), recipient: to };
  }
  async function callProvider(provider, payload) {
    const opt = { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(20000) };
    let url;
    if (provider === 'gelato') { url = 'https://order.gelatoapis.com/v4/orders'; opt.headers['X-API-KEY'] = env.GELATO_API_KEY; }
    else if (provider === 'printful') { url = 'https://api.printful.com/orders'; opt.headers['Authorization'] = 'Bearer ' + env.PRINTFUL_API_KEY; }
    else throw new Error('Anbieter ' + provider + ' noch nicht angebunden');
    const r = await fetch(url, opt);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(provider + ' ' + r.status + ' ' + JSON.stringify(j).slice(0, 160));
    return j.id ? j : (j.result || j);
  }

  // ---- Kernablauf: Bestellung aufteilen und weiterleiten ----
  async function handleOrder(order, { shop } = {}) {
    const orderId = String(order.id || order.name || Date.now());
    const existing = await readOrder(orderId);
    if (existing && existing.done) return { duplicate: true, orderId };

    const items = (order.line_items || []).map(parseLineItem).filter(i => i.produkt && i.produkt !== 'unbekannt');
    const groups = { eigendruck: [], pod: {}, unbekannt: [] };
    for (const it of items) {
      const rt = routeOf(it.produkt);
      if (rt === 'eigendruck') groups.eigendruck.push(it);
      else if (rt === 'pod') { const prov = (ROUTES[it.produkt] && ROUTES[it.produkt].provider) || defaultProvider(); (groups.pod[prov] = groups.pod[prov] || []).push(it); }
      else groups.unbekannt.push(it);
    }

    const rec = { orderId, shop: shop || null, name: order.name || null, created: new Date().toISOString(), email: order.email || null, ship: shipTo(order), routes: {}, done: false };
    // Eigendruck: als Druckauftrag erfassen (Druckdatei-Links in echter Groesse)
    if (groups.eigendruck.length) {
      rec.routes.eigendruck = {
        status: 'erfasst',
        items: groups.eigendruck.map(i => ({ ...i, druckdatei: i.printUrl || printFileUrl(i.designId) }))
      };
    }
    // POD je Anbieter
    rec.routes.pod = {};
    for (const [prov, list] of Object.entries(groups.pod)) {
      rec.routes.pod[prov] = { status: 'geplant', items: list.map(i => ({ produkt: i.produkt, groesse: i.groesse, qty: i.qty, designId: i.designId, druckdatei: i.printUrl || printFileUrl(i.designId) })) };
    }
    if (groups.unbekannt.length) rec.routes.unbekannt = { items: groups.unbekannt.map(i => ({ title: i.title, sku: i.sku })), hinweis: 'Keine Design/Produkt-Kennung in Zeile (properties oder SKU MO-..__produkt__).' };
    await writeOrder(rec);
    // 1. Okt. (Chat 2, Lizenzen): wer mithoeren will, bekommt die Bestellung - nicht blockierend.
    if (typeof deps.beiBestellung === 'function') deps.beiBestellung({ orderId, order }).catch(e => console.error('Lizenz nach Bestellung:', orderId, e && e.message ? e.message : e));
    // 6. Okt.: die Kasse (shopify-kasse.js) merkt sich die Zahlung und bucht verrechnete Entwuerfe ab - ebenso nicht blockierend.
    if (typeof deps.kasseBestellung === 'function') Promise.resolve().then(() => deps.kasseBestellung({ orderId, order })).catch(e => console.error('Kasse nach Bestellung:', orderId, e && e.message ? e.message : e));

    // Weiterleiten (nicht blockierend fuer die 200-Antwort an Shopify)
    (async () => {
      for (const [prov, list] of Object.entries(groups.pod)) {
        const res = await forwardPOD(prov, order, list);
        rec.routes.pod[prov] = { ...rec.routes.pod[prov], ...res };
      }
      rec.done = true;
      await writeOrder(rec);
      console.log('Fulfillment', orderId, '· Eigendruck', groups.eigendruck.length, '· POD', Object.keys(groups.pod).map(p => p + ':' + (rec.routes.pod[p].status)).join(','));
    })().catch(e => console.error('Fulfillment-Weiterleitung:', e && e.message ? e.message : e));

    return { ok: true, orderId, eigendruck: groups.eigendruck.length, pod: Object.fromEntries(Object.entries(groups.pod).map(([p, l]) => [p, l.length])), unbekannt: groups.unbekannt.length };
  }

  // ---- Shopify-Webhook (HMAC-geprueft). Body-Parser mit rawBody haengt in server.js davor. ----
  app.post('/api/mo/shopify/webhook', async (req, res) => {
    const secret = env.SHOPIFY_WEBHOOK_SECRET;
    if (!secret) return res.status(503).json({ error: 'SHOPIFY_WEBHOOK_SECRET nicht gesetzt' });
    const raw = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
    const digest = crypto.createHmac('sha256', secret).update(raw).digest('base64');
    const given = String(req.headers['x-shopify-hmac-sha256'] || '');
    let ok = false; try { ok = crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(given)); } catch (e) { ok = false; }
    if (!ok) return res.status(401).json({ error: 'HMAC ungueltig' });
    try {
      const out = await handleOrder(req.body || {}, { shop: req.headers['x-shopify-shop-domain'] });
      res.json(out);
    } catch (e) { console.error('Shopify-Webhook:', e && e.message ? e.message : e); res.status(200).json({ ok: false }); } // 200, damit Shopify nicht endlos retryt
  });

  // ---- Backend ----
  app.get('/api/admin/fulfillment/config', adminGuard, (req, res) => {
    res.json({
      routes: ROUTES, defaultProvider: defaultProvider(),
      provider: { gelato: providerActive('gelato'), printful: providerActive('printful'), printify: providerActive('printify') },
      webhookConfigured: !!env.SHOPIFY_WEBHOOK_SECRET,
      webhookUrl: `${base()}/api/mo/shopify/webhook`
    });
  });
  app.get('/api/admin/fulfillment', adminGuard, async (req, res) => {
    let files = []; try { files = await fs.readdir(DIR); } catch (e) { }
    const out = [];
    for (const f of files.filter(x => x.endsWith('.json'))) { const o = await readOrder(f.replace(/\.json$/, '')); if (o) out.push(o); }
    out.sort((a, b) => (b.created || '').localeCompare(a.created || ''));
    res.json({ orders: out.slice(0, 100) });
  });
  // Test ohne Shopify: Beispiel-Order durchspielen
  app.post('/api/mo/fulfillment/test', adminGuard, async (req, res) => {
    try { res.json(await handleOrder(req.body || {}, { shop: 'test' })); }
    catch (e) { res.status(400).json({ error: e && e.message ? e.message : String(e) }); }
  });

  return { handleOrder, printFileUrl, routeOf };
}
