// Shopify-Kasse: aus einem fertigen Design auf motto-otto.de wird eine Draft Order in Shopify,
// und der Kunde geht ueber deren Rechnungslink (invoiceUrl) zur Kasse. Bauweise wie in SHOPIFY.md
// beschlossen (23. Sept.): Wir sind die Storefront, Shopify ist Kasse, Zahlung, Rechnung und
// Bestellverwaltung. Der Preis kommt allein aus preise.cjs - Shopify rechnet nichts nach.
//
// Nach dem Bezahlen wird aus dem Entwurf eine normale Bestellung; der orders/create-Webhook geht an
// fulfillment.js, und die Bestellzeilen tragen genau die Eigenschaften, die dort gelesen werden:
// _designId, _produkt, _groesse (fuehrender Unterstrich = im Checkout unsichtbar). Die signierte
// Druckdatei-Adresse baut fulfillment.js erst bei Eingang der Bestellung - dann laeuft sie ab da 120 Tage.
//
// Schalter und Zugang (Railway-Variablen):
//   SHOPIFY_KASSE          an | aus   - ohne "an" bleibt alles beim Anfrage-Weg (Mail)
//   SHOPIFY_SHOP           z08wrx-kx  oder z08wrx-kx.myshopify.com
//   SHOPIFY_CLIENT_ID      } App aus dem Shopify Dev Dashboard, im Shop installiert,
//   SHOPIFY_CLIENT_SECRET  } Bereiche write_draft_orders, read_draft_orders
//   SHOPIFY_ADMIN_TOKEN    (alternativ: fester Admin-Token einer alten benutzerdefinierten App)
//   SHOPIFY_API_VERSION    optional, Standard 2026-07
// Seit 2026 legt man im Shop-Admin keine neuen benutzerdefinierten Apps mehr an; Apps aus dem Dev
// Dashboard holen sich ihren Token per Client-Credentials-Grant, gueltig 24 Stunden. Das macht
// token() unten selbst und haelt ihn im Speicher.
//
// Kein Schluessel landet in einem Log, einer Antwort oder einer Datei.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import preise from './preise.cjs';

const AN = ['an', 'ein', 'ja', '1', 'true', 'on'];

