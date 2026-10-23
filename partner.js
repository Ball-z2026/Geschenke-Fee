// partner.js - Partner (Gastronom, Betrieb, Verein): eigener Bereich, eigener kleiner Shop
// =============================================================================================
// Markus, 2. Okt. 2026: "Die Bereiche EAST, Luigi und alle, die noch dazukommen, muessen selber
// einen Login-Bereich bekommen, wo sie eigenstaendig einstellen koennen, was die Leute kaufen
// koennen, wie das gestaltet ist etc. Das muss viel viel einfacher werden ... Foto hochladen, ein
// kleines Textfeld, was drauf soll, automatisiert das Logo vom Partner, dann vielleicht auch nur
// zwei oder drei Stile zur Auswahl ... Er muss auch die Moeglichkeit haben, ein Logo hochzuladen.
// ... Wir muessten irgendwo eine Seite erschaffen, wo die Partner gesucht werden koennen und wo
// es die Moeglichkeit gibt, dass Partner sich eigenstaendig anmelden koennen - so was wie
// Partner werden." Und: "Ziel ist es, dass wir es auch schaffen, fuer den Gastronom, fuer den
// Partner, fuer den Verein sozusagen einen kleinen Merchandising-Shop direkt mit anbieten."
//
// EIN Partner = EIN Freigabe-Eintrag, wie EAST26 und Luigi in postkarte/firmen-freigaben.json.
// Neu ist nur, WO er liegt: was ein Partner selbst anlegt oder einstellt, liegt auf dem VOLUME
// (storage/partner/<slug>.json), denn nur dort ueberlebt es den naechsten Deploy. Zwei Arten:
//   - EIGENER Partner (selbst angemeldet): der ganze Eintrag liegt hier.
//   - Partner aus dem REPO (EAST26, Luigi): hier liegt nur, was er selbst einstellt (Angebot,
//     Stile, Anzeigename, Zugang, eigenes Logo) - es wird ueber den Repo-Eintrag gelegt.
// Der Server liest beides zusammen (zusammenfuehren) - alle Wege, die heute schon Freigaben
// kennen (Tor, Logo, Haus-Textil, Lizenz), kennen damit auch die Partner.
//
// FREIGABE: wer sich selbst anmeldet, erklaert, dass er fuer den Betrieb handeln darf, und gibt
// Logo und Namen frei (Haekchen, Wortlaut in ERKLAERUNG). Live geht der Eintrag erst, wenn die
// E-Mail bestaetigt ist (Anmelde-Link). Ein Name, den die Markensperre kennt, geht nicht von
// allein live (Status "pruefen") - sonst meldet sich jemand als "Adidas" an.
// =============================================================================================

import fs from 'node:fs/promises';
import path from 'node:path';

