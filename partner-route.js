// partner-route.js - Partner finden, Partner werden, Partnerbereich, der einfache Weg zum Motiv
// =============================================================================================
// Markus, 2. Okt. 2026 (Wortlaut in partner.js). Die Seiten:
//   /partner                 Partner finden (Suche, "in deiner Naehe") und "Partner werden"
//   /partner/werden          Selbst anmelden: Name, Anschrift, E-Mail, Logo, Freigabe
//   /partner/bereich         Der Login-Bereich: Logo, Farbe, Angebot, Stile, QR, Aufsteller
//   /bei/<slug>/machen       Der EINFACHE Weg fuer den Gast: Foto, ein Textfeld, Stil, Start.
//                            Danach uebernimmt die gewohnte Mottoseite (Warten, Ergebnis, Kauf):
//                            die Seite legt die Auftragsnummer dorthin, wo die Mottoseite einen
//                            laufenden Auftrag sucht (localStorage mo_lauf) - kein zweiter Kaufweg.
// APIs unter /api/partner/..., Backend unter /api/admin/partner.
// =============================================================================================

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  SHOP_TEILE, SHOP_STILE, MAX_STILE, KUECHEN, ERKLAERUNG, VEREINBARUNG, LIZENZ_STANDARD, vereinbarungEintrag, DESIGN_SERVICE,
  anmeldungPruefen, einstellungenSauber, angebotSauber, stileSauber, slugVon, motivBeispiel, lieblingsSatz } from './partner.js';
import { einmalCheckout as einmalCheckoutStripe, checkoutSessionLesen } from './billing.js';

const HIER = path.dirname(new URL(import.meta.url).pathname);
const HAUS_DIR = path.join(HIER, 'postkarte', 'haus');

/**
 * Darf dieser Eintrag einen Shop (Artikel mit seinem Logo) haben?
 * Nur mit ausdruecklicher Zustimmung - selbst angemeldet (Erklaerung), im Partnerbereich
 * eingestellt, Lizenz fuer Artikel (EAST26) oder ein Tisch-Tor, das Markus eingerichtet hat
 * (Luigi). Eine Logo-Freigabe allein deckt keinen Verkauf von Shirts
 * (CLAUDE.md, Idee 10: "Fuer Merch braucht die Freigabe einen Satz mehr").
 */
export function shopErlaubt(e) {
  return !!(e && e.freigabe && e.freigabe.datum && (e.partner || e.tisch || (e.lizenz && e.lizenz.artikel)));
}
/** Was steht im Shop? Ohne eigenes Angebot: alles, was der Shop kann. */
export function angebotVon(e) {
  const a = angebotSauber(e && e.angebot ? e.angebot : null);
  if (!shopErlaubt(e)) a.teile = [];
  return a;
}
export function stileVon(e) { return stileSauber(e && e.stile); }

/**
 * Ein Logo aus einem Upload: PNG, auf den Inhalt beschnitten, hoechstens 1600 px, und ein weisser
 * Grund vom Rand her durchsichtig (Flutfuellung, Toleranz 34) - sonst steht das Logo als weisser
 * Kasten auf dem schwarzen Shirt. Weisse Flaechen IM Logo bleiben (sie haengen nicht am Rand).
 */
export async function logoAufbereiten(sharp, buffer) {
  let img = sharp(buffer, { failOn: 'none' }).rotate();
  const meta = await img.metadata();
  if (!meta.width || !meta.height) throw new Error('kein Bild');
  let { data, info } = await img.resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, C = info.channels;
  // Ist der Rand (fast) weiss und deckend? Dann vom Rand her freistellen.
  const hell = (i) => data[i + 3] > 200 && data[i] > 221 && data[i + 1] > 221 && data[i + 2] > 221;
  let randHell = 0, rand = 0;
  for (let x = 0; x < W; x += 3) for (const y of [0, H - 1]) { rand++; if (hell((y * W + x) * C)) randHell++; }
  for (let y = 0; y < H; y += 3) for (const x of [0, W - 1]) { rand++; if (hell((y * W + x) * C)) randHell++; }
  let freigestellt = false;
  if (rand && randHell / rand > 0.8) {
    const besucht = new Uint8Array(W * H);
    const stapel = [];
    for (let x = 0; x < W; x++) { stapel.push(x, (H - 1) * W + x); }
    for (let y = 0; y < H; y++) { stapel.push(y * W, y * W + W - 1); }
    while (stapel.length) {
      const p = stapel.pop();
      if (besucht[p]) continue;
      besucht[p] = 1;
      const i = p * C;
      if (!hell(i)) continue;
      data[i + 3] = 0;
      const x = p % W, y = (p - x) / W;
      if (x > 0) stapel.push(p - 1); if (x < W - 1) stapel.push(p + 1);
      if (y > 0) stapel.push(p - W); if (y < H - 1) stapel.push(p + W);
    }
    freigestellt = true;
  }
  const png = await sharp(data, { raw: { width: W, height: H, channels: C } }).trim({ threshold: 1 }).png({ compressionLevel: 9 }).toBuffer()
    .catch(() => sharp(data, { raw: { width: W, height: H, channels: C } }).png({ compressionLevel: 9 }).toBuffer());
  const m2 = await sharp(png).metadata();
  return { png, freigestellt, breite: m2.width, hoehe: m2.height };
}

