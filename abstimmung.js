// Abstimmung ueber Designs (SPEC 7. Sept. 2026), Bauweise wie vorzeige.js: mountAbstimmung(app, deps).
// Das Orga-Team schickt mehrere Design-Varianten desselben Mottos an alle Teilnehmer, jeder stimmt per
// Link ab (E-Mail-Link ODER WhatsApp-Gruppenlink), das Orga-Team bekommt das Ergebnis automatisch.
//
// Ablage: storage/polls/<pollId>.json
// Kanaele: 'gruppe' (WhatsApp-Gruppenlink, Abschnitt 8a), 'mail' (Brevo). 'whatsapp' (Einzelnachricht, 8b)
// ist nur als abstrakter Kanal vorbereitet - Versand nur, wenn WA_TOKEN gesetzt ist, sonst als "nicht aktiv" vermerkt.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { STYLES, istHell, TEXTILTOENE } from './mottos.js';
import { zaehl } from './zaehler.js';

const DAY = 86400e3;

export function mountAbstimmung(app, deps) {
  const { STORE, mottos, env, accounts, identify, signPreview, SIGN_SECRET, sendMail, newId, produkte, GARMENTS, consensusDesign, istGruppenMotto } = deps;
  const DIR = path.join(STORE, 'polls');
  const base = () => String(env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  const rnd = (n) => crypto.randomBytes(n).toString('hex');
  const now = () => Date.now();

  const file = (id) => path.join(DIR, String(id).replace(/[^A-Za-z0-9-]/g, '') + '.json');
  async function readPoll(id) { try { return JSON.parse(await fs.readFile(file(id), 'utf8')); } catch (e) { return null; } }
  async function writePoll(p) { await fs.mkdir(DIR, { recursive: true }); await fs.writeFile(file(p.id), JSON.stringify(p, null, 2)); }
  async function readJob(designId) { try { return JSON.parse(await fs.readFile(path.join(STORE, 'jobs', String(designId).replace(/[^A-Za-z0-9_-]/g, '') + '.json'), 'utf8')); } catch (e) { return null; } }

  const styleLabel = (k) => (STYLES[k] && STYLES[k].label) || k || 'Standard';
  const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch (e) { return iso; } }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function ownerKey(who) { return who && who.user ? { userId: who.user.id } : (who && who.guestId ? { guestId: who.guestId } : null); }
  function ownerMatches(poll, who) {
    if (!poll || !poll.owner) return false;
    if (poll.owner.userId && who && who.user) return poll.owner.userId === who.user.id;
    if (poll.owner.guestId && who && who.guestId) return poll.owner.guestId === who.guestId;
    return false;
  }
  async function ownedDesigns(who) {
    if (who && who.user) return who.user.designs || [];
    if (who && who.guest) return who.guest.designs || [];
    return [];
  }

  // signierte T-Shirt-Mockup-URL fuer ein Design (Gueltigkeit aus der Abstimmung abgeleitet)
  function mockupUrl(designId, textile, exp) {
    const color = istHell(textile) ? 'white' : 'black';
    return `${base()}/api/mo/mockup/${designId}/tee/${color}.jpg?exp=${exp}&sig=${signPreview(designId, exp, SIGN_SECRET)}`;
  }
  const pollExp = (poll) => new Date(poll.closes).getTime() + 7 * DAY;

  // Ein Bewerter kann JEDES Design mit 1-5 Sternen bewerten (Mehrfachauswahl) und einen Kommentar
  // hinterlassen. Dedupe nach Name: persönliche Stimme schlägt Gruppen-Stimme.
  function ratingsOf(entry) {
    if (entry && entry.ratings && Object.keys(entry.ratings).length) return entry.ratings;
    if (entry && entry.vote) return { [entry.vote]: 5 }; // Rückwärts-kompatibel: alte Einzelwahl = 5 Sterne
    return {};
  }
  const wishesOf = (e) => Array.isArray(e && e.wishes) ? e.wishes : [];
  const designCommentsOf = (e) => (e && e.designComments && typeof e.designComments === 'object') ? e.designComments : {};
  function voterEntries(poll) {
    const byName = new Map();
    const put = (map, e) => {
      const r = ratingsOf(e); const w = wishesOf(e); const dc = designCommentsOf(e);
      if (Object.keys(r).length || e.comment || w.length || Object.keys(dc).length)
        map.set(String(e.name).toLowerCase(), { name: e.name, ratings: r, comment: e.comment || '', wishes: w, designComments: dc });
    };
    for (const p of poll.people || []) put(byName, p);
    for (const g of poll.groupVotes || []) { const n = String(g.name).toLowerCase(); if (byName.has(n)) continue; put(byName, g); }
    return byName;
  }
  // Welche Artikel bieten wir fuer dieses Motto an? (fuer die "Was wuenscht ihr euch?"-Frage)
  function articleList(poll) {
    let keys = [];
    try { keys = (produkte && produkte.enabledFor) ? produkte.enabledFor(poll.motto) : []; } catch (e) { keys = []; }
    if (!keys || !keys.length) keys = ['tee', 'hoodie', 'tasse', 'beutel'];
    return keys.filter(k => GARMENTS && GARMENTS[k]).map(k => ({ key: k, label: GARMENTS[k].label }));
  }
  // Artikel-Wuensche ueber alle Bewerter zaehlen (dedupe nach Name via voterEntries)
  function wishTally(poll) {
    const allowed = new Set(articleList(poll).map(a => a.key));
    const count = {}; allowed.forEach(k => count[k] = 0);
    for (const [, e] of voterEntries(poll)) for (const w of wishesOf(e)) if (allowed.has(w)) count[w]++;
    return count;
  }
  function tally(poll) {
    const stat = {}; const designComments = {};
    poll.designIds.forEach(d => { stat[d] = { sum: 0, count: 0, avg: 0 }; designComments[d] = []; });
    const voted = new Set(); const votedList = []; const comments = [];
    for (const [n, e] of voterEntries(poll)) {
      voted.add(n); if (e.name) votedList.push(e.name);
      for (const d of poll.designIds) { const s = +e.ratings[d]; if (s >= 1 && s <= 5) { stat[d].sum += s; stat[d].count++; } }
      if (e.comment) comments.push({ name: e.name, text: e.comment });
      const dc = designCommentsOf(e);
      for (const d of poll.designIds) { const txt = dc[d] ? String(dc[d]).trim() : ''; if (txt) designComments[d].push({ name: e.name, text: txt }); }
    }
    let best = 0; poll.designIds.forEach(d => { stat[d].avg = stat[d].count ? +(stat[d].sum / stat[d].count).toFixed(2) : 0; if (stat[d].count && stat[d].avg > best) best = stat[d].avg; });
    const winners = poll.designIds.filter(d => stat[d].count && stat[d].avg === best && best > 0);
    return { stat, winners, best, votedNames: voted, votedList, comments, designComments };
  }
  function nonVoters(poll) {
    const t = tally(poll);
    return (poll.people || []).filter(p => !t.votedNames.has(String(p.name).toLowerCase()));
  }

  // Fassung 74 (Markus, 17. Sept.: "Es waere natuerlich schoen, dass derjenige, der die
  // Abstimmung macht, sieht, wer wie bewertet hat - und das uebersichtlich"):
  // Bisher gab es nur Durchschnitte je Design und eine Liste der Namen, die abgestimmt haben.
  // Beides zusammen beantwortet die eigentliche Frage nicht: Wer will welches Shirt? Wer ist
  // dagegen? Wer hat nur die Haelfte bewertet? Die Tafel liefert eine Zeile je Person mit
  // ihren Sternen je Design - die Rohdaten lagen laengst im Auftrag, sie wurden nur nie gezeigt.
  //
  // NUR fuer die Orga. Die Teilnehmer sehen weiterhin keine fremden Stimmen: eine offene
  // Namensabstimmung im Freundeskreis waere sonst ein Werkzeug fuer Gruppenzwang.
  function bewerterTafel(poll) {
    const zeilen = [];
    const gesehen = new Set();
    const eintragen = (e, quelle) => {
      const key = String(e.name || '').toLowerCase();
      if (!key || gesehen.has(key)) return;
      const r = ratingsOf(e), dc = designCommentsOf(e), w = wishesOf(e);
      if (!(Object.keys(r).length || e.comment || w.length || Object.keys(dc).length)) return;
      gesehen.add(key);
      const sterne = {};
      let best = 0;
      for (const d of poll.designIds) {
        const s = +r[d];
        if (s >= 1 && s <= 5) { sterne[d] = s; if (s > best) best = s; }
      }
      const werte = Object.values(sterne);
      zeilen.push({
        name: e.name, quelle, sterne,
        // Favorit ist, was diese Person am hoechsten bewertet hat - bei Gleichstand mehrere.
        favorit: best ? poll.designIds.filter(d => sterne[d] === best) : [],
        schnitt: werte.length ? +(werte.reduce((a, b) => a + b, 0) / werte.length).toFixed(1) : 0,
        bewertet: werte.length,
        kommentar: e.comment || '',
        designKommentare: dc,
        wuensche: w,
        offen: false
      });
    };
    for (const p of poll.people || []) eintragen(p, 'liste');
    for (const g of poll.groupVotes || []) eintragen(g, 'gruppe');
    // Wer eingeladen ist und nichts gemacht hat, gehoert in die Tafel - sonst sieht die Orga
    // nur die Aktiven und haelt die Runde fuer vollstaendig.
    for (const p of poll.people || []) {
      if (gesehen.has(String(p.name || '').toLowerCase())) continue;
      zeilen.push({ name: p.name, quelle: 'liste', sterne: {}, favorit: [], schnitt: 0, bewertet: 0, kommentar: '', designKommentare: {}, wuensche: [], offen: true });
    }
    zeilen.sort((a, b) => (a.offen - b.offen) || String(a.name).localeCompare(String(b.name), 'de'));
    return zeilen;
  }

  // ---------------- Mail-Vorlagen ----------------
  const btn = (href, label) => `<p style="margin:22px 0"><a href="${href}" style="background:#ffc542;color:#1b1710;text-decoration:none;font-weight:bold;padding:13px 22px;border-radius:8px;display:inline-block">${label}</a></p>`;
  const wrap = (inner) => `<div style="font-family:Arial,sans-serif;font-size:16px;color:#222;max-width:520px"><p style="font-size:22px;font-weight:bold;margin:0 0 14px">Motto Otto</p>${inner}<p style="color:#999;font-size:12px;margin-top:26px">${base()}</p></div>`;

  function inviteMail(poll, person) {
    const link = `${base()}/abstimmung/${poll.id}?t=${person.token}`;
    const html = wrap(`<p>Hallo ${esc(person.name)},</p><p>das Orga-Team hat <b>${poll.designIds.length}</b> Designs für <b>${esc(poll.mottoName)}</b> gemacht. Stimm ab, welches gedruckt wird – ein Klick genügt.</p><p>Frist: <b>${fmtDate(poll.closes)}</b>.</p>${btn(link, 'Jetzt abstimmen')}<p style="color:#666;font-size:13px">Falls der Knopf nicht geht: ${link}</p>`);
    return { subject: `Abstimmung: Welches Shirt wird es? (${poll.mottoName})`, html };
  }
  function reminderMail(poll, person) {
    const link = `${base()}/abstimmung/${poll.id}?t=${person.token}`;
    const html = wrap(`<p>Hallo ${esc(person.name)},</p><p>kurze Erinnerung: die Abstimmung für <b>${esc(poll.mottoName)}</b> läuft noch bis <b>${fmtDate(poll.closes)}</b>. Deine Stimme fehlt noch.</p>${btn(link, 'Jetzt abstimmen')}<p style="color:#666;font-size:13px">Falls der Knopf nicht geht: ${link}</p>`);
    return { subject: `Erinnerung: Abstimmung ${poll.mottoName}`, html };
  }
  function resultMail(poll) {
    const t = tally(poll);
    const rows = poll.designIds.map((d, i) => {
      const s = t.stat[d]; const win = t.winners.includes(d) ? ' style="font-weight:bold;color:#1b7f3b"' : '';
      return `<tr${win}><td style="padding:4px 10px 4px 0">Design ${i + 1}</td><td style="padding:4px 0">⭐ ${s.avg} · ${s.count} ${s.count === 1 ? 'Bewertung' : 'Bewertungen'}${t.winners.includes(d) ? ' 🏆' : ''}</td></tr>`;
    }).join('');
    const nv = nonVoters(poll).map(p => esc(p.name)).join(', ') || '–';
    const orgaLink = `${base()}/abstimmung/${poll.id}?t=${poll.orgaToken}`;
    const tie = t.winners.length > 1 ? `<p><b>Gleichstand</b> zwischen Design ${t.winners.map(d => poll.designIds.indexOf(d) + 1).join(' und ')} – das Orga-Team entscheidet.</p>` : '';
    const kom = t.comments.length ? `<p style="margin-top:14px"><b>Kommentare:</b></p><ul style="font-size:14px;color:#333;padding-left:18px">${t.comments.map(c => `<li>${esc(c.name)}: „${esc(c.text)}"</li>`).join('')}</ul>` : '';
    // Kommentare je Design
    const dcom = poll.designIds.map((d, i) => {
      const list = (t.designComments[d] || []);
      if (!list.length) return '';
      return `<p style="margin:12px 0 2px"><b>Zu Design ${i + 1}:</b></p><ul style="font-size:14px;color:#333;padding-left:18px;margin:0">${list.map(c => `<li>${esc(c.name)}: „${esc(c.text)}"</li>`).join('')}</ul>`;
    }).join('');
    // Meistgewuenschte Artikel
    const wc = wishTally(poll); const artL = articleList(poll);
    const wished = artL.map(a => ({ label: a.label, n: wc[a.key] || 0 })).filter(x => x.n > 0).sort((a, b) => b.n - a.n);
    const wish = wished.length ? `<p style="margin-top:14px"><b>Meistgewünschte Artikel:</b></p><ul style="font-size:14px;color:#333;padding-left:18px">${wished.map(w => `<li>${esc(w.label)}: ${w.n}×</li>`).join('')}</ul>` : '';
    const kons = poll.konsensDesignId ? `<p style="margin-top:14px">🎨 <b>Konsens-Design:</b> Aus euren Kommentaren wird gerade automatisch ein neues, verbessertes Design erstellt. Es taucht in Kürze in „Meine Designs" auf.</p>` : '';
    const html = wrap(`<p>Die Abstimmung für <b>${esc(poll.mottoName)}</b> ist beendet. Gewinner = bester Sterneschnitt.</p><table style="font-size:15px;margin:8px 0">${rows}</table>${tie}${kom}${dcom}${wish}${kons}<p style="color:#666;font-size:13px">Noch nicht abgestimmt hatten: ${nv}</p>${btn(orgaLink, 'Ergebnis ansehen')}`);
    return { subject: `Ergebnis der Abstimmung: ${poll.mottoName}`, html };
  }

  // ---------------- Versand (Kanaele abstrakt) ----------------
  async function mailTo(to, subject, html) {
    return sendMail({ apiKey: env.BREVO_API_KEY, from: env.MAIL_FROM, fromName: env.MAIL_FROM_NAME, to, subject, html });
  }
  // WhatsApp-Einzelnachricht (Phase 2 / 8b): bewusst NICHT implementiert. Kanal bleibt abstrakt -
  // erst wenn WA_TOKEN gesetzt ist, koennte hier ueber die Meta Cloud API gesendet werden.
  async function whatsappTo(person, kind, poll) {
    if (!env.WA_TOKEN || !env.WA_PHONE_ID) return { sent: false, reason: 'whatsapp-einzelversand-nicht-aktiv' };
    return { sent: false, reason: 'whatsapp-einzelversand-nicht-implementiert' };
  }
  async function sendInvites(poll) {
    const withMail = (poll.channels || []).includes('mail');
    const withWa = (poll.channels || []).includes('whatsapp');
    let i = 0;
    for (const p of poll.people) {
      try {
        if (withMail && p.email) { const m = inviteMail(poll, p); await mailTo(p.email, m.subject, m.html); p.sentAt = new Date().toISOString(); }
        if (withWa && p.phone) { const w = await whatsappTo(p, 'einladung', poll); if (!w.sent) p.error = w.reason; }
      } catch (e) { p.error = (e && e.message ? e.message : String(e)).slice(0, 160); }
      if (++i % 100 === 0) await new Promise(r => setTimeout(r, 1000)); // Brevo-Free: in Haeppchen
    }
  }
  function resultRecipients(poll) {
    const set = new Set();
    for (const p of poll.people) if (p.email && (p.role === 'orga' || poll.resultToAll)) set.add(p.email);
    if (poll.ownerEmail) set.add(poll.ownerEmail);
    return [...set];
  }
  async function sendResult(poll) {
    if (poll.resultSentAt) return;
    const m = resultMail(poll);
    for (const to of resultRecipients(poll)) { try { await mailTo(to, m.subject, m.html); } catch (e) { /* je Adresse, nie abbrechen */ } }
    poll.resultSentAt = new Date().toISOString();
  }
  // Fassung 89, Markus: "Ich habe auf Abstimmung beenden getippt und da ist erst mal nichts
  // passiert. Dann hat's gedauert, oben steht jetzt abgestimmt. Waere natuerlich schoen, dass
  // man einen Hinweis bekommt, dass erfolgreich irgendwas getan wurde."
  // Der Grund war dasselbe Muster wie beim Vorlagen-Knopf: closePoll hat auf die Erzeugung des
  // Konsens-Designs gewartet - ein bis zwei Minuten - und erst danach geantwortet. Im Browser
  // sieht das aus wie ein toter Knopf.
  // Jetzt wird die Abstimmung SOFORT geschlossen und beantwortet; das Konsens-Design entsteht
  // danach im Hintergrund. Sein Stand steht im Datensatz, damit die Seite ihn anzeigen kann:
  //   konsensLaeuft  - wird gerade gezeichnet
  //   konsensDesignId - fertig
  //   konsensFehler  - nicht geklappt, mit Grund. Frueher stand der nur im Protokoll, und
  //                    niemand erfuhr je, dass das versprochene Design gar nicht kam.
  async function closePoll(poll) {
    if (!poll.closed) poll.closed = new Date().toISOString();
    await writePoll(poll);
    konsensImHintergrund(poll.id);
    return poll;
  }

  // stillschweigend: beim Neuerzeugen von Hand geht KEINE zweite Ergebnis-Mail an die Gruppe.
  // Der Organisator hat den Knopf selbst gedrueckt und sieht das Ergebnis auf seiner Seite -
  // eine zweite Rundmail an alle Teilnehmer hat er damit nicht bestellt.
  async function konsensImHintergrund(pollId, opts = {}) {
    const melden = (p) => opts.stillschweigend ? Promise.resolve() : sendResult(p).catch(() => {});
    let poll = await readPoll(pollId);
    if (!poll || poll.konsensDesignId || poll.konsensLaeuft) { if (poll) await melden(poll); return; }
    if (typeof consensusDesign !== 'function') { await melden(poll); return; }
    poll.konsensLaeuft = new Date().toISOString();
    poll.konsensFehler = '';
    await writePoll(poll);
    try {
      const k = await consensusDesign(poll, tally(poll), { textile: opts.textile || '' });
      poll = await readPoll(pollId) || poll;
      if (k && k.designId) {
        poll.konsensDesignId = k.designId; poll.konsensNote = k.note || '';
        // Auf welchem Textil es entsteht und woher diese Angabe kommt - damit im Nachhinein
        // nachvollziehbar ist, warum ein Design hell oder dunkel geworden ist.
        poll.konsensTextil = k.textil || '';
        poll.konsensTextilQuelle = k.textilQuelle || '';
      }
      else poll.konsensFehler = 'Es kam kein Design zurueck.';
    } catch (e) {
      poll = await readPoll(pollId) || poll;
      poll.konsensFehler = (e && e.message ? e.message : String(e)).slice(0, 200);
      console.error('Konsens-Design:', poll.konsensFehler);
    }
    poll.konsensLaeuft = '';
    await writePoll(poll);
    // Die Ergebnis-Mail erst jetzt: dann steht das Konsens-Design schon drin.
    if (opts.stillschweigend) return;
    await sendResult(poll).catch((e) => console.error('Ergebnis-Mail:', e && e.message ? e.message : e));
  }

  // ---------------- API: Abstimmung anlegen ----------------
  app.post('/api/mo/abstimmung', async (req, res) => {
    const who = await identify(req, res);
    const owner = ownerKey(who);
    if (!owner) return res.status(401).json({ error: 'nicht angemeldet' });
    const body = req.body || {};
    const motto = await mottos.get(String(body.motto || ''));
    if (!motto) return res.status(400).json({ error: 'unbekanntes Motto' });
    // 1. Okt.: nur Gruppen-Mottos (gruppen-mottos.json) - fuer Opa oder den Geburtstag stimmt niemand ab
    if (istGruppenMotto && !istGruppenMotto(motto.slug)) return res.status(400).json({ error: 'Eine Abstimmung gibt es nur bei Mottos für Gruppen.' });
    const mine = await ownedDesigns(who);
    let designIds = Array.isArray(body.designIds) ? body.designIds.map(String) : [];
    // nur eigene Designs desselben Mottos
    const valid = [];
    for (const d of designIds) {
      if (!mine.includes(d)) continue;
      const job = await readJob(d);
      if (job && job.motto === motto.slug) valid.push({ id: d, textile: job.textile || 'dunkel', style: job.style || 'standard', people: job.people || [] });
    }
    if (valid.length < 2) return res.status(400).json({ error: 'mindestens 2 eigene Designs dieses Mottos noetig' });

    // Teilnehmer aus den Design-Jobs zusammenfuehren (dedupe nach E-Mail/Handy/Name)
    const seen = new Set(), people = [];
    for (const v of valid) for (const p of v.people) {
      const key = p.email ? 'e:' + p.email : (p.phone ? 'p:' + p.phone : 'n:' + String(p.name).toLowerCase());
      if (seen.has(key)) continue; seen.add(key);
      people.push({ name: p.name, email: p.email || null, phone: p.phone || null, role: p.role || 'teilnehmer', token: rnd(16), sentAt: null, remindedAt: null, ratings: {}, comment: '', designComments: {}, wishes: [], votedAt: null, error: null });
    }

    const days = [2, 3, 5, 7].includes(+body.days) ? +body.days : 3;
    const channels = Array.isArray(body.channels) ? body.channels.filter(c => ['gruppe', 'mail', 'whatsapp'].includes(c)) : ['gruppe'];
    const ownerEmail = who.user && who.user.email ? String(who.user.email).toLowerCase() : null;
    const poll = {
      id: 'AB-' + rnd(4).toUpperCase().slice(0, 8),
      motto: motto.slug, mottoName: motto.name || motto.slug,
      designIds: valid.map(v => v.id),
      designTextile: Object.fromEntries(valid.map(v => [v.id, v.textile])),
      designStyle: Object.fromEntries(valid.map(v => [v.id, v.style])),
      owner, ownerEmail,
      created: new Date().toISOString(),
      closes: new Date(now() + days * DAY).toISOString(),
      closed: false,
      channels, resultToAll: body.resultToAll !== false,
      groupToken: rnd(16), orgaToken: rnd(16),
      people, groupVotes: [],
      remind24Sent: false, resultSentAt: null
    };
    await writePoll(poll);
    // Einladungen versenden (nicht blockierend fuer die Antwort)
    sendInvites(poll).then(() => writePoll(poll)).catch(e => console.error('Abstimmung-Einladungen:', e && e.message ? e.message : e));

    const orgaLink = `${base()}/abstimmung/${poll.id}?t=${poll.orgaToken}`;
    const gruppenLink = `${base()}/a/${poll.id}/${poll.groupToken}`;
    console.log('Abstimmung angelegt:', poll.id, '·', poll.designIds.length, 'Designs ·', people.length, 'Teilnehmer');
    // Fassung 74: Mit oder ohne Einladungsliste angelegt? Das entscheidet, welcher Weg gebaut
    // werden muss - der offene Gruppenlink oder die Liste mit Erinnerungen.
    zaehl('abstimmung', people.length ? 'angelegt-mit-liste' : 'angelegt-offen');
    res.json({ ok: true, pollId: poll.id, orgaLink, gruppenLink, teilnehmer: people.length, orgaEmpfaenger: resultRecipients(poll).length });
  });

  // Status (Orga)
  app.get('/api/mo/abstimmung/:pollId', async (req, res) => {
    const poll = await readPoll(req.params.pollId);
    if (!poll) return res.status(404).json({ error: 'nicht gefunden' });
    if (req.query.t !== poll.orgaToken) return res.status(403).json({ error: 'kein Zugang' });
    const t = tally(poll);
    res.json({
      ok: true, pollId: poll.id, mottoName: poll.mottoName, closes: poll.closes, closed: poll.closed,
      teilnehmer: poll.people.length, abgestimmt: t.votedNames.size, abgestimmtNamen: t.votedList,
      stat: t.stat, winners: t.winners, comments: t.comments,
      designs: poll.designIds.map((d, i) => ({ designId: d, nr: i + 1, style: styleLabel(poll.designStyle[d]), img: mockupUrl(d, poll.designTextile[d], pollExp(poll)) })),
      offen: nonVoters(poll).map(p => p.name),
      gruppenLink: `${base()}/a/${poll.id}/${poll.groupToken}`,
      orgaLink: `${base()}/abstimmung/${poll.id}?t=${poll.orgaToken}`,
      channels: poll.channels
    });
  });

  // Erinnerung an Nicht-Abstimmer (max 1x/24h)
  app.post('/api/mo/abstimmung/:pollId/erinnern', async (req, res) => {
    const poll = await readPoll(req.params.pollId);
    if (!poll) return res.status(404).json({ error: 'nicht gefunden' });
    if (req.query.t !== poll.orgaToken) return res.status(403).json({ error: 'kein Zugang' });
    if (poll.closed) return res.status(409).json({ error: 'Abstimmung beendet' });
    if (poll.lastManualRemind && now() - new Date(poll.lastManualRemind).getTime() < DAY) return res.status(429).json({ error: 'schon in den letzten 24h erinnert' });
    let n = 0;
    for (const p of nonVoters(poll)) {
      if (!p.email || !(poll.channels || []).includes('mail')) continue;
      try { const m = reminderMail(poll, p); await mailTo(p.email, m.subject, m.html); p.remindedAt = new Date().toISOString(); n++; } catch (e) { /* egal */ }
    }
    poll.lastManualRemind = new Date().toISOString();
    await writePoll(poll);
    res.json({ ok: true, erinnert: n, offen: nonVoters(poll).map(p => p.name) });
  });

  // Vorzeitig schliessen
  app.post('/api/mo/abstimmung/:pollId/schliessen', async (req, res) => {
    const poll = await readPoll(req.params.pollId);
    if (!poll) return res.status(404).json({ error: 'nicht gefunden' });
    if (req.query.t !== poll.orgaToken) return res.status(403).json({ error: 'kein Zugang' });
    const schonZu = !!poll.closed;
    await closePoll(poll);
    res.json({
      ok: true, closed: poll.closed, schonZu,
      winners: tally(poll).winners,
      konsens: typeof consensusDesign === 'function' ? 'laeuft' : 'aus'
    });
  });

  // Konsens-Design noch einmal erzeugen lassen.
  // Fassung 90, Markus am 18. Sept.: "So ist das neue erzeugte Design gekommen. Das macht
  // gerade keinen Spasz." Es war dunkelblau auf schwarzem Shirt - unsichtbar. Die neue
  // Kontrastmessung faengt so etwas ab, aber das bereits gespeicherte Design blieb stehen, und
  // ein zweiter Lauf war nicht vorgesehen: konsensDesignId ist gesetzt, also endet
  // consensusDesign sofort. Genau einmal je Abstimmung war richtig, solange es gut ging - und
  // falsch an dem Tag, an dem eines davon unbrauchbar war.
  // Das alte Design wird NICHT geloescht. Es liegt weiter in "Meine Designs"; nur die
  // Abstimmung zeigt danach auf das neue.
  app.post('/api/mo/abstimmung/:pollId/konsens-neu', async (req, res) => {
    const poll = await readPoll(req.params.pollId);
    if (!poll) return res.status(404).json({ error: 'nicht gefunden' });
    if (req.query.t !== poll.orgaToken) return res.status(403).json({ error: 'kein Zugang' });
    if (typeof consensusDesign !== 'function') return res.status(503).json({ error: 'Konsens-Design ist auf diesem Server nicht eingeschaltet' });
    if (poll.konsensLaeuft) return res.json({ ok: true, laeuft: true, schonUnterwegs: true });
    // Textil ausdruecklich waehlbar. Ohne Angabe gilt weiter das Textil des Gewinner-Designs.
    const textile = TEXTILTOENE.includes(req.query.textil) ? req.query.textil : '';
    const vorher = poll.konsensDesignId || '';
    poll.konsensDesignId = '';
    poll.konsensNote = '';
    poll.konsensFehler = '';
    await writePoll(poll);
    // Im Hintergrund, wie beim Schliessen - der Knopf darf nicht zwei Minuten haengen.
    konsensImHintergrund(poll.id, { stillschweigend: true, textile });
    res.json({ ok: true, laeuft: true, vorher, textil: textile || 'wie das Gewinner-Design' });
  });

  // ---------------- Abstimmen (Teilnehmer, ohne Login) ----------------
  // Kandidaten + Stand fuer die Abstimmungsseite. t = persoenlicher Token | Gruppen-Token | Orga-Token.
  app.get('/api/mo/abstimmung/:pollId/kandidaten', async (req, res) => {
    const poll = await readPoll(req.params.pollId);
    if (!poll) return res.status(404).json({ error: 'nicht gefunden' });
    const t = String(req.query.t || '');
    let mode = null, person = null;
    if (t && t === poll.orgaToken) mode = 'orga';
    else if (t && t === poll.groupToken) mode = 'gruppe';
    else { person = (poll.people || []).find(p => p.token === t); if (person) mode = 'personal'; }
    if (!mode) return res.status(403).json({ error: 'Link ungültig oder abgelaufen' });

    const expired = poll.closed || now() >= new Date(poll.closes).getTime();
    const tal = tally(poll);
    const exp = pollExp(poll);
    const reveal = expired || mode === 'orga';
    const out = {
      ok: true, mode, pollId: poll.id, mottoName: poll.mottoName, mottoSlug: poll.motto, closes: poll.closes, closed: !!poll.closed, expired,
      candidates: poll.designIds.map((d, i) => ({
        designId: d, nr: i + 1, style: styleLabel(poll.designStyle[d]), img: mockupUrl(d, poll.designTextile[d], exp),
        comments: reveal ? (tal.designComments[d] || []) : null
      })),
      stat: tal.stat, winners: reveal ? tal.winners : null,
      teilnehmer: poll.people.length, abgestimmt: tal.votedNames.size,
      comments: reveal ? tal.comments : null,
      articles: articleList(poll)
    };
    if (mode === 'personal') { out.voterName = person.name; out.myRatings = person.ratings || {}; out.myComment = person.comment || ''; out.myWishes = wishesOf(person); out.myDesignComments = designCommentsOf(person); }
    if (mode === 'gruppe') { out.people = poll.people.map(p => p.name); out.abgestimmtNamen = tal.votedList; }
    if (mode === 'orga') {
      const votedLc = tal.votedNames;
      // Eingeladene mit Status (abgestimmt / offen)
      out.eingeladen = (poll.people || []).map(p => ({ name: p.name, done: votedLc.has(String(p.name).toLowerCase()) }));
      out.offen = nonVoters(poll).map(p => p.name);
      // Alle, die abgestimmt haben (Namen), inkl. Gruppen-Link-Abstimmer, die nicht auf der Einladungsliste stehen
      out.abgestimmtNamen = tal.votedList;
      const invitedLc = new Set((poll.people || []).map(p => String(p.name).toLowerCase()));
      out.extraAbstimmer = tal.votedList.filter(n => !invitedLc.has(String(n).toLowerCase()));
      out.gruppenLink = `${base()}/a/${poll.id}/${poll.groupToken}`; out.orgaToken = poll.orgaToken; out.wishStat = wishTally(poll); out.konsensDesignId = poll.konsensDesignId || null; out.konsensLaeuft = !!poll.konsensLaeuft; out.konsensFehler = poll.konsensFehler || ''; out.konsensTextil = poll.konsensTextil || ''; out.konsensTextilQuelle = poll.konsensTextilQuelle || '';
      // Fassung 90 (Markus, 18. Sept.: "Er sagt mir, dass er es gemacht hat, zeigt es aber
      // nicht."): Der Kasten meldete "ist fertig" und verwies auf "Meine Designs" - ein fertiges
      // Bild anzukuendigen, statt es hinzustellen. Dabei liegt es genau denselben Weg entfernt
      // wie die Entwuerfe darueber, die ihr Bild seit jeher zeigen.
      out.konsensImg = poll.konsensDesignId ? mockupUrl(poll.konsensDesignId, poll.konsensTextil || 'dunkel', exp) : '';
      // Fassung 74: Wer hat wie bewertet - eine Zeile je Person, eine Spalte je Design.
      out.tafel = bewerterTafel(poll);
    }
    res.json(out);
  });

  // Stimme abgeben: Sterne (1-5) je Design, Kommentar je Design, Gesamt-Kommentar und/oder Artikel-Wuensche.
  // Jedes Design einzeln bewertbar (Mehrfachauswahl).
  app.post('/api/mo/abstimmung/:pollId/stimme', async (req, res) => {
    const poll = await readPoll(req.params.pollId);
    if (!poll) return res.status(404).json({ error: 'nicht gefunden' });
    const body = req.body || {};
    const t = String(body.t || '');
    const designId = body.designId != null ? String(body.designId) : null;
    const stars = body.stars != null ? Math.round(+body.stars) : null;      // 1-5, 0 = zurücknehmen
    const comment = body.comment != null ? String(body.comment).slice(0, 500) : null;
    const dcomment = body.dcomment != null ? String(body.dcomment).slice(0, 300) : null; // Kommentar zu genau diesem Design
    const wishes = Array.isArray(body.wishes) ? body.wishes.map(String) : null;           // gewuenschte Artikel-Keys
    if (designId !== null && !poll.designIds.includes(designId)) return res.status(400).json({ error: 'unbekanntes Design' });
    if (stars !== null && !(stars >= 0 && stars <= 5)) return res.status(400).json({ error: 'ungültige Sternzahl' });
    if ((dcomment !== null) && designId === null) return res.status(400).json({ error: 'Design-Kommentar ohne Design' });
    if (poll.closed || now() >= new Date(poll.closes).getTime()) return res.status(409).json({ error: 'Abstimmung beendet', stat: tally(poll).stat });

    let target;
    if (t === poll.groupToken) {
      const name = String(body.name || '').trim().slice(0, 40);
      if (!name) return res.status(400).json({ error: 'Bitte deinen Namen angeben' });
      const known = (poll.people || []).find(p => p.name.toLowerCase() === name.toLowerCase());
      target = (poll.groupVotes = poll.groupVotes || []).find(x => x.name.toLowerCase() === name.toLowerCase());
      if (!target) { target = { name: known ? known.name : name, ratings: {}, comment: '', designComments: {}, wishes: [], votedAt: null, fingerprint: (req.headers['x-forwarded-for'] || '').toString().split(',')[0] || null }; poll.groupVotes.push(target); }
    } else {
      target = (poll.people || []).find(p => p.token === t);
      if (!target) return res.status(403).json({ error: 'Link ungültig' });
    }
    target.ratings = target.ratings || {};
    target.designComments = target.designComments || {};
    const touch = () => { target.votedAt = new Date().toISOString(); };
    if (designId !== null && stars !== null) { if (stars === 0) delete target.ratings[designId]; else target.ratings[designId] = stars; touch(); }
    if (dcomment !== null) { if (dcomment) target.designComments[designId] = dcomment; else delete target.designComments[designId]; touch(); }
    if (comment !== null) { target.comment = comment; touch(); }
    if (wishes !== null) { const allowed = new Set(articleList(poll).map(a => a.key)); target.wishes = wishes.filter(w => allowed.has(w)).slice(0, 20); touch(); }

    await writePoll(poll);
    // Fassung 74: Wird ueberhaupt abgestimmt, und ueber welchen Weg? Nur der Weg wird gezaehlt
    // (Gruppenlink oder persoenlicher Link) - kein Name, keine Sternzahl, kein Kommentar.
    zaehl('abstimmung', t === poll.groupToken ? 'stimme-gruppenlink' : 'stimme-einladung');
    const tal = tally(poll);
    // Alle Teilnehmer haben bewertet -> schliessen (nur bei Teilnehmerliste)
    if (poll.people.length > 0 && tal.votedNames.size >= poll.people.length) { await closePoll(poll); }
    res.json({ ok: true, stat: tal.stat, my: { ratings: target.ratings, comment: target.comment || '', designComments: target.designComments || {}, wishes: target.wishes || [] }, closed: !!poll.closed });
  });

  // Meine Abstimmungen (Konto-Seite)
  app.get('/api/mo/meine-abstimmungen', async (req, res) => {
    const who = await identify(req, res);
    if (!ownerKey(who)) return res.json({ polls: [] });
    let files = [];
    try { files = await fs.readdir(DIR); } catch (e) { return res.json({ polls: [] }); }
    const out = [];
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const poll = await readPoll(f.replace(/\.json$/, ''));
      if (!poll || !ownerMatches(poll, who)) continue;
      const t = tally(poll);
      out.push({
        pollId: poll.id, mottoName: poll.mottoName, created: poll.created, closes: poll.closes, closed: poll.closed,
        teilnehmer: poll.people.length, abgestimmt: t.votedNames.size,
        orgaLink: `${base()}/abstimmung/${poll.id}?t=${poll.orgaToken}`,
        gruppenLink: `${base()}/a/${poll.id}/${poll.groupToken}`
      });
    }
    out.sort((a, b) => (b.created || '').localeCompare(a.created || ''));
    res.json({ polls: out });
  });

  // Eigene Designs eines Mottos (fuer den "Zur Abstimmung schicken"-Block)
  app.get('/api/mo/abstimmung-designs', async (req, res) => {
    const who = await identify(req, res);
    const slug = String(req.query.motto || '');
    const mine = await ownedDesigns(who);
    const exp = now() + 30 * DAY;
    const out = [];
    for (const d of mine) {
      const job = await readJob(d);
      if (!job || job.motto !== slug) continue;
      out.push({ designId: d, style: styleLabel(job.style), img: mockupUrl(d, job.textile || 'dunkel', exp), created: job.created || null });
    }
    out.sort((a, b) => (b.created || '').localeCompare(a.created || ''));
    res.json({ designs: out });
  });

  // ---------------- Seiten ----------------
  const page = () => path.resolve('abstimmung.html');
  const sendPage = (req, res) => { res.set('Cache-Control', 'no-cache, must-revalidate'); res.sendFile(page()); };
  app.get('/abstimmung/:pollId', sendPage);
  app.get('/a/:pollId/:groupToken', sendPage);

  // ---------------- Automatik: Erinnerung, Schliessen, Ergebnis, Loeschung ----------------
  async function tick() {
    let files = [];
    try { files = await fs.readdir(DIR); } catch (e) { return; }
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const poll = await readPoll(f.replace(/\.json$/, ''));
      if (!poll) continue;
      try {
        const closesMs = new Date(poll.closes).getTime();
        // 90 Tage nach Ende loeschen (Datenschutz)
        const endMs = poll.closed ? new Date(poll.closed).getTime() : closesMs;
        if (now() - endMs > 90 * DAY) { await fs.rm(file(poll.id), { force: true }); continue; }
        if (!poll.closed) {
          if (now() >= closesMs) { await closePoll(poll); continue; }
          // Erinnerung 24h vor Frist (automatisch, einmalig)
          if (!poll.remind24Sent && closesMs - now() <= DAY) {
            let n = 0;
            for (const p of nonVoters(poll)) {
              if (!p.email || !(poll.channels || []).includes('mail')) continue;
              try { const m = reminderMail(poll, p); await mailTo(p.email, m.subject, m.html); p.remindedAt = new Date().toISOString(); n++; } catch (e) { /* egal */ }
            }
            poll.remind24Sent = true; await writePoll(poll);
            if (n) console.log('Abstimmung', poll.id, '- 24h-Erinnerung an', n);
          }
        }
      } catch (e) { console.error('Abstimmung-Tick', poll.id, e && e.message ? e.message : e); }
    }
  }
  setInterval(() => tick().catch(e => console.error('Abstimmung-Automatik:', e && e.message ? e.message : e)), 10 * 60 * 1000);

  return { tick, tally, readPoll };
}