/** Die Teile, die ein Partner in seinem Shop anbieten kann (Kennung des Tors -> Katalog). */
export const SHOP_TEILE = [
  { id: 'tee', artikel: 'tshirt', flaeche: 'vorne', textil: true },
  { id: 'hoodie', artikel: 'hoodie', flaeche: 'vorne', textil: true },
  { id: 'kissen', artikel: 'kissen', flaeche: '40x40' },
  { id: 'poster', artikel: 'poster', flaeche: 'a2' },
  { id: 'strandtuch', artikel: 'strandtuch', flaeche: '70x140' },
  { id: 'acrylbild', artikel: 'acrylbild', flaeche: 'a4' },
  { id: 'fussmatte', artikel: 'fussmatte', flaeche: '60x40' }
];
/** Stile, die fuer die Artikel taugen (keine nurMotto-Stile, kein "Wie vorgesehen"). */
// 4. Okt., Markus: "das Logo vorne gross mit Standort und dann ... im East Restaurant mein Lieblingsrestaurant. Bei
// Luigi ist es ein Pizzawagen, sprich meine Lieblingspizza, beim Elbdeich ist es ein Hofladen, mein Lieblingshofladen,
// so dass wir dort diese Regel irgendwo einfuehren." Der Satz der schlichten Linie: was der Partner selbst eintraegt
// (lieblings), sonst aus der Art des Betriebs (gewerk, dann art). Reihenfolge zaehlt: "Pizzeria" vor "Restaurant",
// "Restaurant und Bar" bleibt ein Restaurant.
export const LIEBLINGS_REGELN = [
  [/pizz/i, 'Meine Lieblingspizza'],
  [/hofladen|hof\b|bauernhof|obsthof/i, 'Mein Lieblingshofladen'],
  [/eis(diele|cafe|caf\u00e9)|gelat/i, 'Meine Lieblingseisdiele'],
  [/b\u00e4cker|baecker|backstube/i, 'Meine Lieblingsb\u00e4ckerei'],
  [/caf\u00e9|cafe|kaffee/i, 'Mein Lieblingscaf\u00e9'],
  [/imbiss|currywurst|d\u00f6ner|doener|burger/i, 'Mein Lieblingsimbiss'],
  [/strandbar|beach/i, 'Meine Lieblingsstrandbar'],
  [/weingut|winzer/i, 'Mein Lieblingsweingut'],
  [/brauerei|brauhaus/i, 'Meine Lieblingsbrauerei'],
  [/hotel|pension|gasthof|gasthaus/i, 'Mein Lieblingshotel'],
  [/restaurant|ristorante|trattoria|osteria|bistro|taverna|tapas|grill|steakhaus/i, 'Mein Lieblingsrestaurant'],
  [/\bbar\b|kneipe|pub|cocktail/i, 'Meine Lieblingsbar'],
  [/friseur|salon/i, 'Mein Lieblingsfriseur'],
  [/verein|club|klub/i, 'Mein Lieblingsverein']
];
export function lieblingsSatz(e = {}) {
  const eigen = String(e.lieblings || '').replace(/\s+/g, ' ').trim();
  if (eigen) return eigen.slice(0, 40);
  const quelle = [e.gewerk, e.was && String(e.was).slice(0, 80)].filter(Boolean).join(' ');
  for (const [re, satz] of LIEBLINGS_REGELN) if (re.test(quelle)) return satz;
  if (e.art === 'verein') return 'Mein Lieblingsverein';
  if (e.gastro || e.art === 'gastro') return 'Mein Lieblingsrestaurant';
  return 'Mein Lieblingsort';
}
// 5. Okt., Markus (Bild vom EAST26-Weg: "z. B. Unser Stammtisch mit Pizza und Vespa, darunter 'Luigis Crew 2026'"):
// "passt natuerlich ueberhaupt nicht - das muss immer zum Partner passen". Das Beispiel unter "Was soll drauf?"
// kommt aus Name, Ort und Art des Partners (dieselben Regeln wie der Lieblings-Satz).
export function motivBeispiel(e = {}) {
  const name = String(e.anzeige || e.firma || '').trim() || 'euch';
  const ort = String(e.ort || '').trim();
  const satz = lieblingsSatz(e);
  const anlass = /pizza/i.test(satz) ? 'Unser Pizzaabend bei ' + name
    : /hofladen/i.test(satz) ? 'Unser Ausflug zu ' + name
    : /verein/i.test(satz) ? 'Unser Team von ' + name
    : /restaurant|bar|caf|imbiss|eisdiele|weingut|brauerei|b\u00e4ckerei/i.test(satz) || e.gastro ? 'Unser Abend im ' + name
    : 'Unser Besuch bei ' + name;
  return 'z. B. ' + anlass + (ort ? ", darunter '" + ort + " " + new Date().getFullYear() + "'" : '');
}
export const SHOP_STILE = ['aquarell', 'comic', 'popart', 'vintage', 'fotoreal', 'minimal', 'streetart', 'tattoo', 'japan', 'college', 'meisterwerk', 'neon', 'robotic', 'glitzer', 'disco', 'totenkopf', 'skandifolk'];
// 2. Okt., Markus (bei EAST26 und Luigi standen Aquarell, Comic, Graffiti): "Wir sollten Aquarell, Meisterwerk,
// Minimalistic und Pop Art nehmen." Die Vorgabe sind vier, und vier duerfen es sein. Am selben Tag, zum Hoodie in
// Minimal: "Das ist haesslich. Ich glaube, Minimalistic ist nichts ... wir nehmen den Glitzer Stil anstatt." 
export const STANDARD_STILE = ['aquarell', 'meisterwerk', 'glitzer', 'popart'];
export const MAX_STILE = 4;
export const KUECHEN = ['', 'italian', 'greek', 'spanish', 'turkish', 'french', 'german', 'croatian', 'portuguese', 'mexican', 'chinese', 'japanese', 'thai', 'vietnamese', 'indian'];

