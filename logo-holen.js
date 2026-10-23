// logo-holen.js - das Original-Logo einer Firma von ihrer eigenen Webseite holen
// =============================================================================================
// Markus, 22. Sept. 2026: "Wir muessen dann natuerlich eine Moeglichkeit haben, das Original-Logo
// von der Homepage runterzuziehen, sonst funktioniert es natuerlich nicht."
//
// Stimmt: eine Freigabe ohne Datei ist nur der halbe Weg. Hier ist der andere.
//
// Die Sperre bleibt, wo sie war: geholt wird NUR fuer Firmen, die in
// postkarte/firmen-freigaben.json stehen und deren Freigabe eingetragen ist. Das ist kein
// Absaugen fremder Webseiten, sondern das Abholen eines Logos, das wir benutzen duerfen.
// Woher es kam und wann, steht danach im Eintrag ("quelle", "geholt") - nachweisbar.
//
// Der Weg: Seite lesen -> Kandidaten einsammeln und BEWERTEN (reine Rechnung, die Abnahme
// rechnet sie ohne Netz nach) -> besten laden -> auf PNG mit Alphakanal bringen, Rand
// wegschneiden. Was nicht wie ein Logo aussieht (Foto im og:image, winziges Favicon), faellt
// hinten runter, statt als Logo auf einer Postkarte zu landen.
// =============================================================================================

import sharp from 'sharp';

/** Relative Adresse auf absolute bringen - ohne Netz, damit die Abnahme es nachrechnen kann. */
export function absolut(quelle, basis) {
  const s = String(quelle || '').trim();
  if (!s) return '';
  try { return new URL(s, basis).href; } catch (e) { return ''; }
}

/** Name auf das Wesentliche bringen, damit "dtf-express GmbH" und "DTF Express" sich treffen. */
export function kern(s) {
  return String(s || '').toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' }[c]))
    .replace(/\b(gmbh|ug|ag|kg|ohg|mbh|co|e\.?\s?k|inh|und|&)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '');
}

/**
 * Alle Logo-Kandidaten einer Seite, nach Eignung sortiert (bester zuerst).
 * Reine Rechnung auf dem HTML-Text - kein Netz, kein DOM.
 *
 * Erste Fassung bewertete nach dem Dateinamen ("logo" darin). An zwei echten Firmenseiten
 * gemessen ist das FALSCH, und zwar in beide Richtungen:
 *   - dtf-express.de: das Logo heisst "DTF-200_efc205a7...png" (kein "logo" im Namen), waehrend
 *     die Vertrauens-Siegelleiste "logo-bar__image" heisst - der Namensweg holte die Siegel.
 *   - cce-sportswear.de: alle Bilder heissen "image.php?id=2401" - da steht ueberhaupt nichts drin.
 * Auf BEIDEN Seiten steht das Logo aber an derselben Stelle: im ersten Bild, das in einem Link
 * auf die eigene Startseite haengt. Das ist das Muster, an dem man ein Logo erkennt, und danach
 * wird jetzt bewertet. Der Name zaehlt nur noch als Zusatz.
 */
