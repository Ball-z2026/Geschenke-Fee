import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

// ---------- Preislogik (eine Stelle) ----------
export const PLANS = {
  free:  { label: 'Kostenfrei', designs: 5 },                              // je Kunde einmalig
  single:{ label: 'Einzeldesign', cents: 100 },                            // je weiteres Design
  // Staffel vom 17. Sept. 2026 (Markus): 100 Designs fuer 29 Euro, 400 fuer 49 Euro.
  // Die AGB nennt 100/29 Euro ausdruecklich - Paragraf 3 und diese Zeile muessen immer
  // dasselbe sagen, sonst steht im Vertragstext ein anderer Preis als im Shop.
  m100:  { label: 'Member 100', cents: 2900, designs: 100, interval: 'month' },
  m400:  { label: 'Member 400', cents: 4900, designs: 400, interval: 'month' }
};
export const GUEST_FREE = 1; // so viele Designs ohne Anmeldung, danach muss man sich anmelden

const hex = (n) => crypto.randomBytes(n).toString('hex');
const now = () => Date.now();

function hmac(secret, s) { return crypto.createHmac('sha256', secret).update(s).digest('hex').slice(0, 32); }

export function normEmail(e) {
  const t = String(e || '').trim().toLowerCase();
  if (t.length > 120 || !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(t)) return null;
  return t;
}

