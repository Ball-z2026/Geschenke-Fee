// Kaufformen: was der Kunde am Ende bekommt. Zwei Wege, und der erste ist einer, den es bei den
// Abi- und Gruppen-Anbietern so nicht gibt - dort kauft man immer nur das fertige Kleidungsstueck.
//
//   datei  - die Druckdatei allein (36x46 cm, 300 dpi, freigestellt). Fuer alle, die selbst drucken lassen.
//   textil - das fertige Teil, bedruckt und geliefert.
//
// 25. Sept., Markus: "Nimm bitte von der Seite runter, dass wir auch nur die Transfers verkaufen.
// Nur Datei oder Textil."
// Hier stand als dritter Weg der fertige DTF-Transfer zum Aufbuegeln, fuer Vereine und Betriebe
// mit eigenen Textilien. Er ist raus - und zwar aus dieser Liste, nicht per Schalter. Damit faellt
// er ueberall zugleich weg: aus der Auswahl auf der Motto-Seite, aus dem Backend und aus den
// erlaubten Werten der Anfrage. KEYS kommt aus dieser Liste, und was hier nicht steht, wird auch
// nicht mehr angenommen - ein Schalter in storage/kaufformen.json koennte ihn nicht zurueckholen.
// Alte Anfragen, in denen "transfer" als Kaufform steht, bleiben lesbar: das ist ein
// Geschaeftsvorfall von damals und wird nicht nachtraeglich umgeschrieben.
//
// Preise pflegt Markus im Backend (storage/kaufformen.json). Ohne Preis steht "auf Anfrage" - lieber kein
// Preis als ein falscher. Bezahlt wird noch nicht hier: bis der Warenkorb steht, geht eine Anfrage per Mail
// raus. Die Auswahl wird am Design gespeichert und kann spaeter direkt in den Warenkorb wandern.
import fs from 'node:fs/promises';
import path from 'node:path';
import preise from './preise.cjs';
import { zaehl } from './zaehler.js';
import { TEXTIL_FARBEN, FARB_TEILE } from './mockups.js';
import { mountShopifyKasse } from './shopify-kasse.js';

// 7. Okt., Markus: "Nur die Druckdatei sollte ueberall raus." Genauso wie der Transfer: aus dieser Liste,
// damit sie ueberall zugleich wegfaellt (Mottoseite, Backend, erlaubte Werte der Anfrage). Alte Anfragen mit
// "datei" bleiben lesbar - Geschaeftsvorfall von damals.
export const KAUFFORMEN = [
  {
    key: 'textil',
    label: 'Fertiges Produkt',
    kurz: 'Fertiges Produkt',
    text: 'Textil und Druck aus einer Hand: Wir bedrucken und liefern fertig. Veredelt in Deutschland.',
    fuer: 'Wenn alles aus einer Hand kommen soll',
    proStueck: true
  }
];
const KEYS = KAUFFORMEN.map(f => f.key);

const cent = (v) => { const n = Math.round(+v); return Number.isFinite(n) && n > 0 && n < 100000000 ? n : 0; };
export const preisText = (c) => c > 0 ? (c / 100).toFixed(2).replace('.', ',') + ' €' : 'auf Anfrage';

