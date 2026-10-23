// abfolge.js - Ein Bildschirm nach dem anderen
// =============================================================================================
// Markus, 20. Sept. 2026: "... immer mit Beispielen belegt, und dann auf Otto starten. Bei jedem
// Produkt: nichts scrollen und eintragen, sondern eine Abfolge - so wird das Ganze uebersichtlicher, und alles ist eingetragen."
//
// Was hier steht, ist der MOTOR dafuer. Er kennt kein Motto: Welche Schritte es gibt, steht in
// der Motto-Datei ("abfolge": Felder des Mottos und Bereiche der Seite je Schritt). Der Motor
//   - plant die Schritte (planen), haengt nicht zugeordnete sichtbare Felder als "Noch ein paar
//     Angaben" an und ganz zum Schluss die Zusammenfassung mit dem Start-Knopf,
//   - weiss, was in einem Schritt noch fehlt (fehlt) und was der Kunde alles gesagt hat
//     (zusammenfassung) - beides reine Rechnung, damit die Abnahme es ohne Browser prueft,
//   - und baut im Browser die Bildschirme (starten): die vorhandenen Felder der Seite werden
//     in Schritte VERSCHOBEN, nicht neu gebaut. Der Server sieht dieselben Felder wie vorher.
//
// Ein neues Produkt bekommt also keine neue Seite, sondern ein "abfolge" in seiner Motto-Datei.
// Die Datei laeuft in beiden Welten: im Browser als window.MoAbfolge, in der Abnahme per
// import './abfolge.js' als globalThis.MoAbfolge. Kein Modulsystem, kein Bundler.
(function (root, bauen) { root.MoAbfolge = bauen(); })(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Bereiche der Seite, die ein Schritt nennen kann -> die Kaesten in motto.html.
  var BEREICHE = {
    stil: ['f-style'], textil: ['f-textile'], stimmung: ['f-mood'], farben: ['f-colors'],
    figuren: ['f-figuren'], platzierung: ['f-placement'], logo: ['f-upload', 'f-logoart', 'f-upload2'],
    artikel: ['f_artikel', 'f_flaeche'], groesse: ['f-druckmass'], schrift: ['f-font'], namen: ['f-nameart'],
    aufteilung: ['f_aufteilung'],
    vorschlaege: ['f-suggest']
  };
  var SCHRITT_LOS = { id: 'los', titel: 'Alles klar?', text: 'Ein Blick, dann legt Otto los. Zum Ändern einfach auf die Zeile tippen.', felder: [], bereiche: [], zusammenfassung: true };

  // ---- Reine Rechnung ---------------------------------------------------------------------
  // standardAbfolge(motto, sichtbar): die Abfolge fuer ein Motto OHNE eigenen "abfolge"-Eintrag.
  // Markus, 20. Sept.: "Die Abfolge fand ich schon ganz gut. Das muessten wir bei allen Themen,
  // bei jedem Motto, ueberall genauso machen." Also braucht kein Motto einen Eintrag - die
  // Schritte kommen aus seinen Feldern und den Kaesten der Seite, nach festen Regeln:
  //   1. Freestyle: zuerst "Worauf soll es?" (Artikel, Flaeche, Mass).
  //   2. Jedes Pflichtfeld ist eine Frage fuer sich (die Vorschlaege haengen am Feld, zu dem sie
  //      gehoeren). Felder, die andere Felder ein- und ausblenden (zeigeWenn), ebenfalls - ihre
  //      Abhaengigen stehen mit auf demselben Bildschirm. Namensliste und Foto je fuer sich.
  //   3. Alles Freiwillige zusammen auf einem Bildschirm "Noch etwas dazu?".
  //   4. Dann die Kaesten der Seite: Logo, Textil, Stil, Figuren - jede Wahl mit Beispielen ist
  //      eine eigene Frage; Stimmung, Farben, Platzierung, Schrift, Namen-Art und das freie Mass
  //      zusammen als "Feinheiten", weil Otto dafuer schon gute Vorgaben hat.
  //   5. Zum Schluss haengt planen() die Zusammenfassung an.
  function standardAbfolge(motto, sichtbar) {
    var felder = ((motto && motto.fields) || []).filter(function (f) { return !f.versteckt && sichtbar('f_' + f.key); });
    var schritte = [], zuF = {};
    var suggest = (motto && motto.suggestField) || '';
    var eigen = function (f) { return f.personal || f.type === 'list' || f.type === 'upload' || f.type === 'wahl' || f.required || hatAbhaengige(f); };
    function hatAbhaengige(f) { return felder.some(function (g) { return g.zeigeWenn && Object.keys(g.zeigeWenn)[0] === f.key; }); }
    function schrittFuer(key) { for (var i = 0; i < schritte.length; i++) if (schritte[i].felder.indexOf(key) >= 0) return schritte[i]; return null; }
    if (motto && motto.freestyle && (sichtbar('f_artikel') || sichtbar('f-druckmass'))) {
      // Freestyle einfach (5. Okt. abends): keine Groessenfrage - der Server nimmt "Brust gross" bzw. die Flaeche des Artikels.
      schritte.push({ id: 'artikel', titel: 'Worauf soll es?', text: 'Der Artikel bestimmt Verfahren und Druckfläche.', felder: [], bereiche: motto.einfach ? ['artikel'] : ['artikel', 'groesse'], weiter: '' });
    }
    var optional = { id: 'optional', titel: 'Noch etwas dazu?', text: 'Alles hier ist freiwillig – leer lassen ist in Ordnung.', felder: [], bereiche: [], weiter: '' };
    felder.forEach(function (f) {
      if (zuF[f.key]) return;
      // Abhaengige Felder stehen bei dem Feld, von dem sie abhaengen
      var herr = f.zeigeWenn ? Object.keys(f.zeigeWenn)[0] : '';
      if (herr && herr !== f.key) {
        var s = schrittFuer(herr);
        if (s) { s.felder.push(f.key); zuF[f.key] = 1; return; }
        if (felder.some(function (g) { return g.key === herr; })) return;   // kommt spaeter mit seinem Feld dran
      }
      if (eigen(f)) {
        var st = { id: 'feld_' + f.key, titel: f.label, text: '', felder: [f.key], bereiche: [], weiter: '' };
        if (f.personal || f.type === 'list') st.text = 'Ein Name je Zeile – die Größen kommen nie aufs Textil, sie ergeben eure Bestellliste.';
        schritte.push(st); zuF[f.key] = 1;
        felder.forEach(function (g) { if (!zuF[g.key] && g.zeigeWenn && Object.keys(g.zeigeWenn)[0] === f.key) { st.felder.push(g.key); zuF[g.key] = 1; } });
      } else {
        optional.felder.push(f.key); zuF[f.key] = 1;
      }
    });
    if (optional.felder.length) schritte.push(optional);
    if (suggest && sichtbar('f-suggest')) { var sf = schrittFuer(suggest); if (sf) sf.bereiche.push('vorschlaege'); }
    // 20. Sept., Markus (Screenshot Geburt/Baby: "Bei Geburt?"): der Kasten hiess "Euer Logo" und
    // sprach vom Logo - beim Baby-Motto ist es aber ein FOTO als Vorlage. Titel und Text kommen
    // deshalb vom Upload des Mottos; nur ein echtes Logo (mode exact) heisst auch so.
    if (sichtbar('f-upload') || sichtbar('f-logoart') || sichtbar('f-upload2')) {
      var up = (motto && motto.upload) || {};
      var echtesLogo = up.mode === 'exact';
      schritte.push({ id: 'logo', titel: echtesLogo ? 'Euer Logo' : (up.label || 'Euer Foto').replace(/\s*[\(–-]\s*optional\)?\s*/i, ''),
        text: echtesLogo ? 'Das Logo kommt genau so ins Design, wie ihr es hochladet.' : (up.hint || ''), felder: [], bereiche: ['logo'], weiter: up.required ? '' : 'Weiter' });
    }
    if (sichtbar('f-textile')) schritte.push({ id: 'textil', titel: 'Für welches Textil?', text: 'Dunkel oder hell – danach richten sich Schrift und Farben.', felder: [], bereiche: ['textil'], weiter: '' });
    if (sichtbar('f-style')) schritte.push({ id: 'stil', titel: 'Welcher Stil?', text: 'Tippen, was dir gefällt – jedes Bild ist ein Beispiel.', felder: [], bereiche: ['stil'], weiter: '' });
    if (sichtbar('f-figuren')) schritte.push({ id: 'figuren', titel: 'Wie sollen die Leute aussehen?', text: '', felder: [], bereiche: ['figuren'], weiter: '' });
    // 2. Okt., Markus: "noch ein Feld dazu packen mit freier Groessenauswahl, ganz wichtig" - die
    // Groesse ist ein eigener Schritt nach dem Stil (bei Freestyle steht sie bei "Worauf soll es?").
    // 4. Okt., Markus (Meister-Shirt mit Namen): "einmal vorne klein mit Namen und hinten gross - das ist
    // ueberhaupt nicht erklaert und auch nicht anzutippen." Die Aufteilung stand als Liste unten auf der
    // Namensseite. Jetzt eine eigene Seite vor der Groesse, mit Kacheln; ohne Namen ist sie zu (leer).
    if (BEREICHE.aufteilung.some(sichtbar)) schritte.push({ id: 'aufteilung', titel: 'Vorne und hinten – wie soll das Shirt aussehen?', text: 'Tipp an, wo das Design und die Namen hinkommen.', felder: [], bereiche: ['aufteilung'], weiter: '' });
    if (!(motto && motto.freestyle) && BEREICHE.groesse.some(sichtbar)) schritte.push({ id: 'groesse', titel: 'Wie groß soll das Design werden?', text: 'Tipp eine Größe an oder gib dein eigenes Maß ein.', felder: [], bereiche: ['groesse'], weiter: '' });
    var fein = ['stimmung', 'farben', 'platzierung', 'schrift', 'namen'].filter(function (b) { return BEREICHE[b].some(sichtbar); });
    if (fein.length) schritte.push({ id: 'fein', titel: 'Feinheiten – optional', text: 'Otto hat schon gute Vorgaben. Ändern, wenn du magst.', felder: [], bereiche: fein, weiter: '' });
    return schritte;
  }

  // planen(motto, sichtbar): die Schritte aus der Motto-Datei (oder die Standard-Abfolge),
  // ergaenzt um alles Sichtbare, das kein Schritt nennt (kommt sonst nie dran), und die
  // Zusammenfassung. sichtbar(id) sagt, ob ein Kasten der Seite gerade da und offen ist - im
  // Browser der DOM, in der Abnahme eine Liste.
  function planen(motto, sichtbar) {
    var felder = (motto && motto.fields) || [];
    var vorgabe = (motto && motto.abfolge && motto.abfolge.length) ? motto.abfolge : standardAbfolge(motto, sichtbar);
    var zuF = {}, zuB = {};
    var schritte = vorgabe.map(function (s) {
      (s.felder || []).forEach(function (k) { zuF[k] = 1; });
      (s.bereiche || []).forEach(function (b) { zuB[b] = 1; });
      return { id: s.id, titel: s.titel, text: s.text || '', weiter: s.weiter || '', felder: (s.felder || []).slice(), bereiche: (s.bereiche || []).slice(), zusammenfassung: false };
    });
    var restF = felder.filter(function (f) { return !f.versteckt && !zuF[f.key] && sichtbar('f_' + f.key); }).map(function (f) { return f.key; });
    var restB = Object.keys(BEREICHE).filter(function (b) { return !zuB[b] && BEREICHE[b].some(sichtbar); });
    if (restF.length || restB.length) schritte.push({ id: 'weiteres', titel: 'Noch ein paar Angaben', text: '', weiter: '', felder: restF, bereiche: restB, zusammenfassung: false });
    // 3. Okt., Markus: "dass immer wieder eine neue Seite aufgeht - eingetippt, naechste Seite geht
    // auf bis zum Ende". Jede Frage ist eine Seite: ein Schritt mit mehreren Fragen wird geteilt.
    var geteilt = [];
    schritte.forEach(function (s) { teilen(s, motto, sichtbar).forEach(function (t) { geteilt.push(t); }); });
    schritte = geteilt;
    schritte.push({ id: SCHRITT_LOS.id, titel: SCHRITT_LOS.titel, text: SCHRITT_LOS.text, weiter: '', felder: [], bereiche: [], zusammenfassung: true });
    return schritte;
  }

  // teilen(schritt, motto, sichtbar): ein Schritt mit mehreren Fragen wird zu einer Seite je Frage.
  // Zusammen bleibt, was zusammengehoert: ein Feld mit den Feldern, die es ein- und ausblendet
  // (zeigeWenn), die Vorschlaege bei ihrem Feld - und ganze Schritte mit Foto, Ort oder einem
  // Kasten der Seite neben Feldern (dort haengt das eine am anderen, z. B. Foto-Weg und Figuren).
  var BEREICH_TITEL = {
    stimmung: 'Welche Farbstimmung?', farben: 'Lieblingsfarben?', platzierung: 'Wo soll der Druck sitzen?',
    schrift: 'Welche Schrift für die Namen?', namen: 'Wie soll der Name erscheinen?',
    stil: 'Welcher Stil?', figuren: 'Wie sollen die Leute aussehen?', textil: 'Für welches Textil?',
    groesse: 'Wie groß soll das Design werden?', artikel: 'Worauf soll es?', logo: 'Euer Logo', vorschlaege: 'Vorschläge',
    aufteilung: 'Vorne und hinten – wie soll das Shirt aussehen?'
  };
  function teilen(s, motto, sichtbar) {
    var felder = (s.felder || []).filter(function (k) { var f = feldVon(motto, k); return !f || !f.versteckt; });
    var versteckt = (s.felder || []).filter(function (k) { return felder.indexOf(k) < 0; });
    var bereiche = s.bereiche || [];
    // Nur Kaesten der Seite (Feinheiten, Stil + Figuren ...): je Kasten eine Seite.
    if (!felder.length) {
      // Auch ein Kasten, der erst spaeter aufgeht (Groesse nach dem Artikel), bekommt seine Seite;
      // solange er zu ist, ueberspringt die Abfolge sie (leer).
      if (bereiche.length < 2) return [s];
      return bereiche.map(function (b, i) {
        return { id: i ? s.id + '-' + b : s.id, titel: BEREICH_TITEL[b] || s.titel, text: i ? '' : s.text, weiter: s.weiter,
          felder: i ? [] : versteckt.slice(), bereiche: [b], zusammenfassung: false, einzel: true };
      });
    }
    if (bereiche.some(function (b) { return b !== 'vorschlaege'; })) return [s];
    if (felder.some(function (k) { var f = feldVon(motto, k); return f && f.type === 'upload'; })) return [s];
    var einheiten = [], zuE = {};
    felder.forEach(function (k) {
      var f = feldVon(motto, k);
      var herr = f && f.zeigeWenn ? Object.keys(f.zeigeWenn)[0] : '';
      if (herr && herr !== k && felder.indexOf(herr) >= 0) {
        if (zuE[herr]) { zuE[herr].push(k); zuE[k] = zuE[herr]; return; }
        // Der Schalter kommt erst weiter unten - das abhaengige Feld wartet auf ihn.
      }
      var e = [k]; einheiten.push(e); zuE[k] = e;
      felder.forEach(function (g) {
        var gf = feldVon(motto, g);
        if (!zuE[g] && gf && gf.zeigeWenn && Object.keys(gf.zeigeWenn)[0] === k) { e.push(g); zuE[g] = e; }
      });
    });
    if (einheiten.length < 2) return [s];
    var vorschlagFeld = (motto && motto.suggestField) || '';
    var beiVorschlag = 0;
    einheiten.forEach(function (e, i) { if (vorschlagFeld && e.indexOf(vorschlagFeld) >= 0) beiVorschlag = i; });
    return einheiten.map(function (e, i) {
      var f = feldVon(motto, e[0]);
      var mitVorschlag = bereiche.indexOf('vorschlaege') >= 0 && i === beiVorschlag;
      var titel = (f && f.label) || s.titel;
      return { id: i ? s.id + '-' + e[0] : s.id, titel: titel, text: '', weiter: s.weiter,
        felder: (i ? [] : versteckt).concat(e), bereiche: mitVorschlag ? ['vorschlaege'] : [], zusammenfassung: false, einzel: e.length === 1 };
    });
  }

  function feldVon(motto, key) {
    var fs = (motto && motto.fields) || [];
    for (var i = 0; i < fs.length; i++) if (fs[i].key === key) return fs[i];
    return null;
  }

  // fehlt(schritt, motto, werte, lage): das erste Pflichtfeld des Schritts, das noch leer ist -
  // oder ''. lage.fotoOk sagt, ob der Server das Foto angenommen hat; lage.gilt(feld) ist die
  // zeigeWenn-Regel der Seite (ein Feld, das gerade nicht gilt, kann auch nicht fehlen).
  function fehlt(schritt, motto, werte, lage) {
    lage = lage || {};
    var keys = (schritt && schritt.felder) || [];
    for (var i = 0; i < keys.length; i++) {
      var f = feldVon(motto, keys[i]);
      if (!f) continue;
      if (lage.gilt && !lage.gilt(f)) continue;
      // 2. Okt.: ein Foto, ohne das es auch geht (ohneGeht, Gruppen-Mottos), fehlt nie.
      if (f.type === 'upload') { if (!lage.fotoOk && !f.ohneGeht) return f.label; continue; }
      if (f.required && !String((werte || {})[f.key] || '').trim()) return f.label;
    }
    // Bereiche der Seite koennen auch etwas verlangen (Artikel bei Freestyle, Pflicht-Logo, Mass):
    // das weiss nur die Seite, sie sagt es ueber lage.bereichFehlt(bereich).
    var bereiche = (schritt && schritt.bereiche) || [];
    for (var b = 0; b < bereiche.length; b++) {
      var t = lage.bereichFehlt ? lage.bereichFehlt(bereiche[b]) : '';
      if (t) return t;
    }
    return '';
  }

  // Was der Kunde in einem Schritt gesagt hat, als Text fuer die Zusammenfassung.
  // lage.bereichText(bereich) liefert z. B. den Namen des gewaehlten Stils.
  function schrittText(schritt, motto, werte, lage) {
    lage = lage || {};
    var teile = [];
    (schritt.felder || []).forEach(function (k) {
      var f = feldVon(motto, k); if (!f) return;
      if (lage.gilt && !lage.gilt(f)) return;
      var v = String((werte || {})[k] || '').trim();
      if (f.type === 'upload') { if (lage.fotoOk) teile.push('Foto ist da'); else if (f.ohneGeht) { if (lage.zusammenfassung) teile.push('ohne Foto'); } else teile.push('Foto fehlt'); return; }
      if (f.type === 'checkbox') { if (v) teile.push(f.label); return; }
      if (f.type === 'wahl') {
        var o = null; (f.options || []).forEach(function (x) { if (x.key === v) o = x; });
        if (o) teile.push(o.label); else if (f.required) teile.push('noch offen');
        return;
      }
      if (v) teile.push(v); else if (f.required) teile.push(f.label + ': noch offen');
    });
    (schritt.bereiche || []).forEach(function (b) {
      var t = lage.bereichText ? lage.bereichText(b) : '';
      if (t) teile.push(t);
    });
    return teile.join(' · ');
  }
  function zusammenfassung(schritte, motto, werte, lage) {
    var lz = {}; for (var k in (lage || {})) lz[k] = lage[k]; lz.zusammenfassung = true;
    return (schritte || []).filter(function (s) { return !s.zusammenfassung; }).map(function (s, i) {
      return { nr: i + 1, id: s.id, titel: s.titel, wert: schrittText(s, motto, werte, lz), fehlt: fehlt(s, motto, werte, lage) };
    });
  }

  // ---- Der Browser-Teil -------------------------------------------------------------------
  // starten(opts):
  //   motto        das Motto (publicView) mit fields und abfolge
  //   $            id -> Element
  //   vor          Element, VOR dem der Ablauf eingehaengt wird (der Felder-Kasten)
  //   werte()      die Kundenwerte wie values() der Seite
  //   fotoOk()     hat der Server das Foto angenommen?
  //   gilt(feld)   zeigeWenn-Regel der Seite
  //   bereichText(bereich)  Text fuer die Zusammenfassung (Stil-Name ...)
  //   mitnehmen    Liste von Element-Ids, die in die Zusammenfassung wandern (Pruefliste, Start-Knopf, Balken, Status)
  //   beiSchritt(schritt, index)  Rueckruf, wenn ein Schritt aufgeht (Seite scrollt, Fokus ...)
  //   merken       Schluessel fuer den Zwischenstand im Browser (sessionStorage), leer = nicht merken
  function starten(opts) {
    var d = opts.dokument || (typeof document !== 'undefined' ? document : null);
    if (!d || !opts.vor || !opts.vor.parentNode) return null;
    var $ = opts.$ || function (id) { return d.getElementById(id); };
    var sichtbar = function (id) { var el = $(id); return !!el && !el.classList.contains('hide'); };
    var bleibtZu = {}; (opts.bleibtZu || []).forEach(function (id) { bleibtZu[id] = 1; });
    var schritte = planen(opts.motto, sichtbar);
    if (schritte.length < 2) return null;   // nur die Zusammenfassung waere kein Ablauf
    var lage = { fotoOk: false, gilt: opts.gilt, bereichText: opts.bereichText, bereichFehlt: opts.bereichFehlt };
    var aktiv = 0, weitester = 0, angefasst = {};

    var wurzel = d.createElement('div');
    wurzel.id = 'abfolge';
    wurzel.innerHTML = '<div class="ab-kopf"><button type="button" class="ab-zurueck" id="ab-zurueck" aria-label="Zurueck">‹ Zurück</button><div class="ab-zaehler" id="ab-zaehler" aria-live="polite"></div></div><div class="ab-balken" aria-hidden="true"><i id="ab-balken"></i></div><div class="ab-schritte" id="ab-schritte"></div>';
    opts.vor.parentNode.insertBefore(wurzel, opts.vor);
    var kasten = wurzel.querySelector('#ab-schritte');

    schritte.forEach(function (s, i) {
      var sec = d.createElement('section');
      // ab-einzel: ein einziges Feld im Schritt - seine Beschriftung ist schon der Titel
      sec.className = 'ab-schritt' + (s.einzel || (s.felder.length === 1 && s.bereiche.every(function (b) { return b === 'vorschlaege'; })) ? ' ab-einzel' : '');
      sec.setAttribute('data-schritt', s.id);
      // 21. Sept., 08:20, Markus: "jeder Schritt anwaehlbar, dann auf Weiter, und eine Erklaerung,
      // wenn optional ist, dass es auch leer bleiben kann. Amazon- und Apple-Prinzip." Deshalb im
      // Fuss jedes Schritts: die Zeile "Gewaehlt: ..." (sofort, sobald etwas angetippt ist), der
      // Hinweis bei freiwilligen Schritten, dann der Weiter-Knopf.
      sec.innerHTML = '<h2 class="ab-titel"></h2>' + (s.text ? '<p class="ab-text"></p>' : '') + '<div class="ab-inhalt"></div>' +
        (s.zusammenfassung ? '' : '<div class="ab-fuss"><div class="ab-gewaehlt" aria-live="polite"></div><p class="ab-optional hide">Freiwillig – das darf auch leer bleiben. Einfach auf „Weiter“ tippen.</p><p class="ab-enter hide">Fertig getippt? Eingabetaste ↵ drücken – auf dem Handy die Taste „Weiter“ – und es geht direkt zur nächsten Frage.</p><button type="button" class="ab-weiter"></button><div class="ab-fehlt" aria-live="polite"></div></div>');
      sec.querySelector('.ab-titel').textContent = s.titel;
      if (s.text) sec.querySelector('.ab-text').textContent = s.text;
      var inhalt = sec.querySelector('.ab-inhalt');
      if (s.zusammenfassung) {
        var liste = d.createElement('div'); liste.className = 'ab-liste'; liste.id = 'ab-liste'; inhalt.appendChild(liste);
        (opts.mitnehmen || []).forEach(function (id) { var el = $(id); if (el) inhalt.appendChild(el); });
      } else {
        // Was ein Schritt ausdruecklich nennt, ist in diesem Schritt auch offen - ein 'hide' von
        // frueher (die alte Drei-Schritte-Seite) gilt hier nicht mehr. Was eine zeigeWenn-Regel
        // versteckt, versteckt refresh() gleich wieder.
        s.felder.forEach(function (k) { var el = $('f_' + k); if (el) { el.classList.remove('hide'); inhalt.appendChild(el); } });
        // Ausnahme (Markus, 20. Sept., "Bei Geburt?"): Kaesten, die das MOTTO versteckt - Logo-Art
        // und zweites Logo bei einem Foto-Upload - bleiben zu (opts.bleibtZu), sonst stand beim
        // Baby-Motto ploetzlich "Zweites Logo (Co-Branding)" auf dem Handy.
        s.bereiche.forEach(function (b) { (BEREICHE[b] || []).forEach(function (id) { var el = $(id); if (el) { if (!bleibtZu[id]) el.classList.remove('hide'); inhalt.appendChild(el); } }); });
        var wb = sec.querySelector('.ab-weiter');
        wb.addEventListener('click', function () { weiter(); });
      }
      kasten.appendChild(sec);
      s.el = sec;
    });

    // 1. Okt.: Ein Schritt, in dem nichts mehr zu sehen ist (kein Feld, alle Kaesten zu - etwa
    // "Fuer welches Textil?" bei einer Brotdose), wird uebersprungen und nicht mitgezaehlt.
    function leer(s) {
      if (!s || s.zusammenfassung) return false;
      var bereicheZu = s.bereiche.every(function (b) { return (BEREICHE[b] || []).every(function (id) { return !sichtbar(id); }); });
      if (!s.felder.length) return s.bereiche.length > 0 && bereicheZu;
      // 3. Okt.: eine Seite je Frage - ist ihr Feld gerade zu (zeigeWenn, Motto), ist die Seite leer.
      var felderZu = s.felder.every(function (k) { var f = feldVon(opts.motto, k); return (f && f.versteckt) || !sichtbar('f_' + k); });
      return felderZu && bereicheZu;
    }
    function werte() { try { return opts.werte ? opts.werte() : {}; } catch (e) { return {}; }
    }
    function fehltJetzt(i) { lage.fotoOk = !!(opts.fotoOk && opts.fotoOk()); return fehlt(schritte[i], opts.motto, werte(), lage); }

    // Freiwillig ist ein Schritt, in dem nichts Pflicht ist: kein Pflichtfeld, kein Foto, und
    // nur Bereiche, die leer bleiben duerfen (Vorschlaege, Feinheiten, freiwilliges Logo).
    var LEERBAR = { vorschlaege: 1, stimmung: 1, farben: 1, platzierung: 1, schrift: 1, namen: 1, groesse: 1, aufteilung: 1 };
    function istFreiwillig(s) {
      if (s.zusammenfassung || (!s.felder.length && !s.bereiche.length)) return false;
      var up = (opts.motto && opts.motto.upload) || {};
      for (var i = 0; i < s.felder.length; i++) {
        var f = feldVon(opts.motto, s.felder[i]);
        if (f && (f.required || (f.type === 'upload' && !f.ohneGeht))) return false;
      }
      for (var b = 0; b < s.bereiche.length; b++) {
        if (s.bereiche[b] === 'logo' ? !!up.required : !LEERBAR[s.bereiche[b]]) return false;
      }
      return true;
    }
    function ohneFoto(s) { return s.felder.some(function (k) { var f = feldVon(opts.motto, k); return f && f.type === 'upload' && f.ohneGeht; }); }
    function aktualisieren() {
      lage.fotoOk = !!(opts.fotoOk && opts.fotoOk());
      var s = schritte[aktiv];
      if (!s.zusammenfassung) {
        var wb = s.el.querySelector('.ab-weiter'), fe = s.el.querySelector('.ab-fehlt'), ge = s.el.querySelector('.ab-gewaehlt'), op = s.el.querySelector('.ab-optional');
        var f = fehltJetzt(aktiv);
        var frei = istFreiwillig(s);
        var text = schrittText(s, opts.motto, werte(), lage);
        var gewaehlt = text && !/noch offen|fehlt/.test(text) ? text : '';
        wb.textContent = f ? 'Weiter' : (frei && !gewaehlt ? (ohneFoto(s) ? 'Ohne Foto weiter' : 'Ohne Angabe weiter') : (s.weiter || 'Weiter'));
        wb.classList.toggle('offen', !!f);
        if (ge) ge.textContent = gewaehlt ? '✓ ' + gewaehlt : '';
        if (op) op.classList.toggle('hide', !frei);
        // 4. Okt., Markus: "Und es soll doch erklaert werden, dass man mit Enter auch direkt weiterkommt."
        var en = s.el.querySelector('.ab-enter');
        if (en) en.textContent = s.el.querySelector('.nl-name') ? 'Eingabetaste ↵ (auf dem Handy „Weiter“) springt zum nächsten Namen – in einer leeren Zeile geht es zur nächsten Frage.' : 'Fertig getippt? Eingabetaste ↵ drücken – auf dem Handy die Taste „Weiter“ – und es geht direkt zur nächsten Frage.';
        if (en) en.classList.toggle('hide', ![].some.call(s.el.querySelectorAll('input[type=text],input[type=email],input[type=tel],input[type=number],input[type=date],input:not([type]),textarea'), function (el) { return !!(el.offsetWidth || el.offsetHeight); }));
        fe.textContent = (f && angefasst[s.id]) ? 'Bitte noch: ' + f : '';
        s.el.classList.toggle('miss', !!(f && angefasst[s.id]));
      } else {
        listeBauen();
      }
      var zaehlbar = schritte.filter(function (x) { return !leer(x); });
      var nr = zaehlbar.indexOf(schritte[aktiv]) + 1 || aktiv + 1;
      $('ab-zaehler').textContent = 'Schritt ' + nr + ' von ' + zaehlbar.length;
      $('ab-balken').style.width = Math.round((nr / zaehlbar.length) * 100) + '%';
      $('ab-zurueck').classList.toggle('unsichtbar', aktiv === 0);
    }

    function listeBauen() {
      var liste = $('ab-liste'); if (!liste) return;
      var zeilen = zusammenfassung(schritte, opts.motto, werte(), lage);
      liste.innerHTML = '';
      zeilen.forEach(function (z, i) {
        if (leer(schritte[i])) return;
        var row = d.createElement('button');
        row.type = 'button'; row.className = 'ab-zeile' + (z.fehlt ? ' offen' : '');
        row.setAttribute('data-ziel', String(i));
        row.innerHTML = '<span class="ab-zeile-t"></span><span class="ab-zeile-w"></span><span class="ab-zeile-a">' + (z.fehlt ? 'Nachtragen' : 'Ändern') + '</span>';
        row.querySelector('.ab-zeile-t').textContent = z.titel;
        row.querySelector('.ab-zeile-w').textContent = z.fehlt ? ('fehlt: ' + z.fehlt) : (z.wert || '–');
        row.addEventListener('click', function () { zeige(i); });
        liste.appendChild(row);
      });
    }

    // erzwingen: ohne die Pflicht-Pruefung der vorherigen Schritte - fuer den Wartescreen nach
    // einem Neuladen (21. Sept., "bricht ab ohne Hinweis": der laufende Auftrag stand im letzten
    // Schritt, die Seite zeigte nach dem Neuladen aber Schritt 1 - und damit nichts vom Auftrag).
    function zeige(i, ausVerlauf, ohneScroll, erzwingen) {
      if (i < 0 || i >= schritte.length) return;
      // Nach vorn nur, wenn alles Vorherige da ist - sonst bleibt der erste offene Schritt stehen.
      if (i > aktiv && !erzwingen) {
        for (var k = aktiv; k < i; k++) {
          if (schritte[k].zusammenfassung) continue;
          if (fehltJetzt(k)) { angefasst[schritte[k].id] = 1; i = k; break; }
        }
      }
      // Leere Schritte in Laufrichtung ueberspringen
      var richtung = i >= aktiv ? 1 : -1;
      while (leer(schritte[i])) i += richtung;
      if (i < 0 || i >= schritte.length) return;
      aktiv = i;
      if (i > weitester) weitester = i;
      schritte.forEach(function (s, n) { s.el.classList.toggle('on', n === i); });
      aktualisieren();
      if (!ausVerlauf) { try { fenster.history.pushState({ moAbfolge: i }, ''); } catch (e) { /* ohne Verlauf */ } }
      // 3. Okt.: jede Frage ist eine neue Seite - also beginnt sie auch wie eine: oben, sofort, ohne Gleiten.
      if (!ohneScroll) { try { fenster.scrollTo(0, 0); } catch (e) { /* alter Browser */ } }
      if (opts.beiSchritt) { try { opts.beiSchritt(schritte[i], i); } catch (e) { /* Rueckruf ist Kuer */ } }
    }
    function weiter() {
      var s = schritte[aktiv];
      if (!s.zusammenfassung && fehltJetzt(aktiv)) { angefasst[s.id] = 1; aktualisieren(); return false; }
      zeige(aktiv + 1);
      tippbereit();
      return true;
    }
    // 3. Okt.: "eingetippt, naechste Seite geht auf". Ist die neue Seite eine Frage zum Tippen,
    // steht der Cursor schon drin (die Tastatur bleibt offen); die Taste unten rechts heisst "Weiter".
    function tippbereit() {
      var s = schritte[aktiv]; if (!s || s.zusammenfassung || !s.el) return;
      var t = [].filter.call(s.el.querySelectorAll('input[type=text], input[type=email], input[type=tel], input[type=number], input:not([type]), textarea'), zuSehen)[0];
      var andere = [].filter.call(s.el.querySelectorAll('.styles, .sugg.groessen, select, input[type=checkbox], .drop'), zuSehen).length;
      if (t && !andere && !s.el.querySelector('.nl')) { try { t.focus({ preventScroll: true }); } catch (e) { /* alter Browser */ } }
    }
    [].forEach.call(kasten.querySelectorAll('input, textarea'), function (el) { if (!/^(file|checkbox|radio|hidden|button|submit)$/i.test(el.type || '')) el.setAttribute('enterkeyhint', 'next'); });
    function zurueck() { if (aktiv > 0) zeige(aktiv - 1); }

    $('ab-zurueck').addEventListener('click', zurueck);
    wurzel.addEventListener('input', function () { angefasst[schritte[aktiv].id] = 1; aktualisieren(); merken(); });
    wurzel.addEventListener('change', function () { angefasst[schritte[aktiv].id] = 1; aktualisieren(); merken(); });
    // Stil, Textil, Karte, Figuren sind Knoepfe, kein input/change: nach einem Tipp die Zeile
    // "Gewaehlt" nachziehen - erst nachdem die Seite den Tipp selbst verarbeitet hat.
    wurzel.addEventListener('click', function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest('button') : null;
      if (!b || b.classList.contains('ab-weiter') || b.classList.contains('ab-zeile') || b.id === 'ab-zurueck') return;
      var bei = aktiv;
      // Ein Vorschlag (Spruch, Gruss) ist eine Antwort wie eine Kachel: antippen, naechste Seite.
      if (b.closest('#f-suggest') && b.classList.contains('s')) {
        setTimeout(function () { aktualisieren(); merken(); if (aktiv === bei && !fehltJetzt(aktiv)) { try { b.blur(); d.activeElement && d.activeElement.blur && d.activeElement.blur(); } catch (e) { /* egal */ } weiter(); } }, 280);
        return;
      }
      setTimeout(function () { aktualisieren(); merken(); selbstWeiter(bei, b); }, 0);
    });
    // 2. Okt., Markus: "wenn ich was angeklickt hab, dass sofort die naechste Auswahl aufgeht, ohne
    // auf Weiter zu druecken" - "das muss mega schnell gehen". Ein Tipp auf eine Wahl-Kachel (Stil,
    // Textil, Kartenart, Figuren, Groesse, jede Kachelwahl) oeffnet den naechsten Schritt, wenn
    // damit alles im Schritt beantwortet ist: es war die LETZTE sichtbare Kachelreihe des Schritts,
    // im Schritt ist kein Feld zum Tippen offen (Text, Zahl, Liste), und es fehlt nichts mehr.
    // Nicht bei "Eigene Groesse" (danach kommt Tippen) und nicht bei Knoepfen wie "Mehr Stile".
    // Weiter bleibt fuer alles andere; ein kurzer Halt, damit man die gewaehlte Kachel noch sieht.
    // 3. Okt.: seit jede Frage eine eigene Seite ist, stehen Farbstimmung (data-m), Druckplatz
    // (data-p), Schrift (data-f), Namensart (data-n) und Logo-Art (data-l) allein auf einer Seite -
    // sie fehlten hier, und genau dort musste Markus wieder "Weiter" druecken.
    var WAHL = '[data-x],[data-s],[data-w],[data-fg],[data-b],[data-standard],[data-m],[data-p],[data-f],[data-n],[data-l],[data-au]';
    var GRUPPE = '.styles, .sugg.groessen';
    function zuSehen(el) { return !!el && !!(el.offsetWidth || el.offsetHeight || (el.getClientRects && el.getClientRects().length)); }
    // Breite x Hoehe der eigenen Groesse zaehlen nicht, wenn eine Groessen-Kachel sie gerade gefuellt
    // hat (bei Freestyle stehen die beiden Felder immer offen - dort blieb die Seite stehen).
    function tippOffen(s, b) {
      var felder = s.el.querySelectorAll('input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=radio]), textarea, select');
      var mass = b && b.hasAttribute && b.hasAttribute('data-b');
      for (var i = 0; i < felder.length; i++) if (zuSehen(felder[i]) && !(mass && felder[i].closest('#eigenmass'))) return true;
      return false;
    }
    function selbstWeiter(bei, b) {
      if (bei !== aktiv || !b.matches || !b.matches(WAHL) || b.disabled) return;
      var s = schritte[aktiv];
      if (!s || s.zusammenfassung || !s.el.contains(b) || tippOffen(s, b) || fehltJetzt(aktiv)) return;
      // Ein Schritt mit Foto hat noch mehr zu tun - dort Weiter.
      if (s.felder.some(function (k) { var f = feldVon(opts.motto, k); return f && f.type === 'upload'; })) return;
      var gruppen = [].filter.call(s.el.querySelectorAll(GRUPPE), zuSehen);
      if (!gruppen.length || !gruppen[gruppen.length - 1].contains(b)) return;
      setTimeout(function () { if (aktiv === bei) weiter(); }, 280);
    }
    // Ein Schritt mit nur einer Liste (select) geht nach der Wahl genauso weiter; in einem Textfeld
    // fuehrt die Eingabetaste weiter, statt dass man den Knopf suchen muss.
    wurzel.addEventListener('change', function (ev) {
      var t = ev.target, s = schritte[aktiv];
      if (!t || t.tagName !== 'SELECT' || !s || s.zusammenfassung || !t.value) return;
      var offen = [].filter.call(s.el.querySelectorAll('input:not([type=hidden]):not([type=file]), textarea, select'), zuSehen);
      if (offen.length !== 1 || offen[0] !== t || [].filter.call(s.el.querySelectorAll(GRUPPE), zuSehen).length) return;
      var bei = aktiv;
      setTimeout(function () { if (aktiv === bei && !fehltJetzt(aktiv)) weiter(); }, 280);
    });
    wurzel.addEventListener('change', function (ev) {
      var t = ev.target, s = schritte[aktiv];
      if (!t || t.type !== 'checkbox' || !t.checked || !s || s.zusammenfassung) return;
      var offen = [].filter.call(s.el.querySelectorAll('input:not([type=hidden]):not([type=file]), textarea, select, .styles'), zuSehen);
      if (offen.length !== 1 || offen[0] !== t) return;
      var bei = aktiv;
      setTimeout(function () { if (aktiv === bei && !fehltJetzt(aktiv)) weiter(); }, 280);
    });
    wurzel.addEventListener('keydown', function (ev) {
      var t = ev.target;
      // Auch in mehrzeiligen Feldern (langer Spruch, "Was soll drauf?"): eine neue Zeile braucht dort
      // niemand, die Eingabetaste heisst "Weiter" (3. Okt., Markus: "eingetippt, naechste Seite geht auf").
      if (ev.key !== 'Enter' || ev.shiftKey || ev.isComposing || !t || !/^(INPUT|TEXTAREA)$/.test(t.tagName) || /^(file|checkbox|radio|button|submit)$/i.test(t.type || '')) return;
      if (schritte[aktiv].zusammenfassung) return;
      ev.preventDefault();
      // 4. Okt.: in der Namensliste springt die Eingabetaste zum NAECHSTEN Namen (nach "Lena" kam sonst
      // sofort die naechste Seite); erst in einer leeren Zeile oder nach der letzten geht es weiter.
      if (t.classList.contains('nl-name') && t.value.trim()) {
        var namen = [].slice.call(t.closest('.nl') ? t.closest('.nl').querySelectorAll('.nl-name') : []);
        var naechster = namen[namen.indexOf(t) + 1];
        if (naechster) { naechster.focus(); return; }
      }
      weiter();
    });
    // Der Zurueck-Knopf des Handys geht einen Schritt zurueck, nicht aus der Seite raus.
    var fenster = d.defaultView || (typeof window !== 'undefined' ? window : null);
    try {
      fenster.history.replaceState({ moAbfolge: 0 }, '');
      fenster.addEventListener('popstate', function (ev) {
        var st = ev.state; if (st && typeof st.moAbfolge === 'number' && st.moAbfolge !== aktiv) zeige(st.moAbfolge, true);
      });
    } catch (e) { /* ohne Verlauf */ }

    // Zwischenstand merken: Texte und Kachelwahlen, kein Foto (das liegt nie im Browser).
    function merken() {
      if (!opts.merken) return;
      try {
        var w = werte(), out = {};
        ((opts.motto && opts.motto.fields) || []).forEach(function (f) { if (['text', 'textarea', 'select', 'wahl'].indexOf(f.type) >= 0 && !f.versteckt && w[f.key]) out[f.key] = w[f.key]; });
        sessionStorage.setItem(opts.merken, JSON.stringify({ at: Date.now(), werte: out }));
      } catch (e) { /* privates Fenster */ }
    }
    function gemerkt() {
      if (!opts.merken) return null;
      try { var j = JSON.parse(sessionStorage.getItem(opts.merken) || 'null'); return (j && j.werte && Date.now() - j.at < 6 * 3600 * 1000) ? j.werte : null; } catch (e) { return null; }
    }

    zeige(0, true, true);
    return { schritte: schritte, zeige: zeige, weiter: weiter, zurueck: zurueck, aktualisieren: aktualisieren, aktiv: function () { return aktiv; }, gemerkt: gemerkt, merken: merken, wurzel: wurzel };
  }

  return { BEREICHE: BEREICHE, standardAbfolge: standardAbfolge, planen: planen, fehlt: fehlt, zusammenfassung: zusammenfassung, schrittText: schrittText, starten: starten };
});