export function mountShopifyKasse(app, deps) {
  const { STORE, GARMENTS, adminGuard, readJob, env } = deps;
  // 6. Okt.: wer angemeldet ist, bekommt bezahlte Entwuerfe beim Textilkauf verrechnet (identify, accounts aus server.js)
  const identify = typeof deps.identify === 'function' ? deps.identify : null;
  const accounts = deps.accounts || null;
  const DIR = path.join(STORE, 'kasse');
  const version = () => String(env.SHOPIFY_API_VERSION || '2026-07');

  function shopDomain() {
    let s = String(env.SHOPIFY_SHOP || '').trim().toLowerCase();
    s = s.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!s) return '';
    if (!s.endsWith('.myshopify.com')) s = s.replace(/\.myshopify\.com$/, '') + '.myshopify.com';
    return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(s) ? s : '';
  }
  const hatZugang = () => !!(env.SHOPIFY_ADMIN_TOKEN || (env.SHOPIFY_CLIENT_ID && env.SHOPIFY_CLIENT_SECRET));
  const schalterAn = () => AN.includes(String(env.SHOPIFY_KASSE || '').trim().toLowerCase());

  // Warum ist die Kasse aus? Eine Liste, die das Backend so anzeigen kann.
  function gruende() {
    const g = [];
    if (!schalterAn()) g.push('SHOPIFY_KASSE steht nicht auf "an"');
    if (!shopDomain()) g.push('SHOPIFY_SHOP fehlt oder ist keine myshopify-Adresse');
    if (!hatZugang()) g.push('Kein API-Zugang: SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET (oder SHOPIFY_ADMIN_TOKEN) fehlen');
    return g;
  }
  const kasseAn = () => gruende().length === 0;

  // ---- Token: fest gesetzt oder per Client-Credentials geholt (24 h, wir erneuern 10 min vorher) ----
  let cache = { token: '', bis: 0 };
  async function token() {
    if (env.SHOPIFY_ADMIN_TOKEN) return String(env.SHOPIFY_ADMIN_TOKEN);
    if (cache.token && Date.now() < cache.bis) return cache.token;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: String(env.SHOPIFY_CLIENT_ID || ''),
      client_secret: String(env.SHOPIFY_CLIENT_SECRET || '')
    });
    const r = await fetch(`https://${shopDomain()}/admin/oauth/access_token`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body, signal: AbortSignal.timeout(15000)
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.access_token) throw new Error('Shopify-Token: HTTP ' + r.status + (j.error ? ' ' + String(j.error).slice(0, 80) : ''));
    cache = { token: j.access_token, bis: Date.now() + (Math.max(+j.expires_in || 86399, 700) - 600) * 1000 };
    return cache.token;
  }

  async function gql(query, variables) {
    const call = async () => fetch(`https://${shopDomain()}/admin/api/${version()}/graphql.json`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-shopify-access-token': await token() },
      body: JSON.stringify({ query, variables: variables || {} }),
      signal: AbortSignal.timeout(20000)
    });
    let r = await call();
    // abgelaufener oder widerrufener Token: einmal neu holen
    if (r.status === 401 && !env.SHOPIFY_ADMIN_TOKEN) { cache = { token: '', bis: 0 }; r = await call(); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('Shopify ' + r.status + ' ' + JSON.stringify(j.errors || j).slice(0, 200));
    if (j.errors && j.errors.length) throw new Error('Shopify: ' + j.errors.map(e => e.message).join('; ').slice(0, 300));
    return j.data;
  }

  // ---- Bestellzeilen aus dem Design bauen ----
  const sauber = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n || 60);
  const groesseSauber = (s) => sauber(s, 12).replace(/[^A-Za-z0-9äöüÄÖÜß ./-]/g, '');

  // Eine Namensliste mit Groessen (j.people) wird zu je einer Zeile pro Person - die Werkstatt
  // braucht Name und Groesse am Stueck. Ohne Liste: eine Zeile mit der gewaehlten Groesse.
  // 6. Okt.: je Posten des Warenkorbs; die Liste nur, wenn der Posten sie ausdruecklich will (liste).
  function positionen(j, { garment, menge, groesse, liste, stufe, zweiteSeite, farbeName }) {
    const mit = { stufe, zweiteSeite, farbeName };
    const people = Array.isArray(j.people) ? j.people.filter(p => p && (p.name || p.size)) : [];
    const mitGroesse = people.filter(p => p.size);
    if (liste && preise.hatStufen(garment) && mitGroesse.length && mitGroesse.length === people.length && (!menge || menge === people.length)) {
      return people.map(p => ({
        ...mit, garment: preise.hatStufen(String(p.garment || '')) ? String(p.garment) : garment,
        groesse: groesseSauber(p.size), name: sauber(p.name, 60), menge: 1
      }));
    }
    return [{ ...mit, garment, groesse: preise.hatStufen(garment) ? groesseSauber(groesse) : '', name: '', menge }];
  }

  // Textilien (Staffel) gehen zuerst in die Rechnung - nur auf sie wird der bezahlte Entwurf verrechnet.
  function korbVon(zeilen) {
    return preise.warenkorb(zeilen.map(z => ({ artikel: z.garment, stufe: z.stufe, menge: z.menge, zweiteSeite: z.zweiteSeite })));
  }

  function draftInput({ j, designId, zeilen, korb, kunde, email, anfrageId, verrechnet }) {
    // Je Zeile der Stueckpreis inkl. zweiter Seite aus preise.warenkorb() - genau die Zahl, die der
    // Kunde auf der Seite gesehen hat (erst runden, dann multiplizieren). korb.posten steht in derselben
    // Reihenfolge wie zeilen (korbVon), so passt auch ein Shirt in zwei Stufen.
    const lineItems = zeilen.map((z, i) => {
      const p = korb.posten[i];
      const stueck = preise.rund(p.stueck + p.seite2);
      const teil = (GARMENTS[z.garment] && GARMENTS[z.garment].label) || preise.label(z.garment);
      const stufeLabel = p.stufeLabel || '';
      const titel = [teil, stufeLabel, z.groesse ? 'Größe ' + z.groesse : '', z.name || ''].filter(Boolean).join(' · ');
      const attrs = [
        ['Motiv', designId],
        ...(z.farbeName ? [['Textilfarbe', z.farbeName]] : []),
        ...(p.zweiteSeite ? [['Zweite Druckseite', 'ja']] : []),
        ...(p.rabatt ? [['Mengenrabatt', Math.round(p.rabatt * 100) + ' %']] : []),
        ['_designId', designId], ['_produkt', z.garment], ['_groesse', z.groesse || ''],
        ...(p.stufe ? [['_stufe', p.stufe]] : []),
        ...(z.name ? [['_name', z.name]] : []),
        ...(j.aufteilung && preise.hatStufen(z.garment) ? [['_aufteilung', String(j.aufteilung)]] : [])
      ].filter(([, v]) => v !== '' && v != null).map(([key, value]) => ({ key, value: String(value) }));
      return {
        title: sauber(titel, 250), quantity: z.menge,
        originalUnitPriceWithCurrency: { amount: stueck.toFixed(2), currencyCode: 'EUR' },
        requiresShipping: true, taxable: true,
        sku: ('MO-' + designId + '__' + z.garment + '__' + (z.groesse || '')).slice(0, 255),
        customAttributes: attrs
      };
    });
    const input = {
      lineItems,
      presentmentCurrencyCode: 'EUR',
      shippingLine: { title: korb.versandfrei ? 'Versand (frei)' : 'Versand', priceWithCurrency: { amount: korb.versand.toFixed(2), currencyCode: 'EUR' } },
      tags: ['motto-otto', 'kasse', designId.slice(0, 40)],
      note: sauber(`motto-otto.de · Design ${designId}${j.motto ? ' · ' + j.motto : ''}${kunde ? ' · Nachricht: ' + kunde : ''}`, 1000),
      customAttributes: [
        { key: '_designId', value: designId },
        { key: '_quelle', value: 'motto-otto.de' },
        { key: '_kasseId', value: anfrageId }
      ]
    };
    // Bezahlte Entwuerfe (1 € je Stueck) gehen beim Textilkauf wieder ab - als fester Nachlass auf die Bestellung.
    if (verrechnet > 0) input.appliedDiscount = { title: 'Bezahlte Entwürfe', description: 'Bezahlte Entwürfe, beim Textilkauf verrechnet', value: verrechnet, valueType: 'FIXED_AMOUNT' };
    if (email) input.email = email;
    return input;
  }

  // Wie viel darf verrechnet werden? Hoechstens das Guthaben, hoechstens die Textil-Ware.
  function verrechenbar(user, korb) {
    const guthaben = Math.max(0, Math.floor(+(user && user.verrechenbarCent) || 0)) / 100;
    const textil = korb.posten.filter(p => preise.hatStufen(p.artikel)).reduce((s, p) => s + p.summe, 0);
    return preise.rund(Math.min(guthaben, textil));
  }

  const MUT = `mutation Entwurf($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder { id name invoiceUrl totalPriceSet { shopMoney { amount currencyCode } } }
      userErrors { field message }
    }
  }`;

  // ---- Kunde: zur Kasse ----
  // 6. Okt. (Markus: "ja alles machen"): ein Warenkorb je Design - mehrere Posten (posten: [...]),
  // Textil UND Flachware (Kissen, Poster, Tasse ...). Ohne posten gilt der eine Posten aus den
  // Einzelfeldern wie bisher (alte Seiten im Speicher).
  const kasseFile = (id) => path.join(DIR, String(id).replace(/[^A-Za-z0-9_]/g, '') + '.json');
  async function kasseLesen(id) { try { return JSON.parse(await fs.readFile(kasseFile(id), 'utf8')); } catch (e) { return null; } }
  async function kasseSchreiben(rec) { await fs.mkdir(DIR, { recursive: true }); await fs.writeFile(kasseFile(rec.id), JSON.stringify(rec, null, 2)); }

  function postenSauber(b) {
    const roh = Array.isArray(b.posten) && b.posten.length ? b.posten.slice(0, 20) : [b];
    return roh.map(x => {
      x = x || {};
      const garment = String(x.garment || '');
      return {
        garment,
        menge: Math.min(Math.max(parseInt(x.menge, 10) || 1, 1), 500),
        groesse: String(x.groesse || ''),
        stufe: preise.STUFEN.some(st => st.key === String(x.stufe)) ? String(x.stufe) : 'liebling',
        zweiteSeite: !!x.zweiteSeite,
        farbeName: sauber(x.farbeName, 60),
        // Alte Seiten schickten keine Angabe und meinten "Liste, wenn sie komplett ist"
        liste: Array.isArray(b.posten) && b.posten.length ? !!x.liste : true
      };
    });
  }

  app.post('/api/mo/kasse', async (req, res) => {
    if (!kasseAn()) return res.status(503).json({ error: 'Die Kasse ist gerade nicht geöffnet – bitte schick uns eine Anfrage.', anfrage: true });
    const b = req.body || {};
    const designId = String(b.designId || '').replace(/[^A-Za-z0-9_-]/g, '');
    if (!designId) return res.status(400).json({ error: 'Bitte zuerst ein Design erstellen' });
    const posten = postenSauber(b);
    for (const x of posten) {
      if (!GARMENTS[x.garment] || !preise.istBekannt(x.garment)) return res.status(400).json({ error: 'Für dieses Teil gibt es noch keinen Preis – bitte schick uns eine Anfrage.', anfrage: true });
    }
    const j = await readJob(designId);
    if (!j) return res.status(404).json({ error: 'Design nicht gefunden' });
    if (j.status && j.status !== 'done') return res.status(409).json({ error: 'Das Design ist noch nicht fertig' });

    const emailRoh = String(b.email || '').trim().slice(0, 120);
    const email = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(emailRoh) ? emailRoh : '';
    const kunde = String(b.text || '').trim().slice(0, 500);

    const zeilen = [];
    for (const x of posten) zeilen.push(...positionen(j, x));
    if (zeilen.some(z => preise.hatStufen(z.garment) && !z.groesse)) return res.status(400).json({ error: 'Bitte eine Größe wählen' });
    // Die Staffel zaehlt ueber alle Textilien im Korb (preise.warenkorb), egal in wie vielen Posten.
    const korb = korbVon(zeilen);
    if (korb.posten.length !== zeilen.length) return res.status(400).json({ error: 'Für dieses Teil gibt es noch keinen Preis' });

    let user = null;
    try { if (identify) user = (await identify(req, res)).user || null; } catch (e) { console.error('Kasse: Konto lesen', e && e.message ? e.message : e); }
    const verrechnet = verrechenbar(user, korb);
    const gesamt = preise.rund(korb.gesamt - verrechnet);

    const anfrageId = 'kas_' + Date.now().toString(36) + crypto.randomBytes(6).toString('hex');
    try {
      const d = await gql(MUT, { input: draftInput({ j, designId, zeilen, korb, email, kunde, anfrageId, verrechnet }) });
      const out = d && d.draftOrderCreate;
      if (!out || (out.userErrors && out.userErrors.length) || !out.draftOrder || !out.draftOrder.invoiceUrl) {
        const fehler = out && out.userErrors ? out.userErrors.map(e => e.message).join('; ') : 'keine Antwort';
        console.error('Kasse: Entwurf abgelehnt:', designId, fehler.slice(0, 300));
        return res.status(502).json({ error: 'Die Kasse hat nicht geantwortet. Bitte gleich noch einmal versuchen.' });
      }
      const rec = {
        id: anfrageId, designId, motto: j.motto || '', created: new Date().toISOString(), status: 'offen',
        draft: out.draftOrder.id, draftName: out.draftOrder.name, invoiceUrl: out.draftOrder.invoiceUrl,
        shopifyGesamt: out.draftOrder.totalPriceSet && out.draftOrder.totalPriceSet.shopMoney ? out.draftOrder.totalPriceSet.shopMoney.amount : null,
        gesamt, ware: korb.ware, versand: korb.versand, rabatt: korb.rabatt, verrechnet,
        userId: user ? user.id : null, email: email || null,
        zeilen: zeilen.map((z, i) => ({ garment: z.garment, label: korb.posten[i].label, stufe: korb.posten[i].stufe, groesse: z.groesse || null, name: z.name || null, menge: z.menge, zweiteSeite: !!z.zweiteSeite, farbeName: z.farbeName || null, summe: korb.posten[i].summe }))
      };
      try { await kasseSchreiben(rec); }
      catch (e) { console.error('Kasse speichern:', e && e.message ? e.message : e); }
      // Abweichung zwischen unserer Rechnung und Shopify sofort sichtbar machen (z. B. Steuer-Einstellung)
      if (rec.shopifyGesamt != null && Math.abs(+rec.shopifyGesamt - gesamt) > 0.009) {
        console.error('Kasse: Shopify-Summe weicht ab', designId, 'wir', gesamt, 'Shopify', rec.shopifyGesamt, '- Shopify-Steuereinstellung "Preise inkl. Steuern" pruefen');
      }
      console.log('Kasse:', out.draftOrder.name, designId, zeilen.length + ' Zeile(n)', preise.euro(gesamt) + (verrechnet ? ' (verrechnet ' + preise.euro(verrechnet) + ')' : ''));
      res.json({ ok: true, url: out.draftOrder.invoiceUrl, gesamt, verrechnet, kasseId: anfrageId });
    } catch (e) {
      console.error('Kasse:', designId, e && e.message ? e.message : e);
      res.status(502).json({ error: 'Die Kasse ist gerade nicht erreichbar. Bitte gleich noch einmal versuchen.' });
    }
  });

  // ---- Kunde: Stand seiner Bestellung (die Nummer ist unratbar und steht nur in seinem Browser) ----
  app.get('/api/mo/kasse/:id', async (req, res) => {
    const id = String(req.params.id || '');
    if (!/^kas_[a-z0-9]{6,40}$/.test(id)) return res.status(404).json({ error: 'unbekannt' });
    const r = await kasseLesen(id);
    if (!r) return res.status(404).json({ error: 'unbekannt' });
    res.set('cache-control', 'no-store').json({
      id: r.id, status: r.status || 'offen', bestellung: r.bestellung || null, bezahltAm: r.bezahltAm || null,
      designId: r.designId, motto: r.motto, gesamt: r.gesamt, versand: r.versand, verrechnet: r.verrechnet || 0,
      zeilen: (r.zeilen || []).map(z => ({ label: z.label || preise.label(z.garment), stufe: z.stufe, groesse: z.groesse, name: z.name, menge: z.menge, farbeName: z.farbeName, summe: z.summe })),
      // Wer noch nicht bezahlt hat, kommt mit demselben Link zurueck zur Kasse
      url: (r.status || 'offen') === 'offen' ? r.invoiceUrl : null
    });
  });
  app.get('/bestellung/:id', (req, res) => res.set('cache-control', 'no-cache').sendFile(path.resolve('bestellung.html')));

  // ---- Bestellung eingegangen (Shopify-Webhook ueber fulfillment.js) ----
  // Aus dem Entwurf ist eine bezahlte Bestellung geworden: Kasse als bezahlt merken und das
  // verrechnete Guthaben vom Konto abbuchen - genau einmal.
  async function bestellungEingang(order) {
    const attrs = (order && (order.note_attributes || order.noteAttributes)) || [];
    const a = attrs.find(x => x && (x.name === '_kasseId' || x.key === '_kasseId'));
    const id = a ? String(a.value || '') : '';
    if (!/^kas_[a-z0-9]{6,40}$/.test(id)) return null;
    const r = await kasseLesen(id);
    if (!r) { console.error('Kasse: Bestellung ohne Kassen-Eintrag', id, order && order.name); return null; }
    if (r.status === 'bezahlt') return r;
    r.status = 'bezahlt'; r.bestellung = order.name || String(order.id || ''); r.bezahltAm = new Date().toISOString();
    if (r.userId && r.verrechnet > 0 && !r.verrechnungGebucht && accounts) {
      try {
        const u = await accounts.byId(r.userId);
        if (u) {
          u.verrechenbarCent = Math.max(0, Math.round((+u.verrechenbarCent || 0) - r.verrechnet * 100));
          await accounts.save(u);
          r.verrechnungGebucht = true;
        }
      } catch (e) { console.error('Kasse: Verrechnung abbuchen', id, e && e.message ? e.message : e); }
    }
    await kasseSchreiben(r);
    console.log('Kasse bezahlt:', r.bestellung, r.designId, preise.euro(r.gesamt) + (r.verrechnet ? ' · verrechnet ' + preise.euro(r.verrechnet) : ''));
    return r;
  }

  // ---- Backend: Stand der Kasse und Verbindungstest ----
  app.get('/api/admin/kasse', adminGuard, async (req, res) => {
    const st = {
      an: kasseAn(), gruende: gruende(), shop: shopDomain() || null, version: version(),
      zugang: env.SHOPIFY_ADMIN_TOKEN ? 'admin-token' : (env.SHOPIFY_CLIENT_ID && env.SHOPIFY_CLIENT_SECRET ? 'client-credentials' : 'keiner')
    };
    if (shopDomain() && hatZugang()) {
      try {
        const d = await gql('{ shop { name currencyCode taxesIncluded myshopifyDomain } }');
        st.verbindung = 'ok';
        st.shopName = d.shop.name; st.waehrung = d.shop.currencyCode; st.preiseInklSteuer = d.shop.taxesIncluded;
        if (d.shop.taxesIncluded === false) st.warnung = 'In Shopify steht "Preise ohne Steuern" - unsere Preise sind brutto. Unter Einstellungen > Steuern "Alle Preise beinhalten Steuern" einschalten.';
      } catch (e) { st.verbindung = 'fehler'; st.fehler = (e && e.message ? e.message : String(e)).slice(0, 200); }
    }
    let files = []; try { files = (await fs.readdir(DIR)).filter(f => f.endsWith('.json')).sort().reverse().slice(0, 50); } catch (e) { }
    st.letzte = [];
    for (const f of files) { try { const r = JSON.parse(await fs.readFile(path.join(DIR, f), 'utf8')); st.letzte.push({ id: r.id, created: r.created, designId: r.designId, draftName: r.draftName, gesamt: r.gesamt, shopifyGesamt: r.shopifyGesamt, status: r.status || 'offen', bestellung: r.bestellung || null, verrechnet: r.verrechnet || 0 }); } catch (e) { } }
    res.json(st);
  });

  return { kasseAn, gruende, bestellungEingang };
}
