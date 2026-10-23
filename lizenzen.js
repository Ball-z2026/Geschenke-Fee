// lizenzen.js - die Lizenz des Hauses: 20 % je Artikel, per Stripe an den Betrieb ueberwiesen
// =============================================================================================
// Markus, 1. Okt. 2026: "Baue das mit den Lizenzen, so dass es ueber Stripe nachher direkt
// ausgezahlt wird - ... die 20 % an den Gastronom oder wer auch immer mitmacht."
//
// ARTIKEL (Shirt, Tasse, Poster ...): der Kunde zahlt UNS (Shop), und der Betrieb bekommt seine
// Lizenz - prozent (EAST26: 20 %) vom NETTO-Verkaufspreis der Artikel mit seinem Design - als
// Stripe-TRANSFER von unserem Guthaben auf sein Connect-Konto.
//
// Ablage: <store>/lizenzen/<bestellung>__<design>.json - ein Satz je Bestellzeile mit Lizenz:
// offen (noch nicht ueberwiesen) -> ueberwiesen | fehlgeschlagen | ohne_konto (der Betrieb hat
// noch kein Stripe-Konto; nachholen() versucht es stuendlich wieder).
// =============================================================================================

import fs from 'node:fs/promises';
import path from 'node:path';
import preise from './preise.cjs';
import { connectUeberweisung } from './billing.js';

function ordner(store) { return path.join(store, 'lizenzen'); }
function datei(store, id) { return path.join(ordner(store), String(id).replace(/[^A-Za-z0-9_-]/g, '') + '.json'); }

/** Die Lizenz in Cent: prozent vom Netto (Brutto ohne MwSt), auf den Cent gerundet. */
export function faellig({ bruttoCents, prozent, mwst = preise.MWST }) {
  const netto = Math.round((+bruttoCents || 0) / (1 + (+mwst || 0)));
  return Math.max(0, Math.round(netto * (+prozent || 0) / 100));
}

/** Design-Nummer einer Shopify-Bestellzeile: _designId in den properties oder die SKU MO-<id>__... */
export function designAusZeile(li) {
  const props = {};
  (li.properties || []).forEach(p => { if (p && p.name != null) props[String(p.name).replace(/^_/, '').toLowerCase()] = p.value; });
  let id = props.designid || props.design || '';
  if (!id && li.sku && /__/.test(li.sku)) id = String(li.sku).split('__')[0].replace(/^MO-/i, '');
  return String(id || '').replace(/[^A-Za-z0-9_-]/g, '');
}

export async function lesen(store, id) {
  try { return JSON.parse(await fs.readFile(datei(store, id), 'utf8')); } catch (e) { return null; }
}
export async function speichern(store, l) {
  await fs.mkdir(ordner(store), { recursive: true });
  await fs.writeFile(datei(store, l.id), JSON.stringify(l, null, 2));
  return l;
}
export async function liste(store, { firmaSlug = '', status = '' } = {}) {
  let namen = [];
  try { namen = await fs.readdir(ordner(store)); } catch (e) { return []; }
  const raus = [];
  for (const n of namen) {
    if (!n.endsWith('.json')) continue;
    try {
      const l = JSON.parse(await fs.readFile(path.join(ordner(store), n), 'utf8'));
      if (firmaSlug && l.firmaSlug !== firmaSlug) continue;
      if (status && l.status !== status) continue;
      raus.push(l);
    } catch (e) { /* kaputte Datei ueberspringen */ }
  }
  raus.sort((a, b) => String(b.angelegt).localeCompare(String(a.angelegt)));
  return raus;
}

/**
 * Eine Bestellung ansehen: jede Zeile mit einem Design, an dem eine Lizenz haengt, wird ein
 * Lizenz-Satz. Dann wird ueberwiesen, wenn der Betrieb ein Stripe-Konto hat und der Schluessel
 * da ist - sonst bleibt der Satz offen und nachholen() kommt wieder.
 */