export function logoKandidaten(html, basisUrl, firma = '') {
  const text = String(html || '');
  const treffer = [];
  const merken = (url, punkte, grund) => {
    const abs = absolut(url, basisUrl);
    if (!abs || !/^https?:/i.test(abs)) return;
    if (/^data:/i.test(String(url))) return;
    // Platzhalter mit {width} o. Ae. aus Lazy-Load-Attributen sind keine Adresse.
    if (/[{}]/.test(abs)) return;
    const vorhanden = treffer.find(t => t.url === abs);
    if (vorhanden) { if (punkte > vorhanden.punkte) { vorhanden.punkte = punkte; vorhanden.grund = grund; } return; }
    treffer.push({ url: abs, punkte, grund });
  };

  const eigeneHost = (() => { try { return new URL(basisUrl).hostname.replace(/^www\./, ''); } catch (e) { return ''; } })();
  const firmaKern = kern(firma);

  // Alle Anker einsammeln, damit zu jedem Bild bekannt ist, WORIN es haengt.
  const anker = [];
  const aRe = /<a\b[^>]*>|<\/a\s*>/gi;
  let a;
  while ((a = aRe.exec(text))) {
    if (a[0][1] === '/') { const offen = anker[anker.length - 1]; if (offen && offen.bis === Infinity) offen.bis = a.index; continue; }
    const href = (a[0].match(/\bhref\s*=\s*["']([^"']*)["']/i) || [, ''])[1];
    anker.push({ von: a.index, bis: Infinity, href, tag: a[0] });
  }
  // Zeigt dieser Link auf die eigene Startseite?
  const zurStartseite = (href) => {
    const h = String(href || '').trim();
    if (!h) return false;
    if (h === '/' || h === './' || h === '#' + '') return h === '/' || h === './';
    try {
      const u = new URL(h, basisUrl);
      return u.hostname.replace(/^www\./, '') === eigeneHost && (u.pathname === '/' || u.pathname === '');
    } catch (e) { return false; }
  };
  let ersterStartseitenLink = true;

  // 1. Bilder
  const imgRe = /<img\b[^>]*>/gi;
  let m;
  while ((m = imgRe.exec(text))) {
    const tag = m[0];
    const src = (tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i) || [, ''])[1]
      || (tag.match(/\bdata-src\s*=\s*["']([^"']+)["']/i) || [, ''])[1]
      || (tag.match(/\bsrcset\s*=\s*["']([^"',\s]+)/i) || [, ''])[1];
    if (!src || /[{}]/.test(src)) continue;
    const alt = (tag.match(/\balt\s*=\s*["']([^"']*)["']/i) || [, ''])[1];
    const klasse = (tag.match(/\bclass\s*=\s*["']([^"']*)["']/i) || [, ''])[1];
    const id = (tag.match(/\bid\s*=\s*["']([^"']*)["']/i) || [, ''])[1];
    const umgebend = anker.filter(x => x.von < m.index && m.index < x.bis).pop() || null;
    const merkmale = [klasse, id, alt, src, umgebend ? umgebend.tag : ''].join(' ').toLowerCase();
    let p = 0;
    const gruende = [];

    // Das staerkste Zeichen: das erste Bild im Link auf die eigene Startseite.
    if (umgebend && zurStartseite(umgebend.href)) {
      p += ersterStartseitenLink ? 100 : 55;
      gruende.push(ersterStartseitenLink ? 'erster Startseiten-Link' : 'Startseiten-Link');
      ersterStartseitenLink = false;
    }
    // Der Firmenname im alt-Text oder im title des Links - das schreibt niemand zufaellig.
    if (firmaKern && firmaKern.length > 3) {
      const wo = kern(alt + ' ' + (umgebend ? (umgebend.tag.match(/\btitle\s*=\s*["']([^"']*)["']/i) || [, ''])[1] : ''));
      if (wo.includes(firmaKern) || (firmaKern.length > 5 && wo.includes(firmaKern.slice(0, 6)))) { p += 45; gruende.push('Firmenname im alt/title'); }
    }
    // Der Name als Zusatz - aber NICHT die Siegel- und Partnerleisten, die genauso heissen.
    if (/logo-?(bar|list|slider|wall|strip|grid|cloud)|partner|kunden|referenz|siegel|zahlung|payment/.test(merkmale)) { p -= 70; gruende.push('Siegel-/Partnerleiste'); }
    else if (/\blogo\b|logo[-_.]|[-_.]logo|wortmarke|signet/.test(merkmale)) { p += 40; gruende.push('"logo" im Namen'); }

    if (/\.svg(\?|$)/i.test(src)) { p += 25; gruende.push('SVG'); }
    // Fotos sind keine Logos.
    if (/hero|banner|slider|teaser|header-?bild|produkt|product|\bfoto\b|\bphoto\b|team|galerie|gallery/.test(merkmale)) { p -= 45; gruende.push('sieht nach Foto aus'); }
    // Fremde Marken: Zahlungsarten, Siegel, soziale Netze.
    if (/paypal|klarna|visa|mastercard|trusted|facebook|instagram|whatsapp|youtube|tiktok|linkedin|worldsoft|shopify|wordpress/.test(merkmale)) { p -= 90; gruende.push('fremde Marke'); }
    // Winzige Bilder aus der Bedienoberflaeche (Pfeile, Platzhalter).
    const br = +((tag.match(/\bwidth\s*=\s*["']?(\d+)/i) || [, 0])[1]);
    if (br && br <= 32) { p -= 60; gruende.push('winzig (' + br + 'px)'); }
    if (/blank\.gif|spacer|pixel\.(gif|png)/.test(src.toLowerCase())) { p -= 100; gruende.push('Platzhalterbild'); }

    if (p > 0) {
      // Viele Seiten liefern im src nur ein kleines Vorschaubild und nennen im data-src die
      // Vorlage mit Platzhalter ("..._{width}x.png"). Gemessen an dtf-express.de: src 200x89,
      // ueber den Platzhalter 1200 px breit. Ein 200-px-Logo auf einer A6-Karte waere Matsch,
      // also wird die grosse Fassung MIT VORRANG eingereiht - klappt sie nicht, greift die kleine.
      const vorlage = (tag.match(/\bdata-src\s*=\s*["']([^"']*\{width\}[^"']*)["']/i) || [, ''])[1];
      if (vorlage) merken(vorlage.replace(/\{width\}/g, '1200'), p + 5, gruende.concat('gross ueber data-src').join(', '));
      merken(src, p, gruende.join(', ') || 'Bild');
    }
  }

  // 2. Eingebettetes SVG mit "logo" im Namen kann man nicht herunterladen (es steht schon da) -
  // das waere ein eigener Weg. Hier nur vermerken, damit der Aufrufer es sagen kann.
  const inline = /<svg\b[^>]*(?:class|id)\s*=\s*["'][^"']*logo[^"']*["'][^>]*>/i.test(text);

  // 3. Apple-Touch-Icon: meist das Logo auf farbigem Grund, 180 px - brauchbar, aber nicht erste Wahl.
  const linkRe = /<link\b[^>]*>/gi;
  while ((m = linkRe.exec(text))) {
    const tag = m[0];
    const rel = (tag.match(/\brel\s*=\s*["']([^"']+)["']/i) || [, ''])[1].toLowerCase();
    const href = (tag.match(/\bhref\s*=\s*["']([^"']+)["']/i) || [, ''])[1];
    if (!href) continue;
    if (/apple-touch-icon/.test(rel)) merken(href, 35, 'apple-touch-icon');
    else if (/(^|\s)(icon|shortcut icon)(\s|$)/.test(rel)) merken(href, /\.svg(\?|$)/i.test(href) ? 30 : 6, 'favicon');
    else if (/mask-icon/.test(rel)) merken(href, 25, 'mask-icon');
  }

  // 4. og:image - oft ein Foto der Firma, selten das Logo. Nur als Notnagel.
  const og = text.match(/<meta\b[^>]*property\s*=\s*["']og:image["'][^>]*>/i);
  if (og) {
    const href = (og[0].match(/\bcontent\s*=\s*["']([^"']+)["']/i) || [, ''])[1];
    if (href) merken(href, /logo/i.test(href) ? 50 : 4, 'og:image');
  }

  // 5. Nachschlag fuer Seiten, die sich erst im Browser aufbauen.
  // Gemessen an ball-z.de: im Quelltext steht KEIN einziges <img> - die Seite wird per
  // JavaScript zusammengesetzt. Die Bildadressen stehen aber im Datenblock, den das Skript
  // mitbringt, und dort heisst das Logo "ballz-logo-white-green-b_dd53735f.png". Also wird der
  // ganze Text nach Bildadressen abgesucht, sobald die Tags nichts hergaben. Bewertet wird
  // dann nur noch der Name - mehr steht nicht zur Verfuegung -, darum zaehlt dieser Weg wenig
  // und greift auch nur, wenn "logo" wirklich drinsteht. Einen Browser braucht das nicht: der
  // Server hat keinen, und fuer einen Dateinamen waere er auch masslos uebertrieben.
  if (!treffer.some(t => t.punkte >= 60)) {
    const roh = text.match(/https?:\/\/[^\s"'\\)<>]+\.(?:png|svg|webp|jpe?g)/gi) || [];
    for (const u of roh) {
      const name = u.toLowerCase();
      if (!/logo|wortmarke|signet|brand/.test(name)) continue;
      if (/logo-?(bar|list|slider|wall|strip|grid|cloud)|partner|siegel|payment|facebook|instagram|youtube|tiktok|linkedin/.test(name)) continue;
      let p = 50;
      if (firmaKern && firmaKern.length > 3 && kern(name).includes(firmaKern)) p += 25;
      if (/\.svg(\?|$)/i.test(name)) p += 15;
      merken(u, p, 'Bildadresse im Seitentext (Seite baut sich per JavaScript auf)');
    }
    treffer.sort((a, b) => b.punkte - a.punkte);
  }

  treffer.sort((a, b) => b.punkte - a.punkte);
  return { kandidaten: treffer, inlineSvg: inline };
}

/**
 * Die Seite im richtigen Zeichensatz lesen: erst der Kopf der Antwort, dann das meta-charset der
 * Seite selbst, sonst UTF-8. Aeltere Firmenseiten liefern noch ISO-8859-1, und blind als UTF-8
 * gelesen faellt dort jeder Umlaut heraus - ausgerechnet aus dem Satz, der sagt, was die Firma
 * macht.
 */
export function seitenText(buffer, contentType = '') {
  const ausKopf = (String(contentType || '').match(/charset\s*=\s*["']?([\w-]+)/i) || [, ''])[1];
  const anfang = buffer.slice(0, 4096).toString('latin1');
  const ausSeite = (anfang.match(/<meta[^>]*charset\s*=\s*["']?([\w-]+)/i) || [, ''])[1]
    || (anfang.match(/<meta[^>]*content\s*=\s*["'][^"']*charset\s*=\s*([\w-]+)/i) || [, ''])[1];
  const name = String(ausKopf || ausSeite || 'utf-8').toLowerCase();
  try { return new TextDecoder(name).decode(buffer); }
  catch (e) { return buffer.toString('utf8'); }
}

/** Text aus einem HTML-Schnipsel holen: Tags raus, Entities auf, Leerraum zusammen. */
function nurText(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1));
      // Gemessen an cce-sportswear.de: die Seite schreibt "F&uuml;r jeden Anla&szlig;". Ohne die
      // benannten Umlaut-Entities wurde daraus "F r Anla" - der Satz, der sagt, was die Firma
      // macht, verlor seine Buchstaben.
      const named = {
        amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: '-',
        auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß',
        eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', ntilde: 'ñ', aacute: 'á', oacute: 'ó',
        euro: '€', copy: '©', reg: '®', trade: '™', hellip: '…', laquo: '«', raquo: '»',
        bdquo: '„', ldquo: '“', rdquo: '”', sbquo: '‚', lsquo: '‘', rsquo: '’', middot: '·', deg: '°'
      };
      return (Object.prototype.hasOwnProperty.call(named, e) ? named[e] : named[e.toLowerCase()]) || ' ';
    })
    .replace(/\s+/g, ' ').trim();
}

/**
 * WAS MACHT DIE FIRMA? - von ihrer eigenen Seite gelesen.
 *
 * 22. Sept., Markus: "Wenn der Standort von einer Firma herausgeht, du sowieso schon auf der
 * Homepage bist und das Logo runterziehst, dann kann man ja auch schauen: was macht die Firma?
 * Bei Ball-z von der Homepage ein paar Trikots oder Gripsocken, bei DTF Express etwas ueber DTF,
 * und so weiter. Wer ist bei Wuerth, dann was mit Schrauben. Dann hat aber das Ortswappen nichts
 * auf dieser Karte zu tun, auch nicht die Sehenswuerdigkeiten."
 *
 * An den drei freigegebenen Seiten gemessen steht es jedes Mal sauber da:
 *   ball-z.de        "Individuelle Team-Sport & Workwear. Massgefertigte Trikots, Gripsocken ..."
 *   dtf-express.de   "Der Onlineshop fuer digitale DTF-Transferdrucke"
 *   cce-sportswear.de "Textildruck | Beschriftungen | Schilder | Flyer"
 * Reihenfolge: description, og:description, Titel, erste Ueberschrift - vom Genauesten zum
 * Vagsten. Gefunden wird nichts erfunden: steht da nichts, kommt nichts zurueck.
 */
export function firmaAusSeite(html, firma = '') {
  const text = String(html || '');
  const hol = (re) => { const m = text.match(re); return m ? nurText(m[1]) : ''; };
  const desc = hol(/<meta\b[^>]*\bname\s*=\s*["']description["'][^>]*\bcontent\s*=\s*["']([^"']{10,400})["']/i)
    || hol(/<meta\b[^>]*\bcontent\s*=\s*["']([^"']{10,400})["'][^>]*\bname\s*=\s*["']description["']/i);
  const og = hol(/<meta\b[^>]*\bproperty\s*=\s*["']og:description["'][^>]*\bcontent\s*=\s*["']([^"']{10,400})["']/i);
  const titel = hol(/<title[^>]*>([\s\S]{3,200}?)<\/title>/i);
  const h1 = hol(/<h1[^>]*>([\s\S]{3,200}?)<\/h1>/i);

  // Der Firmenname selbst sagt nicht, was sie macht - er faellt aus dem Satz heraus.
  // Nur der VOLLE Name faellt heraus, nie sein erstes Wort: bei "DTF Express" haette das aus
  // "digitale DTF-Transferdrucke" ein "digitale -Transferdrucke" gemacht (gemessen am 22. Sept.).
  const ohneNamen = (s) => {
    let r = String(s || '');
    for (const n of [firma, firma.replace(/[.\-]/g, '')].filter(Boolean)) {
      if (n.length < 4) continue;
      r = r.replace(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ');
    }
    return r.replace(/^[\s\u2013\u2014\-|·,:;]+|[\s\u2013\u2014\-|·,:;]+$/g, '').replace(/\s+/g, ' ').trim();
  };

  const kandidaten = [desc, og, titel, h1].map(ohneNamen).filter(s => s.length >= 8);
  const was = kandidaten[0] || '';

  // Stichworte: an Komma, Strich, Pipe und "und" trennen, Fuellwoerter raus, Dubletten weg.
  const fueller = new Set(['der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'fuer', 'für', 'mit', 'von', 'aus', 'und', 'oder', 'im', 'in', 'am', 'an', 'auf', 'nach', 'unser', 'unsere', 'ihre', 'ihren', 'alle', 'jeden', 'jede', 'richtigen', 'individuelle', 'professionelle', 'onlineshop', 'shop', 'gmbh', 'home', 'startseite', 'willkommen']);
  const stichworte = [];
  for (const quelle of [was, titel, h1]) {
    for (const roh of String(quelle).split(/[,|·\/•]|\s[-\u2013\u2014]\s|\s+und\s+|\s+&\s+/i)) {
      const s = roh.replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim();
      if (s.length < 3) continue;
      // Erst die Fuellwoerter weg, DANN messen. Andersherum fiel "Der Onlineshop fuer digitale
      // DTF-Transferdrucke" (45 Zeichen) komplett durch, und als Stichwort blieb der Seitentitel
      // "dtf-express de" uebrig - der sagt ueber das Geschaeft nichts.
      const woerter = s.split(' ').filter(w => !fueller.has(w.toLowerCase()));
      if (!woerter.length) continue;
      const k = woerter.join(' ');
      if (k.length < 3 || k.length > 40) continue;
      if (stichworte.some(v => v.toLowerCase() === k.toLowerCase())) continue;
      // Der Firmenname ist kein Produkt. "Ball-z" als Stichwort haette die Bild-KI aufgefordert,
      // den Namen zu malen - genau das, was auf der Karte nie passieren darf (das Logo kommt
      // hinterher als Aufkleber).
      if (firma && kern(k) && kern(k) === kern(firma)) continue;
      if (firma && kern(k) && kern(firma).startsWith(kern(k)) && kern(k).length >= 4) continue;
      stichworte.push(k);
      if (stichworte.length >= 8) break;
    }
    if (stichworte.length >= 8) break;
  }
  return { was, stichworte, quelle: desc ? 'description' : (og ? 'og:description' : (titel ? 'title' : (h1 ? 'h1' : ''))) };
}

/**
 * DIE ANSCHRIFT DER FIRMA - von ihrer eigenen Seite.
 *
 * 22. Sept., Markus: "Das funktioniert nicht so. Es muss so funktionieren mit Standort." Und:
 * "Die Adresse ist doch auf der Homepage."
 * Beides stimmt: ohne Anschrift kann der Standort nichts entscheiden, und die Anschrift steht da.
 * An den drei freigegebenen Seiten gemessen, in genau dieser Reihenfolge gefunden:
 *   ball-z.de          schema.org-Datenblock: "streetAddress": "Hauptstraße 16", "21228 Harmstorf"
 *   cce-sportswear.de  in der Fusszeile: "Veilchenweg 1 • 21436 Marschacht"
 *   dtf-express.de     erst auf /pages/kontakt: "Heideweg 28, 41812 Erkelenz"
 * Also: erst der strukturierte Datenblock (der ist eindeutig), dann das <address>-Element, dann
 * der Fliesstext. Findet sich nichts, sagt der Aufrufer, wo er noch nachsehen soll.
 */
/**
 * DER SEITENTEXT EINES GESCHAEFTS, so gekuerzt, dass ein Textmodell ihn lesen kann.
 * 27. Sept., Markus: "auf die Homepage zu gehen, gucken, was die macht, und dann auch nur Dinge
 * von diesem Geschaeft zu nehmen." firmaAusSeite() liest nur Titel und Beschreibung - bei
 * baecker-weiss.de blieb davon "Moderner Baecker mit Tradition seit 1908" und das Stichwort
 * "Sohn" (gemessen). Hier kommt der SICHTBARE Text der Seite: Titel, Beschreibung, Ueberschriften
 * und der Anfang des Fliesstexts, ohne Skripte, Stile und Menue-Rauschen.
 */
export function geschaeftText(html, { hoechstens = 3500 } = {}) {
  const t = String(html || '');
  const ohne = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
  const hol = (re) => { const m = t.match(re); return m ? ohne(m[1]) : ''; };
  const titel = hol(/<title[^>]*>([\s\S]{1,300}?)<\/title>/i);
  const desc = hol(/<meta\b[^>]*\bname\s*=\s*["']description["'][^>]*\bcontent\s*=\s*["']([^"']{5,600})["']/i)
    || hol(/<meta\b[^>]*\bcontent\s*=\s*["']([^"']{5,600})["'][^>]*\bname\s*=\s*["']description["']/i);
  const koepfe = [...t.matchAll(/<h[1-3][^>]*>([\s\S]{1,200}?)<\/h[1-3]>/gi)].map(m => ohne(m[1])).filter(Boolean).slice(0, 12);
  const koerper = ohne(t.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<nav[\s\S]*?<\/nav>/gi, ' ').replace(/<footer[\s\S]*?<\/footer>/gi, ' ').replace(/<header[\s\S]*?<\/header>/gi, ' '));
  const teile = [];
  if (titel) teile.push('Titel: ' + titel);
  if (desc) teile.push('Beschreibung: ' + desc);
  if (koepfe.length) teile.push('Ueberschriften: ' + koepfe.join(' | '));
  if (koerper) teile.push('Text: ' + koerper);
  return teile.join('\n').slice(0, hoechstens);
}

export function adresseAusSeite(html) {
  const text = String(html || '');

  // 1. schema.org PostalAddress - die sauberste Quelle, weil die Felder benannt sind.
  const feld = (name, wo) => {
    const m = wo.match(new RegExp('"' + name + '"\\s*:\\s*"([^"]{2,120})"', 'i'));
    return m ? nurText(m[1]) : '';
  };
  const block = text.match(/"@type"\s*:\s*"PostalAddress"[\s\S]{0,600}?\}/i);
  if (block) {
    const strasse = feld('streetAddress', block[0]);
    const plz = feld('postalCode', block[0]);
    const ort = feld('addressLocality', block[0]);
    if (strasse && plz && ort) return { strasse, plz, ort, text: `${strasse}, ${plz} ${ort}`, quelle: 'schema.org' };
  }

  // 2./3. <address>-Element, sonst der ganze Seitentext.
  const adr = text.match(/<address[^>]*>([\s\S]{5,400}?)<\/address>/i);
  for (const [roh, quelle] of [[adr ? adr[1] : '', '<address>'], [text, 'Seitentext']]) {
    if (!roh) continue;
    const txt = nurText(String(roh).replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' '));
    // "Veilchenweg 1 • 21436 Marschacht" - Strasse und PLZ stehen dicht beieinander, in der
    // Reihenfolge Strasse, dann PLZ. Dazwischen duerfen Trenner stehen, aber kein ganzer Satz.
    // Der Strassenname ist EIN Wort mit der Endung, hoechstens mit einem normal geschriebenen
    // Wort davor ("Alter Postweg"). Ein Wort in Grossbuchstaben davor gehoert nicht dazu: bei
    // cce-sportswear.de steht "CCE & SPORTSWEAR • Veilchenweg 1", und daraus wurde sonst die
    // Strasse "SPORTSWEAR Veilchenweg".
    const m = txt.match(/((?:[A-ZÄÖÜ][a-zäöüß]{2,}[ -])?[A-ZÄÖÜ][\wäöüß.\-]*(?:stra(?:ß|ss)e|str\.|weg|allee|platz|damm|ring|gasse|chaussee|ufer|berg))\s+(\d+\s?[a-zA-Z]?)[\s,;•·|\-]{1,8}(\d{5})\s+([A-ZÄÖÜ][a-zäöüß.\-]{2,}(?:[ -][A-ZÄÖÜ][a-zäöüß.\-]{2,})?)/);
    if (m) {
      const strasse = (m[1] + ' ' + m[2]).replace(/\s+/g, ' ').trim();
      // Hinter dem Ortsnamen steht in Fusszeilen oft gleich die Telefonnummer ("Marschacht Tel:").
      // Solche Anhaengsel sind kein Teil des Ortes.
      const ort = m[4].replace(/[ -](Tel|Telefon|Fax|E-?Mail|Mail|Ust|USt|Mobil|Handy|Web|Internet|Impressum|Kontakt|Öffnungszeiten|Oeffnungszeiten)\b.*$/i, '').trim();
      return { strasse, plz: m[3], ort, text: `${strasse}, ${m[3]} ${ort}`, quelle };
    }
  }
  return null;
}

/**
 * Wo koennte die Anschrift sonst stehen? Impressum, Kontakt, rechtliche Hinweise - hoechstens
 * drei Adressen, damit aus dem Nachsehen kein Durchsuchen der ganzen Seite wird.
 */
export function unterseitenFuerAdresse(html, basisUrl, { hoechstens = 3 } = {}) {
  const text = String(html || '');
  const raus = [];
  const re = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi;
  let m;
  while ((m = re.exec(text)) && raus.length < hoechstens) {
    const hinweis = (m[1] + ' ' + nurText(m[2])).toLowerCase();
    if (!/impressum|imprint|legal-?notice|kontakt|contact|anfahrt|ueber-uns|über-uns/.test(hinweis)) continue;
    const abs = absolut(m[1], basisUrl);
    if (!abs || !/^https?:/i.test(abs) || raus.includes(abs) || abs === basisUrl) continue;
    raus.push(abs);
  }
  // Bekannte feste Pfade als Nachschlag - Shopify legt das Impressum unter /policies/legal-notice.
  if (raus.length < hoechstens) {
    for (const p of ['/impressum', '/pages/kontakt', '/policies/legal-notice', '/kontakt']) {
      const abs = absolut(p, basisUrl);
      if (abs && !raus.includes(abs)) raus.push(abs);
      if (raus.length >= hoechstens) break;
    }
  }
  return raus;
}

/**
 * Bilder, die zeigen, WAS die Firma macht - Produkt- und Teaserbilder. Genau die, die bei der
 * Logo-Suche abgewertet werden ("hero", "produkt", "teaser"), sind hier die richtigen.
 * Ein Logo, ein Siegel oder ein Zahlungssymbol ist KEIN Produktbild.
 */
export function produktBilder(html, basisUrl, { hoechstens = 3, ausser = [] } = {}) {
  const text = String(html || '');
  const raus = [];
  // Was schon als Logo gilt, ist kein Produktbild - sonst stuende das Logo zweimal auf der Karte.
  const gesperrt = (u) => (ausser || []).some(x => x && (x === u || u.split('?')[0] === String(x).split('?')[0]
    || u.split('/').pop().split('_')[0] === String(x).split('/').pop().split('_')[0]));
  const imgRe = /<img\b[^>]*>/gi;
  let m;
  while ((m = imgRe.exec(text)) && raus.length < hoechstens * 4) {
    const tag = m[0];
    const src = (tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i) || [, ''])[1]
      || (tag.match(/\bdata-src\s*=\s*["']([^"']+)["']/i) || [, ''])[1];
    if (!src || /[{}]/.test(src)) continue;
    const merkmale = [src, (tag.match(/\bclass\s*=\s*["']([^"']*)["']/i) || [, ''])[1], (tag.match(/\balt\s*=\s*["']([^"']*)["']/i) || [, ''])[1]].join(' ').toLowerCase();
    // Markus, 22. Sept.: "Bei der Postkarte sollst du Dinge dazusuchen. Bei einer Firma soll es
    // auf die Firma bezogen sein. Und wo ist das Problem, von der Homepage ein, zwei Bilder
    // runterzuziehen?" - Kein Problem, und genau das passiert hier. Gesucht ist jedes ECHTE Bild
    // der Firmenseite; auch das Titelbild gehoert dazu, es ist ihr eigenes Foto. Draussen bleibt
    // nur, was kein Bild der Firma ist: ihr Logo (das kommt separat), fremde Marken, Siegel,
    // Bediensymbole und Platzhalter.
    // Der Fehler am 22. Sept. lag nicht am Titelbild, sondern daran, dass EIN Bild mitging und
    // der Auftrag trotzdem "zeig ihre Produkte" sagte - da erfand das Modell den Rest. Jetzt
    // richtet sich die Zahl der Felder nach der Zahl der Bilder: ein Bild, ein Feld.
    if (/logo|siegel|favicon|icon|blank\.gif|spacer|paypal|klarna|visa|mastercard|facebook|instagram|youtube|tiktok|linkedin|worldsoft/.test(merkmale)) continue;
    // 28. Sept., gemessen an famila-nordost.de: das erste "Bild" war famila_OT_RGB_claim_weiss.svg -
    // ein Schriftzug als Vektorgrafik. Eine SVG ist nie ein Foto der Firma; ein "claim" auch nicht.
    if (/\.svg(\?|$)|claim/.test(merkmale)) continue;
    const br = +((tag.match(/\bwidth\s*=\s*["']?(\d+)/i) || [, 0])[1]);
    if (br && br <= 80) continue;
    // 28. Sept., gemessen an mediamarkt.de: die Adresse stand mit "&amp;" im HTML - so holt sie
    // kein Bilddienst. Entitaeten zurueck in Zeichen, bevor die Adresse weitergegeben wird.
    const abs = absolut(src.replace(/&amp;/g, '&').replace(/&#38;/g, '&'), basisUrl);
    if (!abs || !/^https?:/i.test(abs) || raus.includes(abs) || gesperrt(abs)) continue;
    raus.push(abs);
  }
  // Ohne <img>-Tags (Seiten, die sich erst im Browser aufbauen): Adressen aus dem Seitentext.
  if (!raus.length) {
    for (const u of (text.match(/https?:\/\/[^\s"'\\)<>]+\.(?:png|webp|jpe?g)/gi) || [])) {
      const n = u.toLowerCase();
      if (/logo|icon|favicon|siegel|sprite/.test(n)) continue;
      if (gesperrt(u)) continue;
      if (!raus.includes(u)) raus.push(u);
      if (raus.length >= hoechstens) break;
    }
  }
  return raus.slice(0, hoechstens);
}

/**
 * Ein geladenes Bild zu einem brauchbaren Logo-PNG machen: Alphakanal, leerer Rand weg,
 * Hoehe auf ein vernuenftiges Mass. SVG wird dabei GROSS gerastert, nicht klein gezogen.
 */
/**
 * Einen einfarbigen Hintergrund wegnehmen - von den RAENDERN her geflutet, nicht nach Farbe
 * gesucht. Der Unterschied ist wichtig: das Ball-z-Logo ist weiss-gruen auf SCHWARZ (gemessen:
 * Alpha 255 ueberall, Ecke oben links 0,0,0). Wer einfach "alles Schwarze weg" rechnet, radiert
 * auch schwarze Teile IM Logo aus. Vom Rand geflutet bleibt drin, was vom Rand nicht erreichbar
 * ist. Ohne einfarbigen Rand passiert nichts.
 */
export async function randFreistellen(png, { toleranz = 26 } = {}) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: K } = info;
  if (!W || !H) return png;
  const px = (x, y) => (y * W + x) * K;
  // Sind alle vier Ecken (fast) gleich? Nur dann ist es ein Hintergrund und kein Bildinhalt.
  const ecken = [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]].map(([x, y]) => [data[px(x, y)], data[px(x, y) + 1], data[px(x, y) + 2], data[px(x, y) + 3]]);
  if (ecken.some(e => e[3] < 250)) return png;              // schon freigestellt
  const [r0, g0, b0] = ecken[0];
  const nah = (i) => Math.abs(data[i] - r0) <= toleranz && Math.abs(data[i + 1] - g0) <= toleranz && Math.abs(data[i + 2] - b0) <= toleranz;
  if (!ecken.every(e => Math.abs(e[0] - r0) <= toleranz && Math.abs(e[1] - g0) <= toleranz && Math.abs(e[2] - b0) <= toleranz)) return png;

  const gesehen = new Uint8Array(W * H);
  const stapel = [];
  for (let x = 0; x < W; x++) { stapel.push(x, 0, x, H - 1); }
  for (let y = 0; y < H; y++) { stapel.push(0, y, W - 1, y); }
  let weg = 0;
  while (stapel.length) {
    const y = stapel.pop(), x = stapel.pop();
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const nr = y * W + x;
    if (gesehen[nr]) continue;
    const i = nr * K;
    if (!nah(i)) continue;
    gesehen[nr] = 1;
    data[i + 3] = 0;
    weg++;
    stapel.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
  // Traf es fast das ganze Bild, war es kein Hintergrund, sondern das Bild selbst - dann lieber nichts.
  if (weg > W * H * 0.97) return png;

  // Zweiter Gang: die EINGESCHLOSSENEN Flaechen. Gemessen am Ball-z-Logo blieb nach der Flutung
  // vom Rand der Bauch im "b" und der Innenraum im "a" schwarz stehen - beides ist in Wahrheit
  // Hintergrund, der durchscheint, und auf der Karte waeren es zwei schwarze Kleckse.
  // Entfernt werden solche Inseln nur, wenn sie KLEIN sind (unter einem Zehntel des Bildes).
  // Eine grosse Insel waere ein Flaechenteil des Logos in derselben Farbe - die bleibt stehen,
  // lieber ein Fleck zu viel als ein ausgehoehltes Logo.
  const grenze = W * H * 0.1;
  for (let start = 0; start < W * H; start++) {
    if (gesehen[start] || !nah(start * K)) continue;
    const insel = [];
    const warte = [start];
    gesehen[start] = 1;
    while (warte.length) {
      const nr = warte.pop();
      insel.push(nr);
      if (insel.length > grenze) break;
      const x = nr % W, y = (nr / W) | 0;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n2 = ny * W + nx;
        if (gesehen[n2] || !nah(n2 * K)) continue;
        gesehen[n2] = 1;
        warte.push(n2);
      }
    }
    if (insel.length <= grenze) for (const nr of insel) data[nr * K + 3] = 0;
  }
  return sharp(Buffer.from(data), { raw: { width: W, height: H, channels: K } }).png().toBuffer();
}

export async function zuLogoPng(buffer, { hoehe = 512 } = {}) {
  const istSvg = /^\s*(<\?xml|<svg)/i.test(buffer.slice(0, 200).toString('utf8'));
  const roh = istSvg
    ? await sharp(buffer, { density: 600 }).resize({ height: hoehe, fit: 'inside', withoutEnlargement: false }).png().toBuffer()
    : await sharp(buffer).png().toBuffer();
  // Einfarbigen Hintergrund wegnehmen, BEVOR beschnitten wird - sonst bliebe der Kasten stehen
  // und der Beschnitt haette nichts zu tun.
  let frei = roh;
  try { frei = await randFreistellen(roh); } catch (e) { /* dann eben mit Kasten */ }
  // Leeren Rand wegschneiden - Logos auf Webseiten haben fast immer viel Luft drumherum,
  // und die wuerde auf der Karte zu einem winzigen Logo in einem grossen Nichts.
  let beschnitten = frei;
  try { beschnitten = await sharp(frei).ensureAlpha().trim({ threshold: 12 }).png().toBuffer(); } catch (e) { /* ohne Beschnitt weiter */ }
  const png = await sharp(beschnitten).ensureAlpha().resize({ height: hoehe, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  const mass = await sharp(png).metadata();
  return { png, breite: mass.width, hoehe: mass.height, svg: istSvg };
}

/**
 * Taugt das als Logo? Ein 16x16-Favicon und ein 1600x900-Pressefoto sind beide keins.
 * Reine Rechnung auf den gemessenen Massen.
 */
export function taugtAlsLogo({ breite, hoehe }) {
  if (!breite || !hoehe) return { ok: false, grund: 'kein Bild' };
  if (Math.min(breite, hoehe) < 32) return { ok: false, grund: `zu klein (${breite}x${hoehe})` };
  const seite = breite / hoehe;
  if (seite > 12 || seite < 1 / 12) return { ok: false, grund: `ungewoehnliches Seitenverhaeltnis (${seite.toFixed(1)}:1)` };
  return { ok: true, grund: `${breite}x${hoehe}` };
}

/**
 * Taugt das als PRODUKTFOTO? Die Gegenprobe zu taugtAlsLogo - und sie steht absichtlich direkt
 * daneben, weil beide dasselbe Bild verschieden beurteilen MUESSEN.
 *
 * 23. Sept., Markus zur C.C.E.-Karte: "Bei C.C.E. sind auch Sachen da drauf, die gar nicht da
 * hingehoeren - Mohamed solid???" Er hatte recht. Auf ihrer Seite liegt eine Datei
 * t-shirt-mohamed-button.png: ein freigestelltes Vereinsabzeichen, 165 x 118 Pixel, ein Button
 * ihrer Webseite. Der Fotosucher hielt es fuer ein Produktfoto, der Auftrag sagte "male dieses
 * echte Foto der Firma", und die Bild-KI hat brav ein Abzeichen auf die Karte gemalt. Sie hat
 * nichts erfunden und nichts aus einem Trikot geloest - wir haben ihr das Falsche geschickt.
 *
 * Und Markus' zweite Frage: "Koennte auch das Logo, was wir brauchen, rausfliegen?" Genau darum
 * sind es zwei getrennte Regeln. GEMESSEN an den drei freigegebenen Firmen:
 *   Logos:  Ball-z 1497x512 - C.C.E. 358x217 - DTF Express 200x89, alle freigestellt
 *   Fotos:  C.C.E. t-07.jpg und t-02.jpg, je 280x140, deckend
 *   Grafik: das Abzeichen 165x118, freigestellt
 * Daran sieht man zweierlei: eine Mindestbreite von 400 waere falsch (sie wuerfe die echten
 * Trikotfotos weg), und DURCHSICHTIG ist das Unterscheidungsmerkmal. Ein Foto hat keinen
 * freigestellten Hintergrund; ein Logo, ein Siegel, ein Button hat fast immer einen. Deshalb
 * fliegt hier genau das raus, wonach taugtAlsLogo sucht - und das DTF-Logo mit seinen 200 x 89
 * Pixeln bleibt unberuehrt, weil diese Regel den Logo-Weg nicht anfasst.
 */
export function taugtAlsFoto({ breite, hoehe, durchsichtig }) {
  if (!breite || !hoehe) return { ok: false, grund: 'kein Bild' };
  if (durchsichtig) return { ok: false, grund: `freigestellt (${breite}x${hoehe}) - das ist eine Grafik, kein Foto` };
  if (Math.max(breite, hoehe) < 200) return { ok: false, grund: `zu klein fuer ein Foto (${breite}x${hoehe})` };
  return { ok: true, grund: `${breite}x${hoehe}, deckend` };
}

/**
 * Sieht sich ein Bild WIRKLICH an, statt seinen Dateinamen zu lesen: Masse und ob es einen
 * freigestellten Hintergrund hat. Einmal je Firma beim Logo-Holen - nie im Kundenauftrag.
 */
export async function bildBefund(buffer) {
  const m = await sharp(buffer).metadata();
  let durchsichtig = false;
  if (m.hasAlpha) {
    // Nicht "hat einen Alphakanal" (den hat jedes PNG), sondern "ist irgendwo wirklich
    // durchsichtig" - sonst faellt ein deckendes PNG-Foto zu Unrecht durch.
    const st = await sharp(buffer).ensureAlpha().stats();
    durchsichtig = st.channels[3] && st.channels[3].min < 250;
  }
  return { breite: m.width || 0, hoehe: m.height || 0, durchsichtig, format: m.format || '' };
}

/**
 * Die Kandidaten aus dem Seitentext einzeln holen und ansehen. Was keine Fotografie ist, faellt
 * mit Grund heraus - und der Grund wird protokolliert (Regel 5: nichts faengt still).
 * Wirft nie: ein Bild, das sich nicht laden laesst, gilt als ungeeignet, mehr nicht.
 */
export async function fotosPruefen(urls, { holen = fetch, ua = 'motto-otto/1.0', hoechstens = 2 } = {}) {
  const gut = [];
  for (const u of (urls || [])) {
    if (gut.length >= hoechstens) break;
    try {
      const r = await holen(u, { headers: { 'user-agent': ua }, signal: AbortSignal.timeout(15000), redirect: 'follow' });
      if (!r.ok) { console.warn('Produktbild verworfen:', u, '- HTTP', r.status); continue; }
      const befund = await bildBefund(Buffer.from(await r.arrayBuffer()));
      const p = taugtAlsFoto(befund);
      if (!p.ok) { console.warn('Produktbild verworfen:', u, '-', p.grund); continue; }
      gut.push(u);
    } catch (e) { console.warn('Produktbild verworfen:', u, '-', e && e.message ? e.message : e); }
  }
  return gut;
}

/**
 * Das Logo einer Firma von ihrer Webseite holen. Gibt PNG samt Nachweis zurueck - oder sagt,
 * warum es nicht ging. Wirft nie: ein fehlendes Logo ist kein Grund, einen Auftrag zu kippen.
 */
export async function logoVonWebseite(seite, { firma = '', holen = fetch, ua = 'motto-otto/1.0 (+https://www.motto-otto.de)', versuche = 4 } = {}) {
  const basis = String(seite || '').trim();
  if (!/^https?:\/\//i.test(basis)) return { ok: false, grund: 'keine Webseite hinterlegt' };
  let html = '';
  try {
    const r = await holen(basis, { headers: { 'user-agent': ua, accept: 'text/html' }, signal: AbortSignal.timeout(20000), redirect: 'follow' });
    if (!r.ok) return { ok: false, grund: `Webseite antwortet HTTP ${r.status}` };
    html = seitenText(Buffer.from(await r.arrayBuffer()), r.headers && r.headers.get ? r.headers.get('content-type') : '');
  } catch (e) { return { ok: false, grund: 'Webseite nicht erreichbar: ' + (e && e.message ? e.message : e) }; }

  const { kandidaten, inlineSvg } = logoKandidaten(html, basis, firma);
  if (!kandidaten.length) {
    return { ok: false, grund: inlineSvg ? 'Logo steckt als SVG im Seitentext (nicht als Datei) - von Hand holen' : 'kein Logo-Kandidat auf der Seite' };
  }
  const versucht = [];
  for (const k of kandidaten.slice(0, versuche)) {
    try {
      const r = await holen(k.url, { headers: { 'user-agent': ua }, signal: AbortSignal.timeout(20000), redirect: 'follow' });
      if (!r.ok) { versucht.push(`${k.url}: HTTP ${r.status}`); continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      const bild = await zuLogoPng(buf);
      const pruefung = taugtAlsLogo(bild);
      if (!pruefung.ok) { versucht.push(`${k.url}: ${pruefung.grund}`); continue; }
      // Wenn wir die Seite schon offen haben: gleich mitlesen, WAS die Firma macht und welche
      // Produktbilder sie zeigt. Auf der Firmenkarte steht das an der Stelle, wo bei einer
      // Ortskarte die Sehenswuerdigkeiten stehen (Markus, 22. Sept.).
      const geschaeft = firmaAusSeite(html, firma);
      // Die Anschrift: erst auf der Startseite (ball-z.de, cce-sportswear.de), sonst auf
      // Impressum/Kontakt (dtf-express.de). Ohne sie kann der Standort nichts entscheiden.
      let anschrift = adresseAusSeite(html);
      if (!anschrift) {
        for (const u of unterseitenFuerAdresse(html, basis)) {
          try {
            const r2 = await holen(u, { headers: { 'user-agent': ua, accept: 'text/html' }, signal: AbortSignal.timeout(15000), redirect: 'follow' });
            if (!r2.ok) continue;
            anschrift = adresseAusSeite(seitenText(Buffer.from(await r2.arrayBuffer()), r2.headers && r2.headers.get ? r2.headers.get('content-type') : ''));
            if (anschrift) { anschrift.seite = u; break; }
          } catch (e) { /* naechste Unterseite */ }
        }
      }
      return {
        ok: true, png: bild.png, quelle: k.url, grund: k.grund, punkte: k.punkte,
        masse: `${bild.breite}x${bild.hoehe}`, svg: bild.svg, verworfen: versucht,
        was: geschaeft.was, stichworte: geschaeft.stichworte, wasQuelle: geschaeft.quelle,
        // Die Kandidaten kommen aus dem Seitentext, aber welche davon wirklich Fotos sind,
        // entscheidet der Blick auf das Bild (taugtAlsFoto) - nicht der Dateiname.
        produktbilder: await fotosPruefen(produktBilder(html, basis, { ausser: [k.url] }), { holen, ua }),
        // Die Seite haben wir ohnehin offen - also gleich zaehlen, welche Farben sie nennt.
        // hausfarben() braucht das, wenn das Logo keine tragende Farbe hat (DTF Express).
        seitenFarben: seitenFarben(html).slice(0, 12),
        anschrift
      };
    } catch (e) { versucht.push(`${k.url}: ${e && e.message ? e.message : e}`); }
  }
  return { ok: false, grund: 'kein Kandidat war brauchbar', verworfen: versucht };
}

/**
 * Welche Farben nennt die Webseite selbst?
 * Markus, 22. Sept., zu DTF Express: "Du sollst dir die Farben aus dem Logo ziehen. Ich glaube,
 * auf der Seite ist ganz schoen viel gruen, oder?" Er hatte recht: im Quelltext von
 * dtf-express.de steht fuenfmal #95C11F, ein kraeftiges Limegruen - im Logo gemessen als
 * rgb(115,169,59) und rgb(144,180,60). Eine Firma schreibt ihre Hausfarbe in ihr Stylesheet;
 * das ist die zweite Quelle neben dem Logo.
 *
 * Reine Zaehlung, kein Urteil: was davon Hausfarbe ist, entscheidet hausfarben() im Abgleich
 * mit dem Logo - sonst gewinnen die Farben der Bezahl-Symbole (Mastercard, Visa), die auf
 * jeder Shopseite stehen.
 */
export function seitenFarben(html) {
  const zaehl = new Map();
  const merke = (r, g, b) => {
    const k = `${r},${g},${b}`;
    const e = zaehl.get(k) || { r, g, b, n: 0 };
    e.n++; zaehl.set(k, e);
  };
  for (const m of String(html || '').matchAll(/#([0-9a-fA-F]{6})\b/g)) {
    const h = m[1];
    merke(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16));
  }
  for (const m of String(html || '').matchAll(/#([0-9a-fA-F]{3})\b(?![0-9a-fA-F])/g)) {
    const h = m[1];
    merke(parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16));
  }
  for (const m of String(html || '').matchAll(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/g)) {
    merke(+m[1], +m[2], +m[3]);
  }
  return [...zaehl.values()].sort((a, b) => b.n - a.n);
}
