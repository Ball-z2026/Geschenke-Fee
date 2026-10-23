import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { PLANS } from './accounts.js';

// Stripe ohne SDK: Formular-kodierte Aufrufe an die REST-API.
// Beim ersten Start mit STRIPE_SECRET_KEY werden Produkte, Preise und der Webhook selbst angelegt
// und in storage/stripe.json gemerkt - im Stripe-Dashboard muss nichts von Hand eingerichtet werden.

function form(obj, prefix) {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) v.forEach((x, i) => out.push(typeof x === 'object' ? form(x, `${key}[${i}]`) : `${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(x)}`));
    else if (typeof v === 'object') out.push(form(v, key));
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
  }
  return out.join('&');
}

// 30. Sept.: Mit "account" laufen die Aufrufe im Namen eines verbundenen Kontos (Stripe Connect,
// Kopfzeile Stripe-Account) - so entstehen Direct Charges auf dem Konto des Betriebs.
export function stripeClient(secretKey, { account = '' } = {}) {
  async function call(method, endpoint, body) {
    const r = await fetch('https://api.stripe.com/v1' + endpoint, {
      method,
      headers: { authorization: 'Bearer ' + secretKey, 'content-type': 'application/x-www-form-urlencoded', ...(account ? { 'Stripe-Account': account } : {}) },
      body: body ? form(body) : undefined,
      signal: AbortSignal.timeout(20000)
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('Stripe ' + r.status + ': ' + (j.error && j.error.message ? j.error.message : endpoint));
    return j;
  }
  return { get: (e) => call('GET', e), post: (e, b) => call('POST', e, b) };
}

// Produkte/Preise/Webhook anlegen oder aus der Ablage lesen
export async function setupStripe({ secretKey, storeDir, baseUrl }) {
  if (!secretKey) return null;
  const file = path.join(storeDir, 'stripe.json');
  let cfg = null;
  try { cfg = JSON.parse(await fs.readFile(file, 'utf8')); } catch (e) { cfg = null; }
  const live = secretKey.startsWith('sk_live_');
  if (cfg && cfg.live === live && cfg.baseUrl === baseUrl && cfg.prices && cfg.webhookSecret) return cfg;

  const s = stripeClient(secretKey);
  cfg = { live, baseUrl, prices: {}, webhookId: null, webhookSecret: null };

  const mk = async (key, name, cents, recurring) => {
    const product = await s.post('/products', { name, metadata: { motto_otto: key } });
    const price = await s.post('/prices', {
      product: product.id, currency: 'eur', unit_amount: cents,
      ...(recurring ? { recurring: { interval: 'month' } } : {}),
      metadata: { motto_otto: key }
    });
    cfg.prices[key] = price.id;
  };
  await mk('single', 'Motto Otto – Einzeldesign', PLANS.single.cents, false);
  await mk('m100', `Motto Otto – ${PLANS.m100.label} (${PLANS.m100.designs} Designs im Monat)`, PLANS.m100.cents, true);
  await mk('m400', `Motto Otto – ${PLANS.m400.label} (${PLANS.m400.designs} Designs im Monat)`, PLANS.m400.cents, true);

  const wh = await s.post('/webhook_endpoints', {
    url: baseUrl + '/api/mo/stripe/webhook',
    enabled_events: ['checkout.session.completed', 'invoice.paid', 'customer.subscription.deleted', 'customer.subscription.updated'],
    description: 'Motto Otto'
  });
  cfg.webhookId = wh.id;
  cfg.webhookSecret = wh.secret;

  await fs.writeFile(file, JSON.stringify(cfg, null, 2));
  console.log('Stripe eingerichtet:', live ? 'LIVE' : 'Test', Object.keys(cfg.prices).join(','));
  return cfg;
}

// Checkout-Sitzung: kind = 'single' (mit Menge) | 'm100' | 'm400'
export async function createCheckout({ secretKey, cfg, user, kind, quantity, baseUrl }) {
  const s = stripeClient(secretKey);
  const price = cfg.prices[kind];
  if (!price) throw new Error('unbekanntes Angebot');
  const isSub = kind !== 'single';
  const qty = isSub ? 1 : Math.min(Math.max(+quantity || 1, 1), 50);
  const body = {
    mode: isSub ? 'subscription' : 'payment',
    line_items: [{ price, quantity: qty }],
    success_url: baseUrl + '/konto?bezahlt=1',
    cancel_url: baseUrl + '/konto?abgebrochen=1',
    client_reference_id: user.id,
    metadata: { user: user.id, kind, quantity: qty },
    locale: 'de',
    allow_promotion_codes: true
  };
  if (user.stripeCustomer) body.customer = user.stripeCustomer;
  else body.customer_email = user.email;
  if (isSub) body.subscription_data = { metadata: { user: user.id, kind } };
  const session = await s.post('/checkout/sessions', body);
  return session.url;
}

// ---------------------------------------------------------------------------------------------
// Stripe Connect: ein verbundenes Konto je Partner - darauf geht die Lizenz fuer verkaufte
// Artikel mit seinem Logo (connectUeberweisung, lizenzen.js).
// ---------------------------------------------------------------------------------------------

/** Ein verbundenes Konto (Express) fuer einen Betrieb anlegen und den Einrichtungs-Link holen. */
export async function connectKontoAnlegen({ secretKey, email = '', name = '', baseUrl, zurueck = '' }) {
  const s = stripeClient(secretKey);
  const acct = await s.post('/accounts', {
    type: 'express', country: 'DE', ...(email ? { email } : {}),
    capabilities: { card_payments: { requested: 'true' }, transfers: { requested: 'true' } },
    business_profile: { name: String(name || '').slice(0, 100) },
    metadata: { motto_otto: 'partner' }
  });
  const link = await connectEinrichtungsLink({ secretKey, account: acct.id, baseUrl, zurueck });
  return { account: acct.id, url: link };
}

/** Der Einrichtungs-Link (Stripe-gehostetes Onboarding) - gilt kurz, kann jederzeit neu geholt werden. */
export async function connectEinrichtungsLink({ secretKey, account, baseUrl, zurueck = '' }) {
  const s = stripeClient(secretKey);
  const l = await s.post('/account_links', {
    account, type: 'account_onboarding',
    refresh_url: baseUrl + (zurueck || '/admin') + '?stripe=erneut',
    return_url: baseUrl + (zurueck || '/admin') + '?stripe=fertig'
  });
  return l.url;
}

/** Kann das Konto schon Zahlungen annehmen? */
export async function connectKontoStand({ secretKey, account }) {
  const s = stripeClient(secretKey);
  const a = await s.get('/accounts/' + encodeURIComponent(account));
  return { account: a.id, zahlungen: !!a.charges_enabled, auszahlungen: !!a.payouts_enabled, fertig: !!a.details_submitted };
}

/**
 * 1. Okt., Lizenz (Markus: "ueber Stripe direkt ausgezahlt - die 20 % an den Gastronom"):
 * ein Transfer von unserem Stripe-Guthaben auf das Connect-Konto des Betriebs. Das Geld der
 * Artikel-Bestellung kommt ueber den Shop zu uns; die Lizenz geht von hier aus weiter.
 * transfer_group bindet die Ueberweisung an die Bestellung (im Stripe-Dashboard sichtbar).
 */
export async function connectUeberweisung({ secretKey, account, betragCents, waehrung = 'eur', gruppe = '', beschreibung = '', metadata = {} }) {
  const s = stripeClient(secretKey);
  return s.post('/transfers', { amount: betragCents, currency: waehrung, destination: account, transfer_group: gruppe || undefined, description: beschreibung.slice(0, 200), metadata });
}

/**
 * 2. Okt., Markus: "eine Design-Gebuehr ... wenn der Kunde das nicht selber hinbekommt, dass wir fuer
 * 99 Euro ihm alle Wunsch-Designs fertig machen." Eine einfache Einmalzahlung an UNS (kein Connect-
 * Konto, keine Provision). Nachgeschlagen wird mit checkoutSessionLesen ohne account.
 */
export async function einmalCheckout({ secretKey, betragCents, name, beschreibung = '', successUrl, cancelUrl, metadata = {}, email = '' }) {
  const s = stripeClient(secretKey);
  const body = {
    mode: 'payment',
    line_items: [{ quantity: 1, price_data: { currency: 'eur', unit_amount: betragCents, product_data: { name: String(name).slice(0, 120), description: String(beschreibung).slice(0, 300) || undefined } } }],
    success_url: successUrl, cancel_url: cancelUrl, metadata, locale: 'de',
    payment_intent_data: { description: String(name).slice(0, 120), metadata }
  };
  if (email) body.customer_email = email;
  const session = await s.post('/checkout/sessions', body);
  return { session: session.id, url: session.url };
}

/** Eine Checkout-Sitzung nachschlagen (mit account: auf dem verbundenen Konto): bezahlt oder nicht. */
export async function checkoutSessionLesen({ secretKey, account, session }) {
  const s = stripeClient(secretKey, { account });
  const j = await s.get('/checkout/sessions/' + encodeURIComponent(session));
  return { bezahlt: j.payment_status === 'paid', status: j.status, paymentIntent: j.payment_intent || null, email: (j.customer_details && j.customer_details.email) || '' };
}

// Kundenportal (Abo kuendigen, Rechnungen)
export async function createPortal({ secretKey, user, baseUrl }) {
  if (!user.stripeCustomer) return null;
  const s = stripeClient(secretKey);
  const p = await s.post('/billing_portal/sessions', { customer: user.stripeCustomer, return_url: baseUrl + '/konto' });
  return p.url;
}

// Webhook-Signatur pruefen (Stripe-Signature: t=..,v1=..)
export function verifyWebhook(rawBody, header, secret) {
  const parts = Object.fromEntries(String(header || '').split(',').map(p => p.split('=')));
  if (!parts.t || !parts.v1) return null;
  if (Math.abs(Date.now() / 1000 - +parts.t) > 600) return null;
  const expect = crypto.createHmac('sha256', secret).update(`${parts.t}.${rawBody}`).digest('hex');
  const a = Buffer.from(expect), b = Buffer.from(String(parts.v1));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { return JSON.parse(rawBody); } catch (e) { return null; }
}

// Ereignis auf das Konto anwenden. Gibt den geaenderten Nutzer zurueck oder null.
export async function applyEvent(event, accounts, secretKey) {
  const s = stripeClient(secretKey);
  const type = event.type;
  const obj = event.data && event.data.object ? event.data.object : {};

  if (type === 'checkout.session.completed') {
    const userId = obj.client_reference_id || (obj.metadata && obj.metadata.user);
    const user = await accounts.byId(userId);
    if (!user) return null;
    if (obj.customer) user.stripeCustomer = obj.customer;
    const kind = obj.metadata && obj.metadata.kind;
    if (obj.mode === 'payment' && kind === 'single') {
      const anzahl = Math.max(1, +(obj.metadata.quantity || 1));
      user.credits += anzahl;
      // 6. Okt.: "jeder danach kostet 1 € – und dieser Euro geht beim Textilkauf wieder ab" - das Versprechen auf
      // der Seite. Der bezahlte Betrag wird gutgeschrieben und an der Kasse auf Textil verrechnet (shopify-kasse.js).
      user.verrechenbarCent = Math.max(0, Math.round(+user.verrechenbarCent || 0)) + anzahl * PLANS.single.cents;
    } else if (obj.mode === 'subscription' && PLANS[kind]) {
      user.plan = kind; user.planUsed = 0; user.stripeSub = obj.subscription;
      user.planPeriodEnd = Date.now() + 32 * 86400e3; // wird durch invoice.paid genau gesetzt
    }
    return accounts.save(user);
  }

  if (type === 'invoice.paid') {
    const subId = obj.subscription;
    if (!subId) return null;
    const sub = await s.get('/subscriptions/' + subId);
    const userId = sub.metadata && sub.metadata.user;
    const user = await accounts.byId(userId);
    if (!user) return null;
    const kind = sub.metadata && sub.metadata.kind;
    if (PLANS[kind]) user.plan = kind;
    user.stripeSub = subId;
    if (obj.customer) user.stripeCustomer = obj.customer;
    // Neue Periode: Zaehler zuruecksetzen (nur wenn es wirklich eine neue Periode ist)
    const end = (sub.current_period_end || 0) * 1000;
    if (end && end !== user.planPeriodEnd) { user.planUsed = 0; user.planPeriodEnd = end; }
    return accounts.save(user);
  }

  if (type === 'customer.subscription.deleted') {
    const userId = obj.metadata && obj.metadata.user;
    const user = await accounts.byId(userId);
    if (!user) return null;
    user.plan = null; user.planUsed = 0; user.planPeriodEnd = 0; user.stripeSub = null;
    return accounts.save(user);
  }

  if (type === 'customer.subscription.updated') {
    const userId = obj.metadata && obj.metadata.user;
    const user = await accounts.byId(userId);
    if (!user) return null;
    if (obj.status === 'canceled' || obj.status === 'unpaid') { user.plan = null; user.planPeriodEnd = 0; }
    else if (obj.current_period_end) user.planPeriodEnd = obj.current_period_end * 1000;
    return accounts.save(user);
  }
  return null;
}