export function mountKaufformen(app, deps) {
  const { STORE, mottos, produkte, GARMENTS, adminGuard, readJob, mailLogged, env, identify, accounts } = deps;
  // 5. Okt.: die Shopify-Kasse (shopify-kasse.js). Ist sie an, geht das fertige Teil direkt zur Kasse
  // statt als Anfrage - die Druckdatei bleibt eine Anfrage. Aus, solange SHOPIFY_KASSE nicht "an" ist.
  const kasse = mountShopifyKasse(app, { STORE, GARMENTS, adminGuard, readJob, env, identify, accounts });
  const FILE = path.join(STORE, 'kaufformen.json');
  const DIR = path.join(STORE, 'anfragen');
  // preise.textil ist je Teil (ein Hoodie kostet mehr als ein T-Shirt), die anderen beiden gelten pauschal.
  // 25. Sept.: 'transfer' ist raus. Was in einer alten storage/kaufformen.json noch dazu steht,
  // wird beim Laden zwar mitgelesen, aber nie wieder benutzt - KAUFFORMEN entscheidet, was es gibt.
  let state = { aktiv: { datei: true, textil: true }, preise: { datei: 0, textil: {} } };

  async function persist() { await fs.mkdir(STORE, { recursive: true }); await fs.writeFile(FILE, JSON.stringify(state, null, 2)); }
  (async () => {
    try {
      const g = JSON.parse(await fs.readFile(FILE, 'utf8'));
      if (g && typeof g === 'object') {
        state.aktiv = Object.assign(state.aktiv, g.aktiv || {});
        state.preise = Object.assign(state.preise, g.preise || {});
        if (!state.preise.textil || typeof state.preise.textil !== 'object') state.preise.textil = {};
      }
    } catch (e) { /* noch nichts gepflegt - alles auf Anfrage */ }
  })();

  // Fuer das fertige Teil gilt die Preisliste (preise.cjs) - eine Quelle, kein zweiter Satz Zahlen
  // im Backend, der stillschweigend danebenlaufen koennte. Datei und Transfer haben dort keinen
  // Preis, die kommen weiter aus dem Backend-Feld.
  function preisVon(key, garment, stufe, menge) {
    if (key === 'textil') {
      if (!preise.istBekannt(garment)) return 0;
      return Math.round(preise.stueckpreis(garment, stufe || 'liebling', +menge || 1) * 100);
    }
    return cent(state.preise[key]);
  }

  // Fuer die Motto-Seite: die aktiven Kaufformen mit Preis je Teil, damit die Auswahl ohne
  // zweiten Aufruf gezeichnet werden kann.
  function publicView() {
    return KAUFFORMEN.filter(f => state.aktiv[f.key] !== false).map(f => {
      const out = { key: f.key, label: f.label, kurz: f.kurz, text: f.text, fuer: f.fuer, proStueck: f.proStueck };
      if (f.key === 'textil') {
        // Das Rechnen macht die Seite selbst mit /preise.js - hier steht nur, was es gibt.
        out.stufen = preise.STUFEN;
        out.preisliste = true;
        out.kasse = kasse.kasseAn();
      } else out.preis = preisVon(f.key);
      return out;
    });
  }

  // ---------- Backend: Preise und An/Aus ----------
  app.get('/api/admin/kaufformen', adminGuard, (req, res) => {
    res.json({
      formen: KAUFFORMEN.map(f => ({ key: f.key, label: f.label, proStueck: f.proStueck })),
      produkte: Object.keys(GARMENTS).map(k => ({ key: k, label: GARMENTS[k].label })),
      aktiv: state.aktiv, preise: state.preise
    });
  });

  app.post('/api/admin/kaufformen', adminGuard, async (req, res) => {
    const b = req.body || {};
    if (b.aktiv && typeof b.aktiv === 'object') for (const k of KEYS) if (k in b.aktiv) state.aktiv[k] = !!b.aktiv[k];
    if (b.preise && typeof b.preise === 'object') {
      if ('datei' in b.preise) state.preise.datei = cent(b.preise.datei);
      if (b.preise.textil && typeof b.preise.textil === 'object') {
        for (const [k, v] of Object.entries(b.preise.textil)) if (GARMENTS[k]) state.preise.textil[k] = cent(v);
      }
    }
    try { await persist(); } catch (e) { return res.status(500).json({ error: 'speichern fehlgeschlagen' }); }
    res.json({ ok: true, aktiv: state.aktiv, preise: state.preise });
  });

  // ---------- Kunde: Anfrage zu einem fertigen Design ----------
  // Kein Kauf, sondern eine Anfrage - der Warenkorb kommt mit der Shopify-Anbindung.
  app.post('/api/mo/anfrage', async (req, res) => {
    const b = req.body || {};
    const designId = String(b.designId || '').replace(/[^A-Za-z0-9_-]/g, '');
    const form = KEYS.includes(String(b.form)) ? String(b.form) : '';
    if (!designId || !form) return res.status(400).json({ error: 'Bitte Design und Kaufform angeben' });
    if (state.aktiv[form] === false) return res.status(400).json({ error: 'Diese Kaufform wird gerade nicht angeboten' });

    const j = await readJob(designId);
    if (!j) return res.status(404).json({ error: 'Design nicht gefunden' });

    const garment = GARMENTS[String(b.garment || '')] ? String(b.garment) : '';
    const menge = Math.min(Math.max(parseInt(b.menge, 10) || 1, 1), 2000);
    const email = String(b.email || '').trim().slice(0, 120);
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) return res.status(400).json({ error: 'Bitte eine gültige E-Mail angeben' });
    const wer = String(b.name || '').trim().slice(0, 80);
    const text = String(b.text || '').trim().slice(0, 1500);
    const stufe = preise.STUFEN.some(x => x.key === String(b.stufe)) ? String(b.stufe) : 'liebling';
    const zweiteSeite = !!b.zweiteSeite;
    // 4. Okt.: die Textilfarbe, die der Kunde auf der Ergebnisseite angetippt hat (Schwarz, Weiss oder eine Farbe aus
    // TEXTIL_FARBEN - nur bei T-Shirt und Polo). Ohne Wahl bleibt es beim Textil des Auftrags.
    const fk = String(b.farbe || '');
    const farbe = fk === 'black' || fk === 'white' ? fk : (TEXTIL_FARBEN[fk] && FARB_TEILE.includes(garment) ? fk : '');
    const farbeName = farbe === 'black' ? 'Schwarz' : farbe === 'white' ? 'Weiß' : farbe ? TEXTIL_FARBEN[farbe].label + ' (B&C ' + TEXTIL_FARBEN[farbe].name[garment] + ')' : '';

    // Fassung 74: Welche Kaufform fragen die Leute an, und auf welchem Teil? Beides sind feste
    // Werte aus dem eigenen Katalog - Name, E-Mail und Nachricht bleiben aussen vor.
    zaehl('kaufform', form);
    zaehl('anfrage', garment || form);

    const f = KAUFFORMEN.find(x => x.key === form);
    const preis = preisVon(form, garment, stufe, menge);
    // Nachrechnen auf dem Server: was die Seite angezeigt hat, muss nicht geglaubt werden
    const korb = form === 'textil' && preise.istBekannt(garment)
      ? preise.warenkorb([{ artikel: garment, stufe, menge, zweiteSeite }]) : null;
    const motto = j.motto || '';
    const anfrage = {
      id: 'anf_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      designId, motto, form, garment, menge, email, name: wer, text,
      stufe: form === 'textil' ? stufe : null, zweiteSeite: form === 'textil' ? zweiteSeite : false,
      preisCent: preis,
      summe: korb ? { ware: korb.ware, versand: korb.versand, gesamt: korb.gesamt, rabatt: korb.rabatt } : null,
      personen: (j.names || []).length, aufteilung: j.aufteilung || 'vorne',
      textile: j.textile || 'dunkel', farbe: farbe || null, farbeName: farbeName || null, created: new Date().toISOString()
    };
    try {
      await fs.mkdir(DIR, { recursive: true });
      await fs.writeFile(path.join(DIR, anfrage.id + '.json'), JSON.stringify(anfrage, null, 2));
    } catch (e) { console.error('Anfrage speichern:', e && e.message ? e.message : e); }

    const teil = garment && GARMENTS[garment] ? GARMENTS[garment].label : '';
    const zeilen = [
      ['Kaufform', f.label], ['Design', designId], ['Motto', motto],
      ['Produkt', teil || '–'], ['Textilfarbe', farbeName || '–'], ['Menge', String(menge)],
      ['Stufe', form === 'textil' ? (preise.STUFEN.find(x => x.key === stufe) || {}).label || stufe : '–'],
      ['Zweite Druckseite', form === 'textil' ? (zweiteSeite ? 'ja (+' + preise.euro(preise.ZWEITE_SEITE) + ' je Stück)' : 'nein') : '–'],
      ['Stückpreis', korb ? preise.euro(korb.posten[0].stueck) : preisText(preis)],
      ['Ware', korb ? preise.euro(korb.ware) : '–'],
      ['Versand', korb ? (korb.versandfrei ? 'frei' : preise.euro(korb.versand)) : '–'],
      ['Gesamt', korb ? preise.euro(korb.gesamt) : '–'],
      ['Personen in der Liste', String(anfrage.personen)],
      ['Name', wer || '–'], ['E-Mail', email]
    ];
    const tab = zeilen.map(([k, v]) => `<tr><td style="padding:3px 12px 3px 0;color:#666">${k}</td><td style="padding:3px 0"><b>${escapeHtml(v)}</b></td></tr>`).join('');
    const an = env.ADMIN_EMAIL || env.MAIL_FROM;
    try {
      await mailLogged({
        apiKey: env.BREVO_API_KEY, from: env.MAIL_FROM, fromName: env.MAIL_FROM_NAME, to: an,
        subject: `Anfrage: ${f.kurz}${teil ? ' – ' + teil : ''} (${menge}×) · ${designId}`,
        html: `<p><b>Neue Kaufanfrage über die Design-Seite.</b></p><table>${tab}</table>`
          + (text ? `<p style="margin-top:12px"><b>Nachricht:</b><br>${escapeHtml(text).replace(/\n/g, '<br>')}</p>` : '')
      });
    } catch (e) { console.error('Anfrage-Mail an uns:', e && e.message ? e.message : e); }

    // Bestaetigung an den Kunden - darf scheitern, ohne die Anfrage zu verlieren
    try {
      await mailLogged({
        apiKey: env.BREVO_API_KEY, from: env.MAIL_FROM, fromName: env.MAIL_FROM_NAME, to: email,
        subject: 'Deine Anfrage bei Motto Otto',
        html: `<p>Hallo${wer ? ' ' + escapeHtml(wer) : ''},</p>`
          + `<p>deine Anfrage ist bei uns: <b>${escapeHtml(f.label)}</b>${teil ? ', ' + escapeHtml(teil) : ''}${farbeName ? ' in ' + escapeHtml(farbeName) : ''}, ${menge}× – zu Design <b>${escapeHtml(designId)}</b>.</p>`
          + `<p>Wir melden uns mit einem Angebot. Wenn dir noch etwas einfällt, antworte einfach auf diese Mail.</p><p>Otto</p>`
      });
    } catch (e) { console.error('Anfrage-Bestaetigung:', e && e.message ? e.message : e); }

    res.json({ ok: true, form: f.kurz });
  });

  // ---------- Backend: eingegangene Anfragen ----------
  app.get('/api/admin/anfragen', adminGuard, async (req, res) => {
    let files = [];
    try { files = (await fs.readdir(DIR)).filter(f => f.endsWith('.json')); } catch (e) { /* noch keine */ }
    const list = [];
    for (const f of files.sort().reverse().slice(0, 200)) {
      try { list.push(JSON.parse(await fs.readFile(path.join(DIR, f), 'utf8'))); } catch (e) { /* kaputte Datei ueberspringen */ }
    }
    list.sort((a, b) => String(b.created).localeCompare(String(a.created)));
    res.json({ anfragen: list, formen: KAUFFORMEN.map(f => ({ key: f.key, kurz: f.kurz })) });
  });

  return { publicView, preisVon, KAUFFORMEN, kasse };
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
}