// 2. Okt., Markus: "Die Lizenzvereinbarung koennen wir doch, wenn jemand Partner werden will, mit
// anhaengen - die soll er einmal bestaetigen." Der Text steht in partner-vereinbarung.html
// (/partner/vereinbarung). Wer bestaetigt, bekommt die Standard-Lizenz: 20 % vom Netto jedes
// Artikels mit seinem Logo (lizenzen.js zahlt sie per Stripe aus) -
// derselbe Satz wie bei EAST26 (Markus, 1. Okt.: "die 20 % an den Gastronom oder wer auch immer
// mitmacht"). Neue Fassung = FASSUNG hochzaehlen; alte Bestaetigungen bleiben mit ihrer Fassung stehen.
export const VEREINBARUNG = { fassung: '1', stand: '2. Oktober 2026' };
// 2. Okt., Markus: "Ich wuerde noch eine Design-Gebuehr einrichten: wenn der Kunde das nicht selber
// hinbekommt, dass wir fuer 99 Euro ihm alle Wunsch-Designs fertig machen." Einmalig, an uns.
// Und: "Fuer Firmen ist der Preis natuerlich netto zuzueglich der Mehrwertsteuer." Also 99 Euro netto,
// bezahlt wird brutto (cents). Der Satz steht hier fest (19 %), wie in preise.cjs.
export const MWST = 0.19;
export const DESIGN_SERVICE = { nettoCents: 9900, cents: Math.round(9900 * (1 + MWST)), name: 'Design-Service fuer deinen Partnershop (99 Euro zzgl. 19 % MwSt.)' };
export const LIZENZ_STANDARD = { prozent: 20, artikel: true };
export function vereinbarungEintrag(jetzt = new Date()) {
  return {
    vereinbarung: { fassung: VEREINBARUNG.fassung, bestaetigt: jetzt.toISOString() },
    lizenz: { ...LIZENZ_STANDARD, seit: jetzt.toISOString().slice(0, 10), vermerk: 'Partner- und Lizenzvereinbarung Fassung ' + VEREINBARUNG.fassung + ', bestaetigt ' + jetzt.toISOString().slice(0, 10) }
  };
}

export const ERKLAERUNG = 'Ich handle fuer diesen Betrieb bzw. Verein und darf ihn vertreten. Ich gebe Motto Otto frei, Namen und Logo auf Artikeln zu verwenden, die Gaeste und Mitglieder ueber unsere Seite gestalten und kaufen. Die Freigabe kann ich jederzeit im Partnerbereich beenden.';

/** Wie firmenSlug im Server: klein, nur a-z 0-9 _ - (Leerzeichen und Apostroph fallen weg). */
export function slugVon(name) { return String(name || '').toLowerCase().replace(/[^a-z0-9_-]/g, ''); }
const kern = (s) => slugVon(s).replace(/[-_]/g, '');
/**
 * Die Adresse eines NEUEN Partners: nur a-z und 0-9, Umlaute ausgeschrieben ("Café Müller" ->
 * "cafemueller"). So passt sie ueberall, wo der Server heute Firmen-Adressen baut: /bei/<slug>,
 * /api/mo/firmenlogo/<slug>.png und das Haus-Logo fr_<slug>.png (das nimmt nur a-z0-9).
 */