export async function beiBestellung(store, order, { readJob, kontoFuer, secretKey = '', firmenSlug, log = console } = {}) {
  const orderId = String(order.id || order.name || '').replace(/[^A-Za-z0-9_-]/g, '');
  if (!orderId) return [];
  const raus = [];
  for (const li of (order.line_items || [])) {
    const designId = designAusZeile(li);
    if (!designId) continue;
    const job = await readJob(designId).catch(() => null);
    const liz = job && job.firma && job.firma.lizenz;
    if (!liz || !(+liz.prozent > 0)) continue;
    const id = orderId + '__' + designId;
    if (await lesen(store, id)) continue;                       // Shopify schickt Webhooks doppelt
    const qty = Math.max(1, +li.quantity || 1);
    const bruttoCents = Math.round((+li.price || 0) * 100) * qty - Math.round((+(li.total_discount || 0)) * 100);
    const l = {
      id, orderId, bestellung: order.name || orderId, designId, firma: job.firma.name, firmaSlug: firmenSlug(job.firma.name),
      artikel: String(li.sku || li.title || '').slice(0, 80), menge: qty, bruttoCents, prozent: +liz.prozent,
      betragCents: faellig({ bruttoCents, prozent: +liz.prozent }), waehrung: String(order.currency || 'EUR').toLowerCase(),
      status: 'offen', angelegt: new Date().toISOString(), stripe: null, fehler: ''
    };
    await speichern(store, l);
    log.log('Lizenz faellig:', l.bestellung, '·', l.firma, '·', l.prozent + ' % von', (bruttoCents / 100).toFixed(2), 'EUR brutto ->', (l.betragCents / 100).toFixed(2), 'EUR');
    raus.push(await ueberweisen(store, l.id, { kontoFuer, secretKey, log }));
  }
  return raus;
}

/** Die Ueberweisung selbst - idempotent, der Satz haelt das Ergebnis fest. */
export async function ueberweisen(store, id, { kontoFuer, secretKey = '', log = console } = {}) {
  const l = await lesen(store, id);
  if (!l) throw new Error('Lizenz unbekannt');
  if (l.status === 'ueberwiesen') return l;
  if (!(l.betragCents > 0)) { l.status = 'ueberwiesen'; l.stripe = { transfer: null, hinweis: '0 EUR' }; return speichern(store, l); }
  const konto = kontoFuer ? await kontoFuer(l.firma) : '';
  l.versucht = new Date().toISOString();
  if (!konto) { l.status = 'ohne_konto'; l.fehler = 'Der Betrieb hat noch kein Stripe-Konto'; return speichern(store, l); }
  if (!secretKey) { l.status = 'offen'; l.fehler = 'STRIPE_SECRET_KEY fehlt'; return speichern(store, l); }
  try {
    const t = await connectUeberweisung({
      secretKey, account: konto, betragCents: l.betragCents, waehrung: l.waehrung || 'eur',
      gruppe: 'lizenz-' + l.orderId, beschreibung: 'Lizenz ' + l.prozent + ' % · Bestellung ' + l.bestellung + ' · ' + l.firma,
      metadata: { motto_otto: 'lizenz', bestellung: l.bestellung, design: l.designId, firma: l.firma }
    });
    l.status = 'ueberwiesen'; l.fehler = ''; l.stripe = { transfer: t.id, konto, am: new Date().toISOString() };
    log.log('Lizenz ueberwiesen:', l.bestellung, '·', l.firma, '·', (l.betragCents / 100).toFixed(2), 'EUR ·', t.id);
  } catch (e) {
    l.status = 'fehlgeschlagen'; l.fehler = String(e && e.message ? e.message : e).slice(0, 200);
    log.error('Lizenz-Ueberweisung:', l.bestellung, '·', l.firma, '·', l.fehler);
  }
  return speichern(store, l);
}

/** Stuendlich: offene und wartende Saetze noch einmal versuchen (Konto nachgereicht, Stripe wieder da). */
export async function nachholen(store, deps) {
  let n = 0;
  for (const l of await liste(store)) {
    if (!['offen', 'ohne_konto', 'fehlgeschlagen'].includes(l.status)) continue;
    const vorher = l.status;
    const neu = await ueberweisen(store, l.id, deps).catch(() => null);
    if (neu && neu.status === 'ueberwiesen' && vorher !== 'ueberwiesen') n++;
  }
  return n;
}

/** Fuers Backend: Summen je Betrieb. */
export function summen(saetze) {
  const je = {};
  for (const l of saetze) {
    const k = l.firma;
    je[k] = je[k] || { firma: k, saetze: 0, ueberwiesenCents: 0, offenCents: 0 };
    je[k].saetze++;
    if (l.status === 'ueberwiesen') je[k].ueberwiesenCents += l.betragCents; else je[k].offenCents += l.betragCents;
  }
  return Object.values(je);
}