// ---------- Cookies ohne Fremdpaket ----------
export function readCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
export function setCookie(res, name, value, maxAgeSec, secure) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSec}`];
  if (secure) parts.push('Secure');
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', [].concat(prev || [], parts.join('; ')));
}

// ---------- Ablage: users/<id>.json, users/_email/<hash> -> id, logins/<token>.json ----------
export function accountStore(dir, secret) {
  const usersDir = path.join(dir, 'users');
  const emailDir = path.join(dir, 'users', '_email');
  const loginDir = path.join(dir, 'logins');
  const guestDir = path.join(dir, 'guests');
  const ready = Promise.all([usersDir, emailDir, loginDir, guestDir].map(d => fs.mkdir(d, { recursive: true })));

  const emailKey = (email) => crypto.createHash('sha1').update(email).digest('hex').slice(0, 24);
  const userFile = (id) => path.join(usersDir, id + '.json');
  const guestFile = (id) => path.join(guestDir, id + '.json');

  async function readJson(f) { try { return JSON.parse(await fs.readFile(f, 'utf8')); } catch (e) { return null; } }
  async function writeJson(f, o) { await fs.writeFile(f, JSON.stringify(o, null, 2)); return o; }

  const blankUser = (email) => ({
    id: 'u_' + hex(8), email, created: new Date().toISOString(),
    designs: [],            // designIds, neueste zuletzt
    freeUsed: 0,            // von PLANS.free.designs
    credits: 0,             // gekaufte Einzeldesigns
    plan: null,             // 'm100' | 'm400'
    planUsed: 0,            // im laufenden Monat verbraucht
    planPeriodEnd: 0,       // ms
    stripeCustomer: null, stripeSub: null,
    lastLogin: null,
    // ----- Firmenkonto (B2B) -----
    // Ein Handwerksmeister will nicht bei jedem Auftrag sein Logo suchen und die
    // Mitarbeiterliste neu tippen. Darum liegt beides am Konto, nicht am Design.
    // firma bleibt null, solange niemand Firmendaten hinterlegt hat - daran erkennt
    // der Firmenbereich, ob er das Formular oder den Arbeitsplatz zeigen muss.
    firma: null,            // { name, strasse, plz, ort, land, ustId, ansprech, telefon }
    firmaLogo: null,        // uploadId des einmal hinterlegten Logos
    listen: [],             // [{ id, name, leute: [{name, size, garment}], geaendert }]
    // Vorbereitet fuer Fassung 2: mehrere Kollegen auf einem Firmenkonto. Steht schon
    // in den Daten, damit das spaeter kein Umbau wird, sondern nur neue Routen.
    kollegen: []            // [{ email, eingeladen, seit }]
  });

  return {
    async ready() { await ready; },

    // ----- Gaeste: Designs vor der Anmeldung merken -----
    async guestGet(id) { return (await readJson(guestFile(id))) || { id, designs: [] }; },
    async guestAddDesign(id, designId) {
      const g = await this.guestGet(id);
      if (!g.designs.includes(designId)) g.designs.push(designId);
      return writeJson(guestFile(id), g);
    },

    // ----- Nutzer -----
    async byId(id) { return id ? readJson(userFile(id)) : null; },
    async byEmail(email) {
      const id = (await readJson(path.join(emailDir, emailKey(email)))) || null;
      return id && id.id ? this.byId(id.id) : null;
    },
    async getOrCreate(email) {
      let u = await this.byEmail(email);
      if (u) return u;
      u = blankUser(email);
      await writeJson(userFile(u.id), u);
      await writeJson(path.join(emailDir, emailKey(email)), { id: u.id });
      return u;
    },
    async save(u) { return writeJson(userFile(u.id), u); },
    async all() {
      let names = [];
      try { names = await fs.readdir(usersDir); } catch (e) { return []; }
      const out = [];
      for (const n of names) if (n.endsWith('.json')) { const u = await readJson(path.join(usersDir, n)); if (u) out.push(u); }
      return out.sort((a, b) => String(b.created).localeCompare(String(a.created)));
    },

    // Gast-Designs in das Konto uebernehmen
    async adoptGuest(user, guestId) {
      if (!guestId) return user;
      const g = await readJson(guestFile(guestId));
      if (!g || !g.designs.length) return user;
      for (const d of g.designs) if (!user.designs.includes(d)) { user.designs.push(d); user.freeUsed++; }
      user.freeUsed = Math.min(user.freeUsed, PLANS.free.designs + 50);
      await writeJson(guestFile(guestId), { id: guestId, designs: [], adoptedBy: user.id });
      return this.save(user);
    },

    // ----- Anmelde-Links -----
    // ttlMs ist freiwillig: ein Link, den der Kunde SELBST anfordert, darf kurz leben (30 Min).
    // Ein Link, den wir ihm ungefragt schicken ("dein Design ist fertig"), muss laenger halten -
    // sonst ist er abgelaufen, bevor die Mail ueberhaupt gelesen wird. Nach oben bei 7 Tagen dicht.
    async createLogin(email, next, ttlMs) {
      const token = hex(24);
      const dauer = Math.min(Math.max(+ttlMs || 30 * 60e3, 60e3), 7 * 86400e3);
      await writeJson(path.join(loginDir, token + '.json'), { email, next: String(next || '/konto').slice(0, 200), exp: now() + dauer });
      return token;
    },
    async consumeLogin(token) {
      if (!/^[a-f0-9]{48}$/.test(String(token || ''))) return null;
      const f = path.join(loginDir, token + '.json');
      const l = await readJson(f);
      await fs.rm(f, { force: true });
      if (!l || l.exp < now()) return null;
      return l;
    },

    // ----- Sitzung: signierter Cookie -----
    sessionValue(userId) {
      const exp = now() + 180 * 86400e3;
      const body = `${userId}.${exp}`;
      return `${body}.${hmac(secret, body)}`;
    },
    sessionUserId(value) {
      const m = /^(u_[a-f0-9]{16})\.(\d+)\.([a-f0-9]{32})$/.exec(String(value || ''));
      if (!m) return null;
      if (+m[2] < now()) return null;
      if (hmac(secret, `${m[1]}.${m[2]}`) !== m[3]) return null;
      return m[1];
    }
  };
}

// ---------- Kontingent: darf dieser Kunde jetzt ein Design erzeugen, und womit wird es bezahlt? ----------
// Rueckgabe { ok, via: 'free'|'plan'|'credit', reason?: 'login'|'pay' }
export function quotaCheck(user, guest) {
  if (!user) {
    const used = guest && guest.designs ? guest.designs.length : 0;
    return used < GUEST_FREE ? { ok: true, via: 'guest' } : { ok: false, reason: 'login' };
  }
  if (user.freeUsed < PLANS.free.designs) return { ok: true, via: 'free' };
  if (user.plan && PLANS[user.plan] && user.planPeriodEnd > now() && user.planUsed < PLANS[user.plan].designs) return { ok: true, via: 'plan' };
  if (user.credits > 0) return { ok: true, via: 'credit' };
  return { ok: false, reason: 'pay' };
}

// Verbrauch buchen, nachdem ein Design fertig ist
export function bookDesign(user, via, designId) {
  if (!user.designs.includes(designId)) user.designs.push(designId);
  if (via === 'free') user.freeUsed++;
  else if (via === 'plan') user.planUsed++;
  else if (via === 'credit') user.credits = Math.max(0, user.credits - 1);
  return user;
}

// Was der Kunde ueber sein Konto sehen darf
export function accountView(user) {
  const plan = user.plan && PLANS[user.plan] && user.planPeriodEnd > now() ? user.plan : null;
  return {
    email: user.email,
    designs: user.designs.slice().reverse(),
    freeLeft: Math.max(0, PLANS.free.designs - user.freeUsed),
    credits: user.credits,
    // 6. Okt.: bezahlte Einzelentwuerfe, die beim Textilkauf noch abgehen (Cent)
    verrechenbar: Math.max(0, Math.round(+user.verrechenbarCent || 0)),
    plan,
    planLabel: plan ? PLANS[plan].label : null,
    planLeft: plan ? Math.max(0, PLANS[plan].designs - user.planUsed) : 0,
    planPeriodEnd: plan ? new Date(user.planPeriodEnd).toISOString() : null,
    prices: { single: PLANS.single.cents, m100: PLANS.m100.cents, m400: PLANS.m400.cents, free: PLANS.free.designs, m100Designs: PLANS.m100.designs, m400Designs: PLANS.m400.designs }
  };
}

// ---------- Mail ueber Brevo (Transaktionsmail) ----------
// Generischer Versand: von Login-Mail und Abstimmungs-Mails genutzt. Ohne API-Key nur Log (Entwicklung).
export async function sendMail({ apiKey, from, fromName, to, subject, html, text, anhang }) {
  if (!apiKey) { console.log('MAIL (kein BREVO_API_KEY gesetzt) an', to, '·', subject); return { sent: false, logged: true }; }
  // 25. Sept., Stabilitaets-Durchgang: Dieser Aufruf hatte als einziger Netzaufruf im Haus keine
  // Zeitgrenze. Node bricht von sich aus NIE ab - antwortet Brevo nicht, haengt die Anmeldung
  // oder die Fertig-Mail fuer immer, und der Kunde sieht ein Rad, das sich dreht. Zwanzig
  // Sekunden sind fuer eine Transaktionsmail reichlich; laenger zu warten hilft niemandem.
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    signal: AbortSignal.timeout(20000),
    headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: from, name: fromName || 'Motto Otto' },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text || String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      // Anhaenge als oeffentliche URL (Brevo laedt sie selbst): [{ url, name }]
      ...(Array.isArray(anhang) && anhang.length ? { attachment: anhang.map(a => ({ url: a.url, name: a.name })) } : {})
    }),
    signal: AbortSignal.timeout(15000)
  });
  if (!r.ok) throw new Error('Brevo ' + r.status + ' ' + (await r.text()).slice(0, 200));
  // messageId merken: damit laesst sich die Mail in den Brevo-Logs wiederfinden
  const j = await r.json().catch(() => ({}));
  return { sent: true, messageId: j.messageId || null };
}

export async function sendLoginMail({ apiKey, from, fromName, to, link, base }) {
  if (!apiKey) { console.log('LOGIN-LINK (kein BREVO_API_KEY gesetzt):', to, link); return { sent: false, logged: true }; }
  const html = `<div style="font-family:Arial,sans-serif;font-size:16px;color:#222;max-width:520px">
<p style="font-size:22px;font-weight:bold;margin:0 0 14px">Motto Otto</p>
<p>Mit einem Klick bist du angemeldet – der Link gilt 30 Minuten:</p>
<p style="margin:22px 0"><a href="${link}" style="background:#ffc542;color:#1b1710;text-decoration:none;font-weight:bold;padding:13px 22px;border-radius:8px;display:inline-block">Jetzt anmelden</a></p>
<p style="color:#666;font-size:13px">Falls der Knopf nicht geht, kopiere diese Adresse in den Browser:<br>${link}</p>
<p style="color:#666;font-size:13px">Du hast das nicht angefordert? Dann einfach ignorieren.</p>
<p style="color:#999;font-size:12px;margin-top:26px">${base}</p></div>`;
  return sendMail({ apiKey, from, fromName, to, subject: 'Dein Anmelde-Link für Motto Otto', html, text: `Dein Anmelde-Link für Motto Otto (30 Minuten gültig): ${link}` });
}