export function partnerSlug(name) {
  return String(name || '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '').slice(0, 40);
}

const text = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const hex = (v) => (/^#[0-9a-f]{6}$/i.test(String(v || '').trim()) ? String(v).trim().toUpperCase() : '');
const mail = (v) => { const t = String(v || '').trim().toLowerCase(); return /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i.test(t) && t.length <= 120 ? t : ''; };

/** Das Angebot eines Partners saeubern: was im Shop steht. Unbekanntes faellt weg. */
export function angebotSauber(a) {
  const ids = SHOP_TEILE.map(t => t.id);
  const teile = Array.isArray(a && a.teile) ? [...new Set(a.teile.map(String))].filter(t => ids.includes(t)) : ids.slice();
  return { teile };
}
/** Hoechstens vier Stile (MAX_STILE), nur aus der Liste, mindestens einer. */
export function stileSauber(s) {
  const l = Array.isArray(s) ? [...new Set(s.map(String))].filter(x => SHOP_STILE.includes(x)).slice(0, MAX_STILE) : [];
  return l.length ? l : STANDARD_STILE.slice();
}

/** Die Einstellungen, die ein Partner selbst aendern darf - und nur die. */
export function einstellungenSauber(b = {}) {
  const out = {};
  if (b.anzeige !== undefined) out.anzeige = text(b.anzeige, 60);
  if (b.farbe !== undefined) out.farben = hex(b.farbe) ? [hex(b.farbe)] : [];
  if (b.webseite !== undefined) { const w = text(b.webseite, 120).replace(/^https?:\/\//i, ''); out.webseite = w && /^[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(w) ? 'https://' + w : ''; }
  if (b.gastro !== undefined) out.gastro = !!b.gastro;
  if (b.kueche !== undefined) out.kueche = KUECHEN.includes(String(b.kueche)) ? String(b.kueche) : '';
  if (b.angebot !== undefined) out.angebot = angebotSauber(b.angebot);
  if (b.stile !== undefined) out.stile = stileSauber(b.stile);
  return out;
}

/**
 * Die Selbst-Anmeldung pruefen. Reine Rechnung. Rueckgabe { ok, fehler } oder { ok, eintrag }.
 * Die Anschrift wird erst im Server verortet (Nominatim) - hier nur, ob sie da ist.
 */
export function anmeldungPruefen(b = {}, { vergeben = [] } = {}) {
  const anzeige = text(b.name, 60);
  if (anzeige.length < 2) return { ok: false, fehler: 'Bitte den Namen eintragen, unter dem euch die Leute kennen.' };
  const firma = text(b.firma, 100) || anzeige;
  const slug = partnerSlug(anzeige);
  if (slug.length < 2) return { ok: false, fehler: 'Der Name braucht Buchstaben oder Zahlen.' };
  if (vergeben.some(v => kern(v) === kern(slug))) return { ok: false, fehler: 'Diesen Namen gibt es schon. Bitte den Ort dazuschreiben, zum Beispiel "' + anzeige + ' ' + (text(b.ort, 40) || 'Hamburg') + '".' };
  const email = mail(b.email);
  if (!email) return { ok: false, fehler: 'Bitte eine gueltige E-Mail-Adresse eintragen - dorthin kommt der Anmelde-Link.' };
  const strasse = text(b.strasse, 100), plz = text(b.plz, 12), ort = text(b.ort, 60), land = text(b.land, 40) || 'Deutschland';
  if (!strasse || !ort) return { ok: false, fehler: 'Bitte Strasse und Ort eintragen - daran erkennt die Seite, dass ein Gast bei euch ist.' };
  if (b.erklaerung !== true && b.erklaerung !== 'ja') return { ok: false, fehler: 'Bitte die Freigabe bestaetigen.' };
  if (b.vereinbarung !== true && b.vereinbarung !== 'ja') return { ok: false, fehler: 'Bitte die Partner- und Lizenzvereinbarung bestaetigen.' };
  const s = einstellungenSauber({ webseite: b.webseite, gastro: b.gastro, kueche: b.kueche, farbe: b.farbe });
  return {
    ok: true,
    eintrag: {
      slug, firma, anzeige, email, emails: [email],
      adresse: strasse + ', ' + [plz, ort].filter(Boolean).join(' '), ort, land,
      webseite: s.webseite || '', gastro: !!s.gastro, kueche: s.kueche || '', farben: s.farben || [],
      art: ['gastro', 'betrieb', 'verein'].includes(String(b.art)) ? String(b.art) : (s.gastro ? 'gastro' : 'betrieb'),
      angebot: angebotSauber(null), stile: STANDARD_STILE.slice(),
      status: 'bestaetigen', quelle: 'selbst', erklaerung: ERKLAERUNG,
      ...vereinbarungEintrag()
    }
  };
}

/**
 * Repo-Freigaben und Partner-Ablage zu EINER Liste. Reine Rechnung.
 * - Ablage mit basis = Repo-Firma: Einstellungen ueber den Repo-Eintrag legen.
 * - Ablage ohne basis, Status "aktiv": als eigener Freigabe-Eintrag dazu.
 * - Alles andere (bestaetigen, pruefen, aus) kommt NICHT in die Liste - es ist nicht live.
 */
export function zusammenfuehren(repo = [], ablage = []) {
  const liste = repo.map(e => ({ ...e }));
  for (const p of ablage) {
    if (!p || !p.slug) continue;
    if (p.basis) {
      const i = liste.findIndex(e => kern(e.firma) === kern(p.basis));
      if (i < 0) continue;
      const e = liste[i];
      if (p.status === 'aus') { liste.splice(i, 1); continue; }
      liste[i] = {
        ...e,
        anzeige: p.anzeige || e.anzeige, angebot: p.angebot || e.angebot, stile: p.stile || e.stile,
        farben: (p.farben && p.farben.length) ? p.farben : e.farben,
        datei: p.datei || e.datei, gastro: p.gastro !== undefined ? p.gastro : e.gastro,
        kueche: p.kueche !== undefined ? p.kueche : e.kueche, webseite: p.webseite || e.webseite,
        // Eine Lizenz im Repo (EAST26) bleibt; sonst gilt die bestaetigte Vereinbarung des Partners.
        lizenz: e.lizenz || p.lizenz || undefined,
        partner: { slug: p.slug, emails: p.emails || [], vereinbarung: p.vereinbarung || null }
      };
      continue;
    }
    if (p.status !== 'aktiv') continue;
    if (liste.some(e => kern(e.firma) === kern(p.firma) || kern(e.firma) === kern(p.slug))) continue;   // nie einen Repo-Eintrag verdecken
    liste.push({
      firma: p.slug, anzeige: p.anzeige, namen: [p.anzeige, p.firma].filter(Boolean),
      ort: p.ort, land: p.land, adresse: p.adresse, punkt: p.punkt || undefined, radiusM: p.radiusM || 150,
      webseite: p.webseite || '', gastro: !!p.gastro, kueche: p.kueche || '', farben: p.farben || [],
      datei: p.datei || '', angebot: p.angebot, stile: p.stile, art: p.art, lizenz: p.lizenz || undefined,
      freigabe: { datum: String(p.aktivSeit || p.erstellt || '').slice(0, 10), von: p.firma, vermerk: 'Selbst angemeldet (Partner werden), E-Mail bestaetigt. ' + (p.erklaerung || ERKLAERUNG) },
      partner: { slug: p.slug, emails: p.emails || [], selbst: true, vereinbarung: p.vereinbarung || null }
    });
  }
  return liste;
}

/** Die Ablage auf dem Volume: storage/partner/<slug>.json, Logo-Mockups unter bilder/. */
export function partnerStore(STORE) {
  const dir = path.join(STORE, 'partner');
  const bilderDir = path.join(dir, 'bilder');
  const datei = (slug) => path.join(dir, slugVon(slug) + '.json');
  let cache = null, cacheBis = 0;
  async function alle() {
    if (cache && Date.now() < cacheBis) return cache;
    let namen = [];
    try { namen = (await fs.readdir(dir)).filter(n => n.endsWith('.json')); } catch (e) { namen = []; }
    const out = [];
    for (const n of namen) {
      try { out.push(JSON.parse(await fs.readFile(path.join(dir, n), 'utf8'))); }
      catch (e) { console.error('Partner lesen:', n, e && e.message ? e.message : e); }
    }
    cache = out; cacheBis = Date.now() + 3000;
    return out;
  }
  async function lesen(slug) { try { return JSON.parse(await fs.readFile(datei(slug), 'utf8')); } catch (e) { return null; } }
  async function speichern(p) {
    await fs.mkdir(dir, { recursive: true });
    p.geaendert = new Date().toISOString();
    await fs.writeFile(datei(p.slug), JSON.stringify(p, null, 2));
    cache = null;
    return p;
  }
  /** Die Partner, die zu dieser E-Mail gehoeren (eigene und Repo-Overlays). */
  async function vonEmail(email) {
    const m = mail(email);
    if (!m) return [];
    return (await alle()).filter(p => (p.emails || []).map(x => String(x).toLowerCase()).includes(m));
  }
  return { dir, bilderDir, alle, lesen, speichern, vonEmail, zusammenfuehren: (repo, ablage) => zusammenfuehren(repo, ablage) };
}