export function mountPartner(app, deps) {
  const {
    STORE, env, adminGuard, store, firmenListe, firmenSlug, logoBild, readTpl, escHtml, sharp,
    identify, loginLinkSenden, geocodeRoh, markenPruefen, farbenVonLogo, makeMockup, logoHelle,
    STYLES, preise, einmalCheckout = einmalCheckoutStripe, sessionLesen = checkoutSessionLesen, mailAnUns = async () => false, log = console
  } = deps;
  const kern = (s) => firmenSlug(s).replace(/[-_]/g, '');
  const basis = () => String(env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');
  async function eintragFuer(slug) {
    const s = kern(slug);
    if (!s) return null;
    return (await firmenListe()).find(e => kern(e.firma) === s || (e.namen || []).some(n => kern(n) === s)) || null;
  }
  const istLive = (e) => !!(e && e.freigabe && e.freigabe.datum);
  // Die Hausfarbe: gesetzt im Eintrag, sonst am Logo gemessen (wie die Firmenkarte). Gemerkt je
  // Eintrag und Logo-Datei - Messen kostet ein paar hundert Millisekunden.
  const AKZENT = new Map();
  async function akzentVon(e) {
    if (e.farben && e.farben[0]) return e.farben[0];
    const k = e.firma + '|' + (e.datei || '');
    if (!AKZENT.has(k)) { let f = []; try { f = await farbenVonLogo(e); } catch (err) { f = []; } AKZENT.set(k, (f && f[0]) || '#C03A2B'); }
    return AKZENT.get(k);
  }
  const stilLabel = (id) => (STYLES[id] && (STYLES[id].label || STYLES[id].name)) || id;
  const teilName = (id) => (preise && preise.label ? preise.label(id) : id);
  const teilPreis = (id) => { try { const p = preise.listenpreis(id); return preise.euro ? preise.euro(p) : String(p).replace('.', ',') + ' €'; } catch (e) { return ''; } };

  // ---- Logo-Mockups fuer Partner ohne vorgebaute Bilder (postkarte/haus) ----------------------
  // "So sieht <Name> auf unseren Artikeln aus": das Logo allein auf jedem Teil des Shops, einmal
  // gebaut und auf dem Volume abgelegt (storage/partner/bilder/<slug>-<teil>.jpg).
  async function bilderBauen(e) {
    const slug = firmenSlug(e.firma);
    const png = await logoBild(e, STORE);
    if (!png) return { gebaut: 0, grund: 'kein Logo' };
    await fs.mkdir(store.bilderDir, { recursive: true });
    let hellesLogo = false;
    // Hell oder dunkel nach der MITTE der Logo-Pixel (Median), nicht nach dem hellsten Zehntel: ein
    // gruenes Vereinslogo mit weissem Kreis darin galt sonst als hell und landete auf Schwarz.
    try { hellesLogo = (await logoHelle(png, { perzentil: 0.5 })) > 170; } catch (err) { hellesLogo = false; }
    // Flachware: das Logo mittig auf Papier, damit es nicht als winziger Fleck auf dem Kissen liegt.
    const meta = await sharp(png).metadata();
    const flach = await sharp({ create: { width: 1600, height: 1200, channels: 4, background: hellesLogo ? '#1B1710' : '#F7F1E4' } })
      .composite([{ input: await sharp(png).resize({ width: 1000, height: 640, fit: 'inside' }).png().toBuffer(), gravity: 'centre' }]).png().toBuffer();
    // Textil: das Logo als Brustmotiv - 60 % der Breite, oben auf einer durchsichtigen Flaeche im
    // Verhaeltnis der Vorderseite (36 x 46 cm), sonst fuellte es die ganze Front.
    const brustLogo = await sharp(png).resize({ width: 860, height: 620, fit: 'inside' }).png().toBuffer();
    const bm = await sharp(brustLogo).metadata();
    const brust = await sharp({ create: { width: 1440, height: 1840, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: brustLogo, top: 260, left: Math.round((1440 - bm.width) / 2) }]).png().toBuffer();
    let gebaut = 0;
    for (const t of SHOP_TEILE) {
      try {
        const farbe = t.textil ? (hellesLogo ? 'black' : 'white') : 'white';
        const jpg = await makeMockup(t.textil ? brust : flach, t.id, farbe, false, { place: 'front' });
        await sharp(jpg).resize({ width: 900 }).jpeg({ quality: 84 }).toFile(path.join(store.bilderDir, slug + '-' + t.id + '.jpg'));
        gebaut++;
      } catch (err) { log.error('Partner-Bild:', slug, t.id, err && err.message ? err.message : err); }
    }
    log.log('Partner-Bilder:', slug, '·', gebaut, 'von', SHOP_TEILE.length, '· Logo', meta.width + 'x' + meta.height);
    return { gebaut };
  }
  async function bildPfad(slug, teil) {
    for (const p of [path.join(HAUS_DIR, slug + '-' + teil + '.jpg'), path.join(store.bilderDir, slug + '-' + teil + '.jpg')]) {
      try { await fs.access(p); return p; } catch (e) { /* weiter */ }
    }
    return null;
  }

  // ---- Seiten ---------------------------------------------------------------------------------
  const seite = (datei) => async (req, res) => {
    try { res.set('Cache-Control', 'no-cache').type('html').send(await readTpl(datei)); }
    catch (e) { log.error('Partnerseite:', datei, e && e.message ? e.message : e); res.status(500).end(); }
  };
  app.get('/partner', seite('partner.html'));
  app.get('/partner/werden', seite('partner-werden.html'));
  app.get('/partner/bereich', seite('partner-bereich.html'));
  // Die Partner- und Lizenzvereinbarung, mit den Betreiberangaben aus dem Impressum (Umgebung).
  app.get('/partner/vereinbarung', async (req, res) => {
    const html = (await readTpl('partner-vereinbarung.html'))
      .replace(/__FASSUNG__/g, escHtml(VEREINBARUNG.fassung)).replace(/__STAND__/g, escHtml(VEREINBARUNG.stand))
      .replace(/__PROZENT__/g, escHtml(String(LIZENZ_STANDARD.prozent)))
      .replace(/__DESIGN_PREIS__/g, escHtml(String(DESIGN_SERVICE.nettoCents / 100).replace('.', ',')))
      .replace(/__DESIGN_BRUTTO__/g, escHtml((DESIGN_SERVICE.cents / 100).toFixed(2).replace('.', ',')))
      .replace(/__FIRMA__/g, escHtml(env.IMPRESSUM_FIRMA || 'RASANDO International GmbH'))
      .replace(/__ANSCHRIFT__/g, escHtml(env.IMPRESSUM_ANSCHRIFT || 'Elbuferstraße 134, 21436 Marschacht, Deutschland'))
      .replace(/__VERTRETER__/g, escHtml(env.IMPRESSUM_VERTRETER || 'Denis Zühlke und Michael Oenning (Geschäftsführer)'))
      .replace(/__MAIL__/g, escHtml(env.IMPRESSUM_MAIL || 'otto@motto-otto.de'));
    res.set('Cache-Control', 'no-cache').type('html').send(html);
  });
  app.get('/partner.css', async (req, res) => { res.type('css').set('Cache-Control', 'no-cache').send(await fs.readFile(path.join(HIER, 'partner.css'), 'utf8')); });
  app.get('/bei/:slug/machen', async (req, res) => {
    const e = await eintragFuer(req.params.slug);
    if (!istLive(e)) return res.redirect('/partner');
    const html = (await readTpl('bei-machen.html')).replace(/__SLUG__/g, escHtml(firmenSlug(e.firma))).replace(/__NAME__/g, escHtml(String(e.anzeige || e.firma)));
    res.set('Cache-Control', 'no-cache').type('html').send(html);
  });

  // ---- Partner finden --------------------------------------------------------------------------
  // Nur echte Partner: wer ein Tor hat (Tisch-QR) oder Partner ist - nicht jede Firma mit einer
  // Logo-Freigabe.
  app.get('/api/partner/liste', async (req, res) => {
    const liste = (await firmenListe()).filter(e => istLive(e) && (e.partner || e.tisch));
    res.set('Cache-Control', 'no-cache').json({
      partner: await Promise.all(liste.map(async e => {
        const slug = firmenSlug(e.firma);
        return {
          slug, name: String(e.anzeige || e.firma), ort: String(e.ort || ''), art: e.art || (e.gastro ? 'gastro' : 'betrieb'),
          akzent: await akzentVon(e), logo: '/api/mo/firmenlogo/' + slug + '.png', tor: '/bei/' + slug,
          punkt: Array.isArray(e.punkt) ? e.punkt : null, shop: shopErlaubt(e)
        };
      }))
    });
  });

  // ---- Was der einfache Weg braucht (oeffentlich) ----------------------------------------------
  app.get('/api/partner/:slug/plan', async (req, res) => {
    const e = await eintragFuer(req.params.slug);
    if (!istLive(e)) return res.status(404).json({ error: 'unbekannt' });
    const slug = firmenSlug(e.firma);
    const a = angebotVon(e);
    const teile = [];
    for (const t of SHOP_TEILE) {
      if (!a.teile.includes(t.id)) continue;
      const bild = await bildPfad(slug, t.id);
      teile.push({ id: t.id, artikel: t.artikel, flaeche: t.flaeche, textil: !!t.textil, name: teilName(t.id), preis: teilPreis(t.id), bild: bild ? '/api/mo/bei/' + slug + '/' + t.id + '.jpg' : '' });
    }
    const name = String(e.anzeige || e.firma);
    res.set('Cache-Control', 'no-cache').json({
      slug, name, firma: e.firma, ort: String(e.ort || ''), gastro: !!e.gastro,
      akzent: await akzentVon(e), logo: '/api/mo/firmenlogo/' + slug + '.png',
      punkt: Array.isArray(e.punkt) ? e.punkt : null, adresse: String(e.adresse || ''),
      teile,
      stile: stileVon(e).map(id => ({ id, label: stilLabel(id), kachel: '/api/mo/stil-kachel/' + id + '.jpg' })),
      motivBeispiel: motivBeispiel(e),
      // 5. Okt.: das T-Shirt im Shop ist die schlichte Linie - der Gast kann sie so uebernehmen (nur Spruch, Name, Datum, Sterne).
      linie: { spruch: lieblingsSatz(e), teile: ['tee'] },
      logoUpload: 'fr_' + slug + '.png'
    });
  });

  // ---- Partner werden --------------------------------------------------------------------------
  app.post('/api/partner/anmelden', async (req, res) => {
    const b = req.body || {};
    const vergeben = (await firmenListe()).flatMap(e => [e.firma, e.anzeige, ...(e.namen || [])].filter(Boolean))
      .concat((await store.alle()).flatMap(p => [p.slug, p.anzeige].filter(Boolean)));
    const r = anmeldungPruefen(b, { vergeben });
    if (!r.ok) return res.status(400).json({ error: r.fehler });
    const p = r.eintrag;
    // Das Logo ist Pflicht - ohne Logo gibt es keinen Shop mit Logo.
    const m = String(b.logo || '').match(/^data:image\/(png|jpe?g|webp|svg\+xml);base64,(.+)$/i);
    if (!m) return res.status(400).json({ error: 'Bitte euer Logo hochladen (PNG, JPG, WebP oder SVG).' });
    let logo;
    try { logo = await logoAufbereiten(sharp, Buffer.from(m[2], 'base64')); }
    catch (e) { return res.status(400).json({ error: 'Das Logo konnte nicht gelesen werden. Bitte als PNG oder JPG.' }); }
    if (logo.breite < 120 && logo.hoehe < 120) return res.status(400).json({ error: 'Das Logo ist zu klein (' + logo.breite + ' x ' + logo.hoehe + ' Pixel). Bitte mindestens 300 Pixel breit.' });
    // Wo seid ihr? Ohne Punkt erkennt der Standort euch nicht - der Shop geht trotzdem.
    try {
      const lage = await geocodeRoh(p.adresse + ', ' + p.land);
      if (lage) { p.punkt = lage.punkt; p.punktGenau = !!lage.genau; }
    } catch (e) { log.error('Partner verorten:', p.slug, e && e.message ? e.message : e); }
    p.datei = 'partner-' + p.slug + '.png';
    await fs.mkdir(path.join(STORE, 'firmenlogos'), { recursive: true });
    await fs.writeFile(path.join(STORE, 'firmenlogos', p.datei), logo.png);
    try { const f = await farbenVonLogo({ firma: p.slug, datei: p.datei, farben: [] }); if (!p.farben.length && f && f.length) p.farben = f.slice(0, 3); }
    catch (e) { log.error('Partner-Farben:', p.slug, e && e.message ? e.message : e); }
    p.erstellt = new Date().toISOString();
    p.logoFreigestellt = logo.freigestellt;
    // Markensperre: ein geschuetzter Name geht nicht von allein live.
    const marke = markenPruefen([p.anzeige, p.firma]);
    if (marke) { p.markenTreffer = marke.wort; }
    await store.speichern(p);
    let gesendet = false;
    try { gesendet = await loginLinkSenden(p.email, '/partner/bereich?neu=' + p.slug); }
    catch (e) { log.error('Partner-Anmeldelink:', p.slug, e && e.message ? e.message : e); }
    log.log('Partner angemeldet:', p.slug, '·', p.anzeige, '·', p.ort, '·', p.punkt ? 'verortet' : 'NICHT verortet', '· Logo', logo.breite + 'x' + logo.hoehe, logo.freigestellt ? '(freigestellt)' : '', marke ? '· MARKE ' + marke.wort : '');
    res.json({ ok: true, slug: p.slug, gesendet, verortet: !!p.punkt });
  });

  // ---- Der Partnerbereich (angemeldet) ---------------------------------------------------------
  async function meinePartner(req, res) {
    const who = await identify(req, res);
    if (!who.user) return { who, liste: [] };
    const liste = await store.vonEmail(who.user.email);
    // Erster Login = E-Mail bestaetigt: jetzt geht der Partner live (oder in die Pruefung).
    for (const p of liste) {
      if (p.status !== 'bestaetigen') continue;
      p.status = p.markenTreffer ? 'pruefen' : 'aktiv';
      if (p.status === 'aktiv') p.aktivSeit = new Date().toISOString();
      await store.speichern(p);
      log.log('Partner bestaetigt:', p.slug, '->', p.status);
      if (p.status === 'aktiv') setTimeout(async () => { const e = await eintragFuer(p.slug); if (e) bilderBauen(e).catch(err => log.error('Partner-Bilder:', p.slug, err && err.message ? err.message : err)); }, 200);
    }
    return { who, liste };
  }
  async function ansicht(p) {
    const e = p.basis ? await eintragFuer(p.basis) : (p.status === 'aktiv' ? await eintragFuer(p.slug) : null);
    const slug = e ? firmenSlug(e.firma) : p.slug;
    const a = e ? angebotVon(e) : angebotSauber(p.angebot);
    return {
      slug, status: p.basis ? 'aktiv' : p.status, name: String((e && e.anzeige) || p.anzeige || (e && e.firma) || p.slug),
      firma: (e && e.firma) || p.firma, ort: (e && e.ort) || p.ort || '', adresse: (e && e.adresse) || p.adresse || '',
      verortet: !!((e && Array.isArray(e.punkt)) || p.punkt), webseite: (e && e.webseite) || p.webseite || '',
      gastro: !!((e && e.gastro) || p.gastro), kueche: (e && e.kueche) || p.kueche || '',
      farbe: e ? await akzentVon(e) : ((p.farben && p.farben[0]) || ''),
      logo: '/api/partner/' + p.slug + '/logo.png?v=' + encodeURIComponent(p.geaendert || ''),
      angebot: a, stile: stileSauber((e && e.stile) || p.stile), shop: e ? shopErlaubt(e) : true,
      tor: '/bei/' + slug, qr: '/api/mo/bei/' + slug + '/qr.png', aufsteller: '/bei/' + slug + '/aufsteller',
      // Bestaetigt in der aktuellen Fassung? Sonst zeigt der Bereich die Vereinbarung zum Bestaetigen.
      vereinbarung: !!(p.vereinbarung && p.vereinbarung.fassung === VEREINBARUNG.fassung),
      designService: p.designService ? { status: p.designService.status, wunsch: p.designService.wunsch || '', seit: p.designService.erstellt || '' } : null,
      lizenzProzent: ((e && e.lizenz) || p.lizenz || {}).prozent || 0
    };
  }
  async function meiner(req, res) {
    const { who, liste } = await meinePartner(req, res);
    if (!who.user) { res.status(401).json({ error: 'anmelden' }); return null; }
    const p = liste.find(x => x.slug === slugVon(req.params.slug));
    if (!p) { res.status(403).json({ error: 'nicht dein Partner' }); return null; }
    return p;
  }

  app.get('/api/partner/ich', async (req, res) => {
    const { who, liste } = await meinePartner(req, res);
    res.set('Cache-Control', 'no-store').json({
      angemeldet: !!who.user, email: who.user ? who.user.email : '',
      partner: await Promise.all(liste.map(ansicht)),
      optionen: {
        stile: SHOP_STILE.map(id => ({ id, label: stilLabel(id), kachel: '/api/mo/stil-kachel/' + id + '.jpg' })), maxStile: MAX_STILE,
        teile: SHOP_TEILE.map(t => ({ id: t.id, name: teilName(t.id), preis: teilPreis(t.id) })),
        kuechen: KUECHEN
      }
    });
  });

  app.post('/api/partner/:slug/einstellungen', async (req, res) => {
    const p = await meiner(req, res); if (!p) return;
    const s = einstellungenSauber(req.body || {});
    Object.assign(p, s);
    if (s.farben) p.farbeGesetzt = s.farben.length > 0;
    await store.speichern(p);
    log.log('Partner-Einstellungen:', p.slug, '·', Object.keys(s).join(', '));
    const e = p.basis ? await eintragFuer(p.basis) : await eintragFuer(p.slug);
    res.json({ ok: true, partner: await ansicht(p), live: istLive(e) });
  });

  // Ein Partner, der die Vereinbarung noch nicht (oder nur in einer alten Fassung) bestaetigt hat -
  // EAST26 und Luigi kamen vor ihr -, bestaetigt sie hier einmal. Eine Lizenz aus dem Repo bleibt.
  app.post('/api/partner/:slug/vereinbarung', async (req, res) => {
    const p = await meiner(req, res); if (!p) return;
    if ((req.body || {}).bestaetigt !== true) return res.status(400).json({ error: 'Bitte die Vereinbarung bestaetigen.' });
    const v = vereinbarungEintrag();
    p.vereinbarung = v.vereinbarung;
    if (!p.lizenz) p.lizenz = v.lizenz;
    await store.speichern(p);
    log.log('Partner-Vereinbarung bestaetigt:', p.slug, '· Fassung', VEREINBARUNG.fassung);
    res.json({ ok: true, partner: await ansicht(p) });
  });

  // ---- Design-Service: 99 Euro, wir machen die Wunsch-Designs fertig ------------------------------
  // Mit Stripe: Checkout, Rueckkehr in den Partnerbereich, dort wird die Zahlung nachgeschlagen.
  // Ohne Stripe-Schluessel: der Auftrag wird als Anfrage aufgenommen und an uns gemeldet - bezahlt
  // wird dann per Rechnung. Beides landet als Mail bei uns (mailAnUns) und im Eintrag (designService).
  async function designServiceMelden(p, betreff) {
    const ds = p.designService || {};
    const html = '<p><b>' + escHtml(betreff) + '</b></p><p>Partner: ' + escHtml(p.anzeige || p.basis || p.slug) + ' (' + escHtml(p.slug) + ')<br>E-Mail: '
      + escHtml((p.emails || []).join(', ')) + '<br>Status: ' + escHtml(ds.status || '') + '</p><p>Wunsch:</p><p style="white-space:pre-wrap">' + escHtml(ds.wunsch || '(nichts eingetragen)') + '</p>'
      + '<p>Shop: ' + escHtml(basis() + '/bei/' + p.slug) + '</p>';
    try { await mailAnUns(betreff + ': ' + (p.anzeige || p.basis || p.slug), html); } catch (e) { log.error('Design-Service melden:', p.slug, e && e.message ? e.message : e); }
  }
  app.post('/api/partner/:slug/designservice', async (req, res) => {
    const p = await meiner(req, res); if (!p) return;
    const wunsch = String((req.body || {}).wunsch || '').replace(/[\u0000-\u0008<>]/g, ' ').trim().slice(0, 2000);
    if (wunsch.length < 5) return res.status(400).json({ error: 'Bitte kurz beschreiben, was du dir wuenschst.' });
    if (p.designService && p.designService.status === 'bezahlt') return res.status(400).json({ error: 'Der Design-Service ist schon beauftragt und bezahlt.' });
    const jetzt = new Date().toISOString();
    if (!einmalCheckout || !env.STRIPE_SECRET_KEY) {
      p.designService = { status: 'angefragt', wunsch, erstellt: jetzt, cents: DESIGN_SERVICE.cents };
      await store.speichern(p);
      await designServiceMelden(p, 'Design-Service angefragt (ohne Online-Zahlung)');
      log.log('Design-Service angefragt:', p.slug, '· ohne Stripe');
      return res.json({ ok: true, ohneZahlung: true, partner: await ansicht(p) });
    }
    try {
      const c = await einmalCheckout({
        secretKey: env.STRIPE_SECRET_KEY, betragCents: DESIGN_SERVICE.cents, name: DESIGN_SERVICE.name,
        beschreibung: 'Motto Otto gestaltet die Wunsch-Designs fuer deinen Shop.', email: (p.emails || [])[0] || '',
        successUrl: basis() + '/partner/bereich?designservice={CHECKOUT_SESSION_ID}', cancelUrl: basis() + '/partner/bereich?designservice=abgebrochen',
        metadata: { motto_otto: 'designservice', partner: p.slug }
      });
      p.designService = { status: 'offen', wunsch, erstellt: jetzt, session: c.session, cents: DESIGN_SERVICE.cents };
      await store.speichern(p);
      log.log('Design-Service Checkout:', p.slug);
      res.json({ ok: true, url: c.url });
    } catch (e) { log.error('Design-Service Checkout:', p.slug, e && e.message ? e.message : e); res.status(502).json({ error: 'Die Zahlung konnte gerade nicht gestartet werden. Bitte gleich noch einmal.' }); }
  });
  app.post('/api/partner/:slug/designservice/pruefen', async (req, res) => {
    const p = await meiner(req, res); if (!p) return;
    const ds = p.designService;
    if (!ds || !ds.session || ds.session !== String((req.body || {}).session || '')) return res.status(400).json({ error: 'unbekannt' });
    if (ds.status === 'bezahlt') return res.json({ ok: true, bezahlt: true, partner: await ansicht(p) });
    try {
      const r = await sessionLesen({ secretKey: env.STRIPE_SECRET_KEY, account: '', session: ds.session });
      if (!r.bezahlt) return res.json({ ok: true, bezahlt: false, partner: await ansicht(p) });
      ds.status = 'bezahlt'; ds.bezahlt = new Date().toISOString();
      await store.speichern(p);
      await designServiceMelden(p, 'Design-Service bezahlt (99 Euro zzgl. MwSt.)');
      log.log('Design-Service bezahlt:', p.slug);
      res.json({ ok: true, bezahlt: true, partner: await ansicht(p) });
    } catch (e) { log.error('Design-Service pruefen:', p.slug, e && e.message ? e.message : e); res.status(502).json({ error: 'Die Zahlung konnte gerade nicht geprueft werden.' }); }
  });

  app.post('/api/partner/:slug/logo', async (req, res) => {
    const p = await meiner(req, res); if (!p) return;
    const m = String((req.body || {}).logo || '').match(/^data:image\/(png|jpe?g|webp|svg\+xml);base64,(.+)$/i);
    if (!m) return res.status(400).json({ error: 'Bitte ein Bild waehlen (PNG, JPG, WebP oder SVG).' });
    let logo;
    try { logo = await logoAufbereiten(sharp, Buffer.from(m[2], 'base64')); }
    catch (e) { return res.status(400).json({ error: 'Das Logo konnte nicht gelesen werden.' }); }
    if (logo.breite < 120 && logo.hoehe < 120) return res.status(400).json({ error: 'Das Logo ist zu klein. Bitte mindestens 300 Pixel breit.' });
    p.datei = 'partner-' + p.slug + '.png';
    await fs.mkdir(path.join(STORE, 'firmenlogos'), { recursive: true });
    await fs.writeFile(path.join(STORE, 'firmenlogos', p.datei), logo.png);
    // Das Haus-Logo fuer Artikel (uploads/fr_<slug>.png) ist eine Kopie - die alte muss weg.
    const e = p.basis ? await eintragFuer(p.basis) : await eintragFuer(p.slug);
    if (e) { try { await fs.rm(path.join(STORE, 'uploads', 'fr_' + firmenSlug(e.firma) + '.png'), { force: true }); } catch (err) { /* keine Kopie */ } }
    try { const f = await farbenVonLogo({ firma: p.slug, datei: p.datei, farben: [] }); if (f && f.length && !(p.farbeGesetzt)) p.farben = f.slice(0, 3); }
    catch (err) { log.error('Partner-Farben:', p.slug, err && err.message ? err.message : err); }
    await store.speichern(p);
    log.log('Partner-Logo:', p.slug, '·', logo.breite + 'x' + logo.hoehe, logo.freigestellt ? '(freigestellt)' : '');
    if (e && !p.basis) bilderBauen(e).catch(err => log.error('Partner-Bilder:', p.slug, err && err.message ? err.message : err));
    res.json({ ok: true, partner: await ansicht(p), freigestellt: logo.freigestellt });
  });

  // Das Logo fuer den Partnerbereich - auch, solange der Partner noch nicht live ist.
  app.get('/api/partner/:slug/logo.png', async (req, res) => {
    const p = await store.lesen(req.params.slug);
    const e = p && p.basis ? await eintragFuer(p.basis) : null;
    const png = e ? await logoBild(e, STORE) : (p && p.datei ? await fs.readFile(path.join(STORE, 'firmenlogos', p.datei)).catch(() => null) : null);
    if (!png) return res.status(404).end();
    res.type('png').set('Cache-Control', 'no-cache').send(png);
  });

  // ---- Backend ---------------------------------------------------------------------------------
  // Alle Partner (auch die noch nicht bestaetigten), und: einem Partner aus dem Repo (EAST26,
  // Luigi) einen Zugang geben - POST /api/admin/partner/<slug> {"email":"..."}.
  app.get('/api/admin/partner', adminGuard, async (req, res) => { res.json({ partner: await store.alle() }); });
  app.post('/api/admin/partner/:slug', adminGuard, async (req, res) => {
    const b = req.body || {};
    let p = await store.lesen(req.params.slug);
    if (!p) {
      const e = await eintragFuer(req.params.slug);
      if (!e) return res.status(404).json({ error: 'unbekannt' });
      p = { slug: firmenSlug(e.firma).replace(/[-_]/g, ''), basis: e.firma, emails: [], erstellt: new Date().toISOString(), quelle: 'repo' };
    }
    const m = String(b.email || '').trim().toLowerCase();
    if (m && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(m) && !(p.emails || []).includes(m)) p.emails = [...(p.emails || []), m];
    if (['aktiv', 'aus', 'pruefen'].includes(String(b.status)) && !p.basis) { p.status = String(b.status); if (p.status === 'aktiv' && !p.aktivSeit) p.aktivSeit = new Date().toISOString(); }
    if (b.status === 'aus' && p.basis) p.status = 'aus';
    if (['erledigt', 'bezahlt', 'angefragt'].includes(String(b.designService)) && p.designService) { p.designService.status = String(b.designService); if (b.designService === 'erledigt') p.designService.erledigt = new Date().toISOString(); }
    await store.speichern(p);
    if (m && b.einladen !== false) { try { await loginLinkSenden(m, '/partner/bereich'); } catch (e) { log.error('Partner-Einladung:', p.slug, e && e.message ? e.message : e); } }
    res.json({ ok: true, partner: p });
  });
  app.post('/api/admin/partner/:slug/bilder', adminGuard, async (req, res) => {
    const e = await eintragFuer(req.params.slug);
    if (!e) return res.status(404).json({ error: 'unbekannt' });
    try { res.json({ ok: true, ...(await bilderBauen(e)) }); } catch (err) { res.status(500).json({ error: err.message }); }
  });

  return { bilderBauen, bildPfad, eintragFuer };
}

export { ERKLAERUNG };
