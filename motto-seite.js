// motto-seite.js - die ganze Logik der Mottoseite.
// Fassung 77 (Ladezeit): Das stand als 142 kB im Kopf jeder Mottoseite - bei sechzehn
// Anlaessen also sechzehnmal dasselbe, und bei jedem Besuch neu. Jetzt ist es eine eigene
// Datei: einmal geladen, dann aus dem Zwischenspeicher, fuer jede Mottoseite und jeden
// weiteren Besuch. Die Adresse traegt eine Fassungsnummer (?v=), damit ein Deploy sofort
// die neue Datei bekommt und nicht die alte aus dem Speicher.
// Erwartet, dass window.MOTTO und preise.js vorher da sind - die Reihenfolge der
// <script>-Zeilen in motto.html sorgt dafuer.
(function () {
  var API = '/api/mo';
  var $ = function (id) { return document.getElementById(id); };
  var app = $('app'), sel = $('motto'), intro = $('intro'), fieldsBox = $('fields');
  var fUpload = $('f-upload'), drop = $('drop'), file = $('file'), thumb = $('thumb');
  var check = $('check'), go = $('go'), bar = $('bar'), fill = $('fill'), status = $('status');
  var result = $('result'), img = $('img'), meta = $('meta'), tabs = $('tabs'), colors = $('colors'), view = $('view');
  // Weiblich und Mehrzahl unter unseren Artikelnamen - alles andere bekommt "dem".
  var WEIBLICH = /^(Tasse|Trinkflasche|Handyhülle|Cap|Schürze|Fußmatte|Hundemarke|Brotdose|Zip-Jacke|Napfunterlage|Hundedecke)$/;
  var MEHRZAHL = /^(Socken)$/;
  var shown = { preview: '', mockups: null, back: null, tab: 'tee', color: 'black', size: 'M', names: [], people: [], aufteilung: 'vorne', n: 0, designId: '', sig: null, artikel: null };

  // Otto Freestyle: der BESTELLTE Artikel bestimmt, was nach dem Erzeugen zu sehen ist.
  // Vorher stand hier fest 'tee' - wer ein Strandtuch bestellt hatte, bekam ein T-Shirt
  // gezeigt. Gibt es fuer den Artikel keine echte Ansicht (Tuerschild, Hundemarke ...),
  // zeigen wir das Motiv selbst statt ein fremdes Teil vorzugaukeln.
  function eigeneAnsicht() {
    var m = shown.mockups || {};
    return (shown.artikel && shown.artikel.ansicht && m[shown.artikel.ansicht]) ? shown.artikel.ansicht : '';
  }
  // Von der Startseite gewuenschtes Teil (?teil=kissen): das erste Mockup, das der Kunde nach dem
  // Erzeugen sieht, ist dann genau das, worauf er geklickt hat.
  var wunschTeil = '', vorbelegtGescrollt = false;
  function startReiter(s) {
    var m = s.mockups || null;
    if (!m) return 'motiv';
    if (wunschTeil && m[wunschTeil]) return wunschTeil;
    if (s.artikel) return (s.artikel.ansicht && m[s.artikel.ansicht]) ? s.artikel.ansicht : 'motiv';
    if (m.tee) return 'tee';
    var k = Object.keys(m);
    return k.length ? k[0] : 'motiv';
  }

  // 20. Sept., Markus: "Poster anzuklicken geht nicht." Der Reiter war umgeschaltet, das Bild
  // aber blieb das alte, weil das neue erst auf dem Server gebaut wurde - und wenn der Aufruf
  // dabei scheiterte, blieb es fuer immer das alte. Ab jetzt sieht man beim Umschalten, dass
  // etwas passiert (Bild gedimmt, Zeile "wird gebaut"), ein Fehlschlag wird einmal von selbst
  // wiederholt, und bleibt er, steht es dran - statt dass "nichts passiert".
  var bildLauf = 0;
  function zeigeBild(src, wartetext, fertig) {
    var hinweis = $('bild-hinweis');
    if (img.getAttribute('src') === src && !img.classList.contains('laedt')) { if (fertig) fertig(); return; }
    var lauf = ++bildLauf, versuch = 0;
    var laden = function () {
      img.classList.add('laedt');
      if (hinweis) { hinweis.textContent = versuch ? 'Dauert etwas länger – gleich ist es so weit …' : (wartetext || 'Ansicht wird gebaut …'); hinweis.classList.remove('hide'); }
      img.onload = function () { if (lauf !== bildLauf) return; img.classList.remove('laedt'); if (hinweis) hinweis.classList.add('hide'); if (fertig) fertig(); };
      img.onerror = function () {
        if (lauf !== bildLauf) return;
        if (versuch < 2) { versuch++; setTimeout(function () { if (lauf === bildLauf) { img.src = src + (src.indexOf('?') < 0 ? '?' : '&') + 'w=' + versuch; } }, 3500); return; }
        img.classList.remove('laedt');
        if (hinweis) { hinweis.textContent = 'Diese Ansicht klappt gerade nicht. Bitte noch einmal antippen – oder einen anderen Artikel wählen.'; hinweis.classList.remove('hide'); }
      };
      img.src = src;
    };
    laden();
  }

  function drawResult() {
    var m = shown.mockups || {};
    var eigen = eigeneAnsicht();
    var keys = Object.keys(m);
    if (eigen) keys = [eigen].concat(keys.filter(function (k) { return k !== eigen; }));
    // Hat der bestellte Artikel kein eigenes Mockup, dann ist "motiv" der Artikel selbst - er heisst so, steht vorn und ist auch in der
    // Kachelreihe darunter (drawAlsoOn) die erste Karte. "Nur das Motiv" bleibt fuer den Rest.
    var motivIstArtikel = !!(shown.artikel && !eigen);
    var motivKnopf = '<button type="button" data-t="motiv"' + (shown.tab === 'motiv' ? ' class="on"' : '') + '>' + (motivIstArtikel ? esc(shown.artikel.name) + ' · dein Artikel' : 'Nur das Motiv') + '</button>';
    tabs.innerHTML = (motivIstArtikel ? motivKnopf : '') + keys.map(function (k) { return '<button type="button" data-t="' + k + '"' + (shown.tab === k ? ' class="on"' : '') + '>' + esc(m[k].label) + (k === eigen ? ' · dein Artikel' : '') + '</button>'; }).join('') +
      (motivIstArtikel ? '' : motivKnopf) +
      (shown.back ? '<button type="button" data-t="rueckseite"' + (shown.tab === 'rueckseite' ? ' class="on"' : '') + '>' + (shown.back.kader ? 'Hinten (alle Namen)' : 'Rückseite') + '</button>' : '');
    [].forEach.call(tabs.querySelectorAll('button'), function (b) { b.addEventListener('click', function () { shown.tab = b.dataset.t; drawResult(); }); });
    farbKnoepfe(m);
    var q = (shown.names.length ? '&n=' + shown.n : '') + linieParam();
    // Abi-Klassiker (brust-kader): vorne nur der kleine Brust-Print mit dem eigenen Namen
    var chest = shown.aufteilung === 'brust-kader' && shown.names.length;
    $('namesel').classList.toggle('hide', !shown.names.length || shown.tab === 'rueckseite');
    // Größe nur bei echten Teilen (T-Shirt/Hoodie/Zip) anbieten, nicht bei "nur Motiv"/Rückseite
    // 6. Okt.: ist die Kasse offen, fragt der Kaufkasten die Groesse - nicht zweimal.
    $('sizesel').classList.toggle('hide', !(m[shown.tab] && shown.tab !== 'rueckseite' && m[shown.tab].sizes !== false) || kasseOffen());
    drawSizeChips();
    if (shown.tab === 'rueckseite' && shown.back) {
      var bm = shown.back.mockups || {};
      var bt = bm[shown.tab === 'rueckseite' && m.tee ? 'tee' : Object.keys(bm)[0]];
      if (bt && bt[grundFarbe()]) {
        colors.classList.remove('hide');
        view.textContent = (shown.back.kader ? 'Rücken mit ' + ((current && current.listeWort) || 'Namensliste') + ' – alle ' : 'Rückseite mit allen ') + shown.back.count + ' Namen · Vorschau auf dem T-Shirt';
        zeigeBild(bt[grundFarbe()] + linieParam());
      } else {
        colors.classList.add('hide');
        view.textContent = (shown.back.kader ? 'Rücken mit ' + ((current && current.listeWort) || 'Namensliste') + ' – alle ' : 'Rückseite mit allen ') + shown.back.count + ' Namen';
        zeigeBild(shown.back.preview);
      }
    } else if (shown.tab === 'motiv' || !m[shown.tab]) {
      colors.classList.add('hide');
      view.textContent = (shown.artikel && !eigen)
        ? ('Dein Artikel: ' + shown.artikel.name + (shown.artikel.label ? ' · ' + shown.artikel.label : '') + ' – dafür haben wir noch keine Ansicht. Hier siehst du das Motiv genau so, wie es gedruckt wird.')
        : '';
      zeigeBild(shown.preview + q);
    } else {
      colors.classList.remove('hide');
      // Fassung 90 (Markus: "Wenn der Kunde ein Poster erstellt hat, dann muss sein Motiv auf
      // der Wand im Wohnzimmer genauso haengen"): Liegt fuer dieses Teil in dieser Farbe eine
      // Situation vor, ist sie die erste Ansicht. Die sachliche Ansicht mit Massangabe bleibt
      // einen Tipp entfernt - sie sagt, was man bekommt; die Situation sagt, warum man es will.
      var sz = !chest && m[shown.tab].szene && m[shown.tab].szene[shown.color];
      var lebendig = !!sz && shown.ansicht !== 'sachlich';
      // 23:52, Markus: "so sieht es in Benutzung aus ... Druck sitzt auf dem echten Textil aehnlich -
      // total Banane. Da muss was drauf, wenn ich Bock auf so ein cooles T-Shirt habe." Und zur
      // Vorschau auf einem anderen Teil: "Das Motiv ist fuers T-Shirt entworfen,
      // das ist nur eine Vorschau - du kannst dir natuerlich ein eigenes Design fuers Strandtuch machen."
      var teil = m[shown.tab], teilName = teil.label, wo = teil.szeneText || 'in Benutzung';
      var text, zusatz = '';
      // 24. Sept., Markus (Screenshot Tasse): "So koennte dein Motiv auf dem Tasse aussehen."
      // Der Satz hatte den Artikel fest eingebaut. Die Tasse, die Brotdose, die Fussmatte sind
      // weiblich, das Untersetzer-Set ist saechlich, die Socken sind Mehrzahl. aufDem() kennt
      // die Namen, die wir wirklich fuehren (mockups.js GARMENTS, artikel.js ARTIKEL).
      var aufDem = function (n) {
        var w = String(n || '');
        if (WEIBLICH.test(w)) return 'auf der ' + w;
        if (MEHRZAHL.test(w)) return 'auf den ' + w;
        return 'auf dem ' + w;
      };
      // 6. Okt.: jede Stufe zeigt ihr eigenes Teil - Roly fuer Ottos Starter (Freigabe 25. Sept.), wo es eine Roly-Vorlage gibt.
      var rolyDa = ['tee', 'polo', 'hoodie'].indexOf(shown.tab) >= 0;
      var foto = teil.sizes !== false ? (kfStufe === 'deluxe' ? ' Foto: Stanley/Stella (Otto Deluxe).' : kfStufe === 'starter' ? (rolyDa ? ' Foto: Roly (Ottos Starter).' : ' Foto: B&C – von Roly gibt es dieses Teil hier nicht als Bild.') : ' Foto: B&C (Ottos Liebling).') : '';
      if (chest) text = 'Dein ' + teilName + ' – vorne der kleine Brust-Print mit deinem Namen.';
      else if (shown.tab === eigen || !shown.artikel) text = lebendig ? ('Dein ' + teilName + ' ' + wo + ' – so kommt es bei dir an.') : ('Dein ' + teilName + ' – so wird es gedruckt.');
      else {
        text = 'So könnte dein Motiv ' + aufDem(teilName) + ' aussehen' + (lebendig ? ' – ' + wo : '') + '. Entworfen ist es für: ' + shown.artikel.name + '. Das hier ist nur ein Blick, kein Maß.';
        if (teil.eigenesDesign) zusatz = ' <a class="pk-link" href="' + esc(teil.eigenesDesign) + '">Eigenes Design fürs ' + esc(teilName) + ' entwerfen – dann passt es zu 100 %</a>';
      }
      view.innerHTML = esc(text + foto) + zusatz + (sz
        ? ' <span class="ansicht-wahl"><button type="button" data-a="szene"' + (lebendig ? ' class="on"' : '') + '>' + esc(wo.charAt(0).toUpperCase() + wo.slice(1)) + '</button><button type="button" data-a="sachlich"' + (!lebendig ? ' class="on"' : '') + '>Nur das Design</button></span>'
        : '');
      if (sz) [].forEach.call(view.querySelectorAll('button[data-a]'), function (b) { b.addEventListener('click', function () { shown.ansicht = b.dataset.a; drawResult(); }); });
      // 7. Okt., Markus: "Anstatt nur das Produkt ... nur das Design und dann ohne T-Shirt" - die zweite Ansicht neben "Getragen"
      // ist das Motiv allein, so wie es gedruckt wird (ohne Shirt drumherum).
      if (sz && !lebendig && !chest) { view.innerHTML = esc('Dein Design – genau so wird es gedruckt.') + view.innerHTML.slice(view.innerHTML.indexOf(' <span class="ansicht-wahl">')); [].forEach.call(view.querySelectorAll('button[data-a]'), function (b) { b.addEventListener('click', function () { shown.ansicht = b.dataset.a; drawResult(); }); }); zeigeBild(shown.preview + q); drawAlsoOn(m, q, keys); drawKaufformen(m); updateMeta(); return; }
      zeigeBild((lebendig ? m[shown.tab].szene[shown.color] : m[shown.tab][shown.color]) + q + (chest ? '&side=chest' : ''));
    }
    drawAlsoOn(m, q, keys);
    drawKaufformen(m);
    updateMeta();
  }
  // Kaufformen: das fertige Teil (25. Sept.: der DTF-Transfer ist raus, 7. Okt.: die Druckdatei allein auch).
  // Bezahlt wird noch nicht hier -
  // bis der Warenkorb steht, geht eine Anfrage raus.
  var kfWahl = '';
  // 6. Okt.: Beim fertigen Teil stand "auf Anfrage", obwohl die Kasse offen war - die Seite suchte f.preise,
  // der Server liefert seit der Preisliste nur "preisliste". Jetzt der echte Preis aus /preise.js: fuer das
  // gezeigte Teil "ab <Starter>" (Textil) bzw. sein Preis (Flachware), sonst der kleinste Textilpreis.
  function kfPreis(f, teil) {
    var P = window.MoPreise;
    if (f.key === 'textil' && f.preisliste && P) {
      var ab = 0;
      if (P.hatStufen(teil)) ab = P.listenpreis(teil, 'starter');
      else if (P.istBekannt(teil)) ab = P.listenpreis(teil);
      else Object.keys(P.TEXTIL).forEach(function (k) { var v = P.listenpreis(k, 'starter'); if (!ab || v < ab) ab = v; });
      var ein = P.istBekannt(teil) && !P.hatStufen(teil);
      return { cent: Math.round(ab * 100), text: (ein ? '' : 'ab ') + P.euro(anz(ab)) };
    }
    var c = f.key === 'textil' ? ((f.preise || {})[teil] || 0) : (f.preis || 0);
    return { cent: c, text: c > 0 ? (c / 100).toFixed(2).replace('.', ',') + ' €' : 'auf Anfrage' };
  }
  function drawKaufformen(m) {
    var box = $('kaufformen'), row = $('kf-row');
    if (!box || !row) return;
    var formen = (current && current.kaufformen) || [];
    if (!formen.length || !shown.designId) { box.classList.add('hide'); return; }
    box.classList.remove('hide');
    var teil = (m && m[shown.tab]) ? shown.tab : '';
    row.innerHTML = formen.map(function (f) {
      var p = kfPreis(f, teil);
      return '<button type="button" class="kf-card' + (kfWahl === f.key ? ' on' : '') + '" data-k="' + esc(f.key) + '">' +
        '<span class="fuer">' + esc(f.fuer) + '</span><b>' + esc(f.label) + '</b><em>' + esc(f.text) + '</em>' +
        '<span class="preis">' + esc(p.text) + (p.cent > 0 && f.proStueck ? ' <small>je Stück</small>' : '') + '</span></button>';
    }).join('');
    [].forEach.call(row.querySelectorAll('.kf-card'), function (c) {
      c.addEventListener('click', function () { kfWahl = kfWahl === c.dataset.k ? '' : c.dataset.k; kfOeffnen(m); });
    });
    kfOeffnen(m);
    kaufLeiste(m);
  }
  var kfStufe = 'liebling';
  // 6. Okt.: vom Band kommend (?stufe=starter|liebling|deluxe) ist die Linie des Bildes vorgewaehlt - der Kunde waehlt trotzdem frei.
  try { var stufeQ = new URLSearchParams(location.search).get('stufe'); if (['starter', 'liebling', 'deluxe'].indexOf(stufeQ) >= 0) kfStufe = stufeQ; } catch (e) { /* alte Browser: Vorgabe */ }
  // 21. Sept.: die Stufe bestimmt das Foto im Mockup - Ottos Liebling = B&C (Vorgabe des Servers),
  // Otto Deluxe = Stanley/Stella, Ottos Starter = Roly (6. Okt., mit Roly-Freigabe vom 25. Sept.).
  function linieParam() { return kfStufe === 'deluxe' ? '&linie=ss' : kfStufe === 'starter' ? '&linie=roly' : ''; }
  // Firmenkunde angemeldet? Dann netto ausweisen. Markus, 23. Sept.: "Kunden mit Mehrwertsteuer
  // anzeigen und bei Firmenkunden immer die Nettopreise." Gerechnet wird weiter in Brutto (dieselbe
  // Staffel, dieselbe Rundung), nur die Anzeige dreht sich - siehe PREISE.md.
  var firmaNetto = false;
  // Netto nur fuer die Anzeige. Brutto bleibt die Quelle, sonst waeche der Gesamtbetrag
  // um Cents von dem ab, was der Kunde gesehen hat.
  function anz(brutto) {
    var P = window.MoPreise;
    return firmaNetto ? P.netto(brutto) : brutto;
  }
  function jeStueck() { return firmaNetto ? ' je Stück netto' : ' je Stück'; }
  // Fuer das fertige Teil rechnet die Seite mit /preise.js - derselben Datei, die der Server benutzt.
  // 6. Okt.: Warenkorb. kfKorb haelt die schon dazugelegten Teile; das offene Formular ist immer der letzte Posten.
  var kfKorb = [];
  var kfGuthaben = 0;   // bezahlte Entwuerfe in Cent, die beim Textilkauf abgehen (Konto, /api/mo/me)
  var kfGuthabenGeholt = false;
  function kfGuthabenHolen() {
    if (kfGuthabenGeholt) return; kfGuthabenGeholt = true;
    fetchJson(API + '/me', { credentials: 'same-origin' }, 1).then(function (r) {
      var v = r && r.j && r.j.user && +r.j.user.verrechenbar;
      if (v > 0) { kfGuthaben = v; try { kfPreiseZeichnen(); } catch (e) { /* Preisbox noch zu */ } }
    }).catch(function () { /* ohne Konto kein Guthaben */ });
  }
  function kfPosten() {
    var P = window.MoPreise;
    var teil = $('kf-garment').value;
    if (!P || !P.istBekannt(teil)) return null;
    var stoff = P.hatStufen(teil);
    return {
      garment: teil, artikel: teil, label: P.label(teil), menge: Math.max(1, parseInt($('kf-menge').value, 10) || 1),
      stufe: stoff ? kfStufe : null, zweiteSeite: stoff && $('kf-seite').checked,
      groesse: stoff ? (kfListeKomplett() ? '' : (($('kf-groesse') && $('kf-groesse').value) || shown.size || '')) : '',
      liste: stoff && kfListeKomplett(),
      farbeName: teil === shown.tab ? farbName() : ''
    };
  }
  function kfRechnen() {
    var P = window.MoPreise;
    var offen = kfPosten();
    var liste = kfKorb.concat(offen ? [offen] : []);
    if (!P || !liste.length) return null;
    return P.warenkorb(liste.map(function (x) { return { artikel: x.garment, stufe: x.stufe, menge: x.menge, zweiteSeite: x.zweiteSeite }; }),
      { netto: firmaNetto });
  }
  function kfVerrechnet(r) {
    var textil = 0;
    r.posten.forEach(function (p) { if (window.MoPreise.hatStufen(p.artikel)) textil += p.summe; });
    return window.MoPreise.rund(Math.min(kfGuthaben / 100, textil));
  }
  function kfKorbZeichnen() {
    var box = $('kf-korb'); if (!box) return;
    box.classList.toggle('hide', !kfKorb.length);
    box.innerHTML = kfKorb.length ? '<div class="kh">Schon im Warenkorb</div>' + kfKorb.map(function (x, i) {
      var t = [x.label, x.stufe ? ((window.MoPreise.STUFEN.filter(function (st) { return st.key === x.stufe; })[0] || {}).label || '') : '', x.liste ? 'Größen aus der Liste' : (x.groesse ? 'Größe ' + x.groesse : ''), x.zweiteSeite ? 'mit Rückseite' : '', x.farbeName || ''].filter(Boolean).join(' · ');
      return '<div class="kz"><span>' + esc(x.menge + ' × ' + t) + '</span><button type="button" data-weg="' + i + '">entfernen</button></div>';
    }).join('') : '';
    [].forEach.call(box.querySelectorAll('button[data-weg]'), function (b) {
      b.addEventListener('click', function () { kfKorb.splice(+b.getAttribute('data-weg'), 1); kfKorbZeichnen(); kfPreiseZeichnen(); kfKasseZeichnen(); });
    });
  }
  function kfPreiseZeichnen() {
    var P = window.MoPreise;
    var f = ((current && current.kaufformen) || []).filter(function (x) { return x.key === kfWahl; })[0];
    var box = $('kf-stufen'), seite = $('kf-seite-box'), rech = $('kf-rechnung');
    var teil = $('kf-garment').value;
    // 6. Okt.: auch Flachware (Kissen, Poster, Tasse ...) hat ihren Preis - nur Stufen und Rueckseite gibt es dort nicht.
    var mitPreis = !!(f && f.preisliste && P && (P.istBekannt(teil) || kfKorb.length));
    var stoff = !!(mitPreis && P.hatStufen(teil));
    box.classList.toggle('hide', !stoff);
    seite.classList.toggle('hide', !stoff);
    rech.classList.toggle('hide', !mitPreis);
    if (!mitPreis) return;
    if (!stoff) $('kf-seite').checked = false;

    var menge = Math.max(1, parseInt($('kf-menge').value, 10) || 1);
    box.innerHTML = P.STUFEN.map(function (st) {
      var jetzt = P.stueckpreis(teil, st.key, menge);
      var liste = P.listenpreis(teil, st.key);
      return '<button type="button" class="kf-stufe' + (st.key === kfStufe ? ' on' : '') + '" data-st="' + esc(st.key) + '">' +
        (st.hinweis ? '<span class="tipp">' + esc(st.hinweis) + '</span>' : '') +
        '<b>' + esc(st.label) + '</b>' +
        '<span class="pr">' + esc(P.euro(anz(jetzt))) + (jetzt < liste ? '<s>' + esc(P.euro(anz(liste))) + '</s>' : '') + '</span>' +
        (st.unterzeile ? '<em>' + esc(st.unterzeile) + '</em>' : '<em>' + esc(jeStueck().trim()) + '</em>') + '</button>';
    }).join('');
    [].forEach.call(box.querySelectorAll('.kf-stufe'), function (b) {
      b.addEventListener('click', function () { kfStufe = b.dataset.st; kfPreiseZeichnen(); drawResult(); });   // Stufe = Foto im Mockup
    });
    $('kf-seite-preis').textContent = '+ ' + P.euro(anz(P.ZWEITE_SEITE)) + jeStueck() + ', ohne Mengenrabatt';

    var r = kfRechnen();
    if (!r) { rech.innerHTML = ''; return; }
    var zeile = function (k, v, klasse) { return '<div class="z' + (klasse || '') + '"><span>' + k + '</span><b>' + v + '</b></div>'; };
    // Bezahlte Entwuerfe gehen auf Textil ab - dieselbe Rechnung wie in shopify-kasse.js (verrechenbar)
    var verr = kfVerrechnet(r);
    var zahl = P.rund(r.gesamt - verr);
    rech.innerHTML =
      r.posten.map(function (p) {
        return zeile(esc(p.label) + (p.stufeLabel ? ' · ' + esc(p.stufeLabel) : '') + ' × ' + p.menge,
            esc(P.euro(anz(p.stueck))) + jeStueck() + (p.rabatt ? ' <span class="frei">−' + Math.round(p.rabatt * 100) + ' %</span>' : '')) +
          (p.zweiteSeite ? zeile('Zweite Druckseite × ' + p.menge, '+ ' + esc(P.euro(anz(p.seite2))) + jeStueck()) : '');
      }).join('') +
      zeile('Ware' + (firmaNetto ? ' netto' : ''), esc(P.euro(firmaNetto ? r.wareNetto : r.ware))) +
      zeile('Versand', r.versandfrei ? '<span class="frei">frei</span>' : esc(P.euro(anz(r.versand)))) +
      (verr > 0 ? zeile('Bezahlte Entwürfe, verrechnet', '<span class="frei">− ' + esc(P.euro(anz(verr))) + '</span>') : '') +
      // Firmenansicht: netto ist die Hauptzahl, die Steuer steht daneben, der Bruttobetrag
      // darunter - das ist genau die Reihenfolge, in der eine Rechnung gelesen wird.
      (firmaNetto
        ? zeile('Gesamt netto', esc(P.euro(P.netto(zahl))), ' gesamt') +
          zeile('zzgl. ' + Math.round(r.mwstSatz * 100) + ' % MwSt', esc(P.euro(P.rund(zahl - P.netto(zahl))))) +
          zeile('Bruttobetrag', esc(P.euro(zahl)))
        : zeile('Gesamt', esc(P.euro(zahl)), ' gesamt')) +
      '<p class="fuss">' +
      (firmaNetto
        ? 'Firmenkonto: alle Preise <b>netto</b>, zzgl. ' + Math.round(r.mwstSatz * 100) + ' % MwSt' + (r.versandfrei ? '.' : ', zzgl. Versand.')
        : 'Preise inkl. MwSt' + (r.versandfrei ? '.' : ', zzgl. 4,90 € Versand.')) +
      ' Versandfrei ab vier Artikeln oder 79 € Warenwert.' +
      (r.rabatt < 0.28 ? ' Ab ' + naechsteStufe(r.textilien) + ' Stück wird es günstiger.' : '') +
      // Der wichtigste Satz fuer alle, die mehr als fuenf Entwuerfe gebraucht haben.
      '<br><span class="frei">Bezahlte Entwürfe werden hier verrechnet:</span>' +
      ' Der erste Entwurf geht ohne Konto, nach dem Anmelden sind fünf weitere frei; jeder danach kostet 1 € – und dieser Euro geht beim Textilkauf wieder ab' +
      (kfGuthaben > 0 ? ' (bei dir gerade ' + esc(P.euro(kfGuthaben / 100)) + ', oben schon abgezogen).' : ' (angemeldet, an der Kasse automatisch).') + '</p>';
    var kn = $('kf-send');
    if (kn && kfKasse()) kn.textContent = 'Weiter zur Kasse · ' + P.euro(zahl);
  }
  function naechsteStufe(anzahl) {
    var s = window.MoPreise.STAFFEL.slice().sort(function (a, b) { return a.ab - b.ab; });
    for (var i = 0; i < s.length; i++) if (s[i].ab > anzahl) return s[i].ab;
    return s[s.length - 1].ab;
  }

  function kfOeffnen(m) {
    var f = ((current && current.kaufformen) || []).filter(function (x) { return x.key === kfWahl; })[0];
    [].forEach.call(document.querySelectorAll('#kf-row .kf-card'), function (c) { c.classList.toggle('on', c.dataset.k === kfWahl); });
    var form = $('kf-form');
    if (!f) { form.classList.add('hide'); return; }
    form.classList.remove('hide');
    // Die Druckdatei hängt an keinem Teil, die Menge auch nicht - beides nur beim fertigen Teil
    var proStueck = !!f.proStueck;
    $('kf-menge').parentNode.classList.toggle('hide', !proStueck);
    var gsel = $('kf-garment');
    gsel.parentNode.classList.toggle('hide', !proStueck);
    if (proStueck && !gsel.options.length) {
      var keys = Object.keys(m || {});
      gsel.innerHTML = '<option value="">noch offen</option>' + keys.map(function (k) {
        return '<option value="' + esc(k) + '">' + esc(m[k].label) + '</option>';
      }).join('');
    }
    if (proStueck && m && m[shown.tab]) gsel.value = shown.tab;
    var anz = (shown.names || []).length;
    if (proStueck && anz > 1 && +$('kf-menge').value <= 1) $('kf-menge').value = anz;
    $('kf-msg').textContent = '';
    if (f.key === 'textil' && f.kasse) kfGuthabenHolen();
    kfKasseZeichnen();
    kfPreiseZeichnen();
    kaufLeiste(m);
  }
  // Erst die Felder (Groesse da oder weg), dann die Rechnung - sonst rechnet sie mit dem alten Stand.
  ['kf-menge', 'kf-garment', 'kf-seite'].forEach(function (id) {
    var el = $(id);
    if (el) { var neu = function () { kfKasseZeichnen(); kfPreiseZeichnen(); }; el.addEventListener('input', neu); el.addEventListener('change', neu); }
  });
  // 5. Okt., Markus: "wir muessen das alles bauen und fertig bekommen" - die Shopify-Kasse.
  // Ist sie am Server an (kaufformen[textil].kasse, siehe shopify-kasse.js), geht das fertige Teil
  // nicht mehr als Anfrage raus: der Server legt einen Entwurf in Shopify an und schickt den Kunden
  // direkt zur Kasse. Gerechnet wird weiter nur mit preise.js. Die Druckdatei bleibt eine Anfrage.
  function kfKasse() {
    var f = ((current && current.kaufformen) || []).filter(function (x) { return x.key === kfWahl; })[0];
    var g = $('kf-garment') ? $('kf-garment').value : '';
    // 6. Okt.: auch Flachware geht zur Kasse (Kissen, Poster, Tasse ... - alles mit Preis in preise.cjs)
    return !!(f && f.key === 'textil' && f.kasse && window.MoPreise && (window.MoPreise.istBekannt(g) || kfKorb.length));
  }
  // Ist die Kasse ueberhaupt offen? Dann fragt der Kaufkasten die Groesse - die Knoepfe am Bild entfallen.
  function kasseOffen() {
    return ((current && current.kaufformen) || []).some(function (x) { return x.key === 'textil' && x.kasse; });
  }
  // Steht eine Namensliste mit Groesse bei jedem Namen, und die Menge passt, kommt je Person eine Zeile
  // in die Bestellung - dann fragen wir die Groesse nicht noch einmal.
  function kfListeKomplett() {
    var p = shown.people || [];
    return p.length > 0 && p.every(function (x) { return x && x.size; }) && (+$('kf-menge').value || 1) === p.length;
  }
  function kfKasseZeichnen() {
    var knopf = $('kf-send'); if (!knopf) return;
    if (!knopf.getAttribute('data-anfrage')) knopf.setAttribute('data-anfrage', knopf.textContent);
    var kasse = kfKasse();
    var P = window.MoPreise;
    var teil = $('kf-garment') ? $('kf-garment').value : '';
    var stoff = !!(P && P.hatStufen(teil));
    knopf.textContent = kasse ? 'Weiter zur Kasse' : knopf.getAttribute('data-anfrage');
    // 6. Okt.: Groesse gleich hinter dem Produkt - und nur bei Textil
    var box = $('kf-groesse-box');
    if (!box && $('kf-garment')) {
      box = document.createElement('label'); box.id = 'kf-groesse-box';
      box.appendChild(document.createTextNode('Größe'));
      var gs = document.createElement('select'); gs.id = 'kf-groesse'; box.appendChild(gs);
      var gl = $('kf-garment').parentNode; gl.parentNode.insertBefore(box, gl.nextSibling);
      gs.addEventListener('change', function () { shown.size = gs.value; drawSizeChips(); updateMeta(); kfPreiseZeichnen(); });
    }
    var zeigen = kasse && stoff && !kfListeKomplett();
    if (box) box.classList.toggle('hide', !zeigen);
    if (box && zeigen) {
      var sizes = nlSizes();
      var alt = $('kf-groesse').value;
      $('kf-groesse').innerHTML = sizes.map(function (x) { return '<option value="' + esc(x) + '">' + esc(x) + '</option>'; }).join('');
      $('kf-groesse').value = sizes.indexOf(alt) >= 0 ? alt : (sizes.indexOf(shown.size) >= 0 ? shown.size : (sizes.indexOf('M') >= 0 ? 'M' : sizes[0]));
    }
    // An der Kasse fragt Shopify Name und Anschrift - "Euer Name" braucht es nur fuer die Anfrage.
    var nb = $('kf-name-box'); if (nb) nb.classList.toggle('hide', kasse);
    var dazu = $('kf-dazu'); if (dazu) dazu.classList.toggle('hide', !(kasse && P && P.istBekannt(teil)));
    var em = $('kf-email'), lab = em && em.parentNode;
    if (lab && lab.firstChild && lab.firstChild.nodeType === 3) lab.firstChild.textContent = kasse ? 'E-Mail (für die Bestellbestätigung)' : 'E-Mail für die Antwort';
    kfKorbZeichnen();
  }
  // "+ Noch ein Teil dazu": der offene Posten wandert in den Korb, das Formular steht fuer das naechste Teil bereit.
  if ($('kf-dazu')) $('kf-dazu').addEventListener('click', function () {
    var x = kfPosten(); if (!x) return;
    if (window.MoPreise.hatStufen(x.garment) && !x.liste && !x.groesse) { $('kf-msg').textContent = 'Bitte eine Größe wählen.'; return; }
    kfKorb.push(x);
    $('kf-menge').value = 1; $('kf-seite').checked = false;
    $('kf-msg').textContent = x.menge + ' × ' + x.label + ' liegt im Warenkorb. Wähl das nächste Teil – oder weiter zur Kasse.';
    kfKasseZeichnen(); kfPreiseZeichnen();
  });
  function kfZurKasse(msg) {
    var knopf = $('kf-send');
    var email = $('kf-email').value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) { msg.textContent = 'Bitte die E-Mail prüfen – oder das Feld leer lassen, Shopify fragt sie an der Kasse ab.'; return; }
    var offen = kfPosten();
    var posten = kfKorb.concat(offen ? [offen] : []);
    if (!posten.length) { msg.textContent = 'Bitte ein Produkt wählen.'; return; }
    knopf.disabled = true;
    msg.textContent = 'Kasse wird vorbereitet …';
    fetchJson(API + '/kasse', {
      method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({
        designId: shown.designId,
        posten: posten.map(function (x) { return { garment: x.garment, menge: x.menge, stufe: x.stufe || 'liebling', zweiteSeite: !!x.zweiteSeite, groesse: x.groesse, liste: !!x.liste, farbeName: x.farbeName }; }),
        email: email, text: $('kf-text').value.trim()
      })
    }, 1).then(function (r) {
      if (r.ok && r.j && r.j.url) {
        // Fuer den Rueckweg: beim naechsten Besuch fragt die Seite, ob die Zahlung angekommen ist.
        try { if (r.j.kasseId) localStorage.setItem(KASSE_KEY, JSON.stringify({ id: r.j.kasseId, t: Date.now(), designId: shown.designId })); } catch (e) { /* privat: dann ohne Rueckweg-Hinweis */ }
        msg.textContent = 'Weiter zur Kasse …'; location.href = r.j.url; return;
      }
      knopf.disabled = false;
      msg.textContent = (r.j && r.j.error) || 'Die Kasse hat gerade nicht geantwortet. Bitte noch einmal versuchen.';
    }).catch(function () { knopf.disabled = false; msg.textContent = 'Die Kasse hat gerade nicht geantwortet. Bitte noch einmal versuchen.'; });
  }

  // ---- 6. Okt.: Bestellleiste direkt unter dem Design ----
  // Gemessen: der Kaufknopf lag auf dem iPhone bei 4177 px (6 Bildschirme), am Laptop bei 3653 px.
  // Die Leiste klebt unten im Fenster, bis der Kaufkasten selbst im Bild ist; ein Tipp oeffnet das fertige
  // Teil mit Preis und springt hin. Nicht, wenn das Formular offen ist.
  function kaufLeiste(m) {
    var leiste = $('kauf-leiste'), knopf = $('kauf-jetzt'); if (!leiste || !knopf) return;
    var f = ((current && current.kaufformen) || []).filter(function (x) { return x.key === 'textil'; })[0];
    var P = window.MoPreise;
    var aus = !f || !shown.designId || kfWahl === 'textil' || !P;
    leiste.classList.toggle('hide', !!aus);
    if (aus) return;
    var teil = (m && m[shown.tab] && P.istBekannt(shown.tab)) ? shown.tab : '';
    var p = kfPreis(f, teil);
    knopf.textContent = (f.kasse ? 'Bestellen' : 'Anfragen') + (teil ? ' – ' + P.label(teil) : '') + (p.cent > 0 ? ' · ' + p.text : '');
  }
  if ($('kauf-jetzt')) $('kauf-jetzt').addEventListener('click', function () {
    kfWahl = 'textil';
    kfOeffnen(shown.mockups || {});
    var ziel = $('kf-form');
    if (ziel) ziel.scrollIntoView({ block: 'start' });
  });

  // ---- 6. Okt.: Rueckweg von der Kasse ----
  // Shopify schickt den Kunden nach dem Bezahlen nicht zu uns zurueck. Kommt er wieder auf eine Mottoseite,
  // sagt ihm ein Kasten, ob die Zahlung angekommen ist - mit Link auf /bestellung/<nr>, oder zurueck zur Kasse.
  var KASSE_KEY = 'mo_kasse';
  function kasseHinweis() {
    var k = null;
    try { k = JSON.parse(localStorage.getItem(KASSE_KEY) || 'null'); } catch (e) { k = null; }
    if (!k || !k.id || !/^kas_[a-z0-9]+$/.test(k.id)) return;
    if (Date.now() - (+k.t || 0) > 3 * 86400e3) { try { localStorage.removeItem(KASSE_KEY); } catch (e) { /* egal */ } return; }
    fetchJson(API + '/kasse/' + k.id, undefined, 1).then(function (r) {
      if (!r.ok || !r.j) { if (r.status === 404) try { localStorage.removeItem(KASSE_KEY); } catch (e) { /* egal */ } return; }
      var bezahlt = r.j.status === 'bezahlt';
      var box = $('kasse-hinweis');
      if (!box) {
        box = document.createElement('div'); box.id = 'kasse-hinweis'; box.className = 'intro'; box.setAttribute('role', 'status');
        box.style.cssText = 'margin:12px auto;width:calc(100% - 32px);max-width:860px;border:2px solid var(--tinte,#000)';
        var kopf = document.querySelector('.mo-kopf');
        if (kopf && kopf.parentNode) kopf.parentNode.insertBefore(box, kopf.nextSibling); else document.body.insertBefore(box, document.body.firstChild);
      }
      box.innerHTML = bezahlt
        ? '<b style="color:var(--ink)">✓ Bezahlt – deine Bestellung ' + esc(r.j.bestellung || '') + ' ist bei uns.</b> <a class="pk-link" href="/bestellung/' + esc(k.id) + '">Bestellung ansehen</a> <button type="button" id="kasse-zu" class="pk-link" style="background:none;border:0;cursor:pointer">Schließen</button>'
        : '<b style="color:var(--ink)">Deine Bestellung ist noch nicht bezahlt.</b> ' + (r.j.url ? '<a class="pk-link" href="' + esc(r.j.url) + '">Zurück zur Kasse</a> ' : '') + '<a class="pk-link" href="/bestellung/' + esc(k.id) + '">Stand ansehen</a> <button type="button" id="kasse-zu" class="pk-link" style="background:none;border:0;cursor:pointer">Schließen</button>';
      var zu = $('kasse-zu');
      if (zu) zu.addEventListener('click', function () { box.remove(); try { localStorage.removeItem(KASSE_KEY); } catch (e) { /* egal */ } });
    }).catch(function () { /* offline - beim naechsten Mal */ });
  }
  kasseHinweis();
  document.addEventListener('visibilitychange', function () { if (!document.hidden) kasseHinweis(); });

  if ($('kf-send')) $('kf-send').addEventListener('click', function () {
    var msg = $('kf-msg');
    if (!kfWahl || !shown.designId) { msg.textContent = 'Bitte oben eine Variante auswählen.'; return; }
    if (kfKasse()) { kfZurKasse(msg); return; }
    var email = $('kf-email').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) { msg.textContent = 'Bitte eine gültige E-Mail angeben – ohne die können wir nicht antworten.'; return; }
    msg.textContent = 'Wird gesendet …';
    fetchJson(API + '/anfrage', {
      method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({
        designId: shown.designId, form: kfWahl, garment: $('kf-garment').value,
        farbe: $('kf-garment').value === shown.tab ? shown.color.replace(/^f-/, '') : '',
        menge: +$('kf-menge').value || 1, stufe: kfStufe, zweiteSeite: $('kf-seite').checked,
        email: email, name: $('kf-name').value.trim(), text: $('kf-text').value.trim()
      })
    }, 1).then(function (r) {
      if (!r.ok) { msg.textContent = (r.j && r.j.error) || 'Das hat nicht geklappt. Bitte noch einmal versuchen.'; return; }
      msg.textContent = 'Ist angekommen ✓ Wir melden uns mit einem Angebot – eine Bestätigung liegt schon in deinem Postfach.';
      $('kf-text').value = '';
    }).catch(function () { msg.textContent = 'Das hat nicht geklappt. Bitte noch einmal versuchen.'; });
  });
  // Cross-Sell: "Dein Design gibt's auch auf ..." - jedes Produkt als klickbare Karte, direkt anwendbar
  function drawAlsoOn(m, q, reihe) {
    var box = $('alsoon'), row = $('alsoon-row');
    if (!box || !row) return;
    var keys = (reihe && reihe.length) ? reihe : Object.keys(m || {});
    // Der bestellte Artikel ohne eigenes Mockup ist die erste Karte - sonst kaeme man nicht zu ihm zurueck.
    var eigeneKarte = (shown.artikel && !eigeneAnsicht()) ? [{ t: 'motiv', src: shown.preview, label: shown.artikel.name }] : [];
    var karten = eigeneKarte.concat(keys.map(function (k) {
      return { t: k, src: (m[k] && (m[k][shown.color] || m[k][grundFarbe()] || m[k].black || m[k].white)) || shown.preview, label: m[k].label, q: q };
    }));
    if (karten.length < 2 || shown.tab === 'rueckseite') { box.classList.add('hide'); return; }
    box.classList.remove('hide');
    row.innerHTML = karten.map(function (k) {
      return '<div class="alsoon-card' + (shown.tab === k.t ? ' on' : '') + '" data-t="' + k.t + '">' +
        '<img loading="lazy" src="' + k.src + (k.q || '') + '" alt="' + esc(k.label) + '">' +
        '<b>' + esc(k.label) + '</b></div>';
    }).join('');
    [].forEach.call(row.querySelectorAll('.alsoon-card'), function (c) {
      c.addEventListener('click', function () {
        shown.tab = c.dataset.t; drawResult();
        try { img.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { /* egal */ }
      });
    });
  }
  colors.addEventListener('click', function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('button[data-c]') : null;
    if (!b) return;
    shown.color = b.dataset.c; drawResult(); updateMeta();
  });
  // 4. Okt., Markus: "Natuerlich sollen die auch bestellbar sein" - neben Schwarz und Weiss stehen bei T-Shirt und
  // Polo die Farben, die der Server fuer DIESES Motiv gemessen hat (job.mockups[teil].farben, Bild unter 'f-<farbe>').
  // Nur bei Ottos Liebling (B&C): die Farbnamen sind die von B&C, Stanley/Stella hat andere.
  function farbenDesTeils(m) {
    var t = m && m[shown.tab];
    return (t && t.farben && kfStufe !== 'deluxe') ? t.farben : [];
  }
  function grundFarbe() { return /^f-/.test(shown.color) ? 'white' : shown.color; }
  function farbKnoepfe(m) {
    var fb = farbenDesTeils(m);
    if (/^f-/.test(shown.color) && !fb.some(function (f) { return 'f-' + f.key === shown.color; })) shown.color = 'white';
    colors.innerHTML = [{ c: 'black', name: 'Schwarz', hex: '#111' }, { c: 'white', name: 'Weiß', hex: '#f4f4f4' }]
      .concat(fb.map(function (f) { return { c: 'f-' + f.key, name: f.name, hex: f.hex }; }))
      .map(function (x) { return '<button type="button" data-c="' + esc(x.c) + '"' + (x.c === shown.color ? ' class="on"' : '') + '><i style="background:' + esc(x.hex) + '"></i>' + esc(x.name) + '</button>'; }).join('');
  }
  function farbName() {
    if (shown.color === 'black') return 'Schwarz';
    if (shown.color === 'white') return 'Weiß';
    var f = farbenDesTeils(shown.mockups).filter(function (x) { return 'f-' + x.key === shown.color; })[0];
    return f ? f.name : '';
  }
  function personLabel(i) {
    var p = (shown.people && shown.people[i]) || {};
    var extra = [p.size, p.garment].filter(Boolean).join(' · ');
    return shown.names[i] + (extra ? ' (' + extra + ')' : '');
  }
  function personLine(i) {
    var p = (shown.people && shown.people[i]) || {};
    return [shown.names[i], p.size, p.garment].filter(Boolean).join(', ');
  }
  function drawNames() {
    var sel = $('name-pick');
    sel.innerHTML = shown.names.map(function (n, i) { return '<option value="' + i + '">' + esc(personLabel(i)) + '</option>'; }).join('');
    sel.value = String(shown.n);
    var withSize = (shown.people || []).filter(function (p) { return p && (p.size || p.garment); }).length;
    var how = shown.aufteilung === 'brust-kader' ? 'jeder bekommt seinen Brust-Print, hinten stehen alle' : shown.aufteilung === 'vorne-kader' ? 'vorne das Motiv, hinten stehen alle' : 'jeder bekommt seine eigene Druckdatei';
    $('name-count').textContent = shown.names.length + ' Namen · ' + how + (withSize ? ' · ' + withSize + ' mit Größe/Produkt' : '');
    $('names-edit').classList.toggle('hide', !shown.names.length);
    $('names-edit-text').value = shown.names.map(function (n, i) { return personLine(i); }).join('\n');
    // Bestellliste (Namen + Größen) als CSV - gleiche Signatur wie die Vorschau
    var bl = $('bestellliste');
    if (bl) { if (shown.sig && shown.designId) { bl.href = API + '/bestellliste/' + shown.designId + '.csv?exp=' + shown.sig.exp + '&sig=' + shown.sig.sig; bl.style.display = ''; } else bl.style.display = 'none'; }
    var ae = $('names-edit-auf');
    if (ae) { ae.parentNode.classList.toggle('hide', !(current && current.kader)); ae.value = shown.aufteilung || 'vorne'; }
  }
  $('name-pick').addEventListener('change', function () { shown.n = +$('name-pick').value || 0; drawResult(); });
  $('size-pick').addEventListener('change', function () { shown.size = $('size-pick').value; updateMeta(); });
  // 21. Sept., Markus (Malle-Fahrt): "die Groesse war auswaehlbar, aber es war nicht zu sehen, ob
  // es uebernommen hat - erst in der Ansicht." Groessen als Knoepfe: die gewaehlte leuchtet, daneben
  // steht sofort "Groesse L uebernommen", und die Zeile unter dem Bild zieht nach.
  function drawSizeChips() {
    var box = $('size-chips'); if (!box) return;
    var sizes = nlSizes();
    if (sizes.indexOf(shown.size) < 0 && sizes.length) shown.size = sizes.indexOf('M') >= 0 ? 'M' : sizes[0];
    box.innerHTML = sizes.map(function (s) { return '<button type="button" data-size="' + esc(s) + '"' + (s === shown.size ? ' class="on" aria-pressed="true"' : ' aria-pressed="false"') + '>' + esc(s) + '</button>'; }).join('');
    var sp = $('size-pick'); if (sp) sp.value = shown.size;
  }
  $('size-chips').addEventListener('click', function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('button[data-size]') : null;
    if (!b) return;
    shown.size = b.getAttribute('data-size');
    drawSizeChips();
    var ok = $('size-ok'); if (ok) { ok.textContent = '✓ Größe ' + shown.size + ' übernommen'; ok.style.color = 'var(--ok,#2e9e5b)'; ok.style.fontWeight = '800'; }
    updateMeta();
  });

  // Fanclub-Nachweis (Ausweis) hochladen -> Upload + Meldung ans Backend
  $('fc-upload-btn').addEventListener('click', function () { $('fc-file').click(); });
  $('fc-file').addEventListener('change', function () {
    var f = $('fc-file').files[0]; if (!f || !shown.designId) return;
    $('fc-msg').textContent = 'Lade hoch …';
    toJpeg(f, 1600, 0.85).then(function (dataUrl) {
      return fetchJson(API + '/upload', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dataUrl: dataUrl, motto: current && current.slug }) }, 1);
    }).then(function (r) {
      if (!r.ok || !r.j.uploadId) throw 0;
      return fetchJson(API + '/fanclub-nachweis', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ designId: shown.designId, uploadId: r.j.uploadId, email: ($('fc-email') ? $('fc-email').value.trim() : '') }) }, 1);
    }).then(function (r) {
      $('fc-msg').textContent = (r && r.ok) ? 'Danke! Nachweis erhalten – wir prüfen und geben dann den Druck frei. ✓' : 'Das hat nicht geklappt – bitte per E-Mail an otto@motto-otto.de.';
    }).catch(function () { $('fc-msg').textContent = 'Das hat nicht geklappt – bitte per E-Mail an otto@motto-otto.de.'; });
  });
  // Fassung 26: "Gefällt dir dein Design?" - Ja setzt das Foto endgültig ein und löscht das
  // Original sofort, Nein behält es für den nächsten Versuch. Beim Weg "so einsetzen" zeigt die
  // Vorschau das Foto schon drin (nur im Arbeitsspeicher des Servers zusammengesetzt).
  function fotoKnopf(s) {
    var box = $('foto-knopf');
    if (!s.foto || !s.foto.wartet) { box.classList.add('hide'); return; }
    var t = s.foto.texte || {};
    if (s.foto.vorschau) { shown.preview = s.foto.vorschau; drawResult(); }
    $('fk-frage').textContent = t.frage || 'Gefällt dir dein Design?';
    $('fk-hinweis').textContent = (t.jaErklaerung || '') + ' ' + (t.neinErklaerung || '');
    $('fk-ja').textContent = t.jaKnopf || 'Ja, so ist es gut';
    $('fk-nein').textContent = t.neinKnopf || 'Nein, noch mal';
    $('fk-msg').textContent = '';
    box.classList.remove('hide');
    var senden = function (ja) {
      $('fk-ja').disabled = true; $('fk-nein').disabled = true; $('fk-msg').textContent = ja ? 'Druckdatei wird fertig gebaut …' : '…';
      fetchJson(API + '/foto/entscheidung', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ designId: shown.designId, ja: ja }) }, 1)
        .then(function (r) {
          $('fk-ja').disabled = false; $('fk-nein').disabled = false;
          if (!r.ok) { $('fk-msg').textContent = (r.j && r.j.hinweis) || 'Das hat nicht geklappt.'; return; }
          box.classList.add('hide');
          if (ja) {
            fotoSitzung = null;
            if ($('v_foto')) { $('v_foto').value = ''; $('foto-status').textContent = t.nachDemLoeschen || ''; }
            shown.preview = (r.j.preview || shown.preview) + '&v=' + Date.now();
            if (shown.mockups) Object.keys(shown.mockups).forEach(function (k) { ['black', 'white'].forEach(function (c) { if (shown.mockups[k][c]) shown.mockups[k][c] += '&v=' + Date.now(); }); });
            drawResult();
            say(r.j.hinweis || t.nachDemLoeschen || 'Dein Originalfoto ist gelöscht.');
          } else {
            say((r.j.hinweis || '') + ' Ändere, was dir nicht gefällt, und drück noch einmal auf Otto starten.');
            if (!r.j.fotoNochDa) { fotoSitzung = null; }
            refresh();
            go.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }).catch(function () { $('fk-ja').disabled = false; $('fk-nein').disabled = false; $('fk-msg').textContent = 'Das hat nicht geklappt.'; });
    };
    $('fk-ja').onclick = function () { senden(true); };
    $('fk-nein').onclick = function () { senden(false); };
  }
  if ($('firma-nein')) $('firma-nein').addEventListener('click', function () { $('firma-frage').classList.add('hide'); });
  // Fassung 33: Korrektur - das fertige Design wird zur Vorlage, nur geaenderte Texte werden ausgetauscht
  var korrekturVon = null;
  // 19. Okt., Markus: "ein Tool, um an einem Design, das den Kunden gefaellt, nur Teilstuecke zu aendern" - derselbe
  // Weg wie die Korrektur (das fertige Design ist die Vorlage), nur sagt der Kunde frei, WAS anders werden soll.
  var aenderung = '';
  if ($('aendern-btn')) $('aendern-btn').addEventListener('click', function () {
    if (!shown.designId) { say('Es ist noch kein fertiges Design da, an dem sich etwas ändern ließe.', true); return; }
    var t = String(($('aendern-text') && $('aendern-text').value) || '').trim();
    if (!t) { say('Sag Otto, was anders werden soll – zum Beispiel „den Hintergrund weglassen“.', true); if ($('aendern-text')) $('aendern-text').focus(); return; }
    korrekturVon = shown.designId; aenderung = t;
    refresh();
    go.disabled = false; go.click();
  });
  if ($('korrektur-btn')) $('korrektur-btn').addEventListener('click', function () {
    // 24. Sept., Markus: "Text korrigieren. Anklicken funktioniert nicht." Es funktionierte
    // doch - man sah es nur nicht. Nach dem fertigen Design springt die Abfolge auf den LETZTEN
    // Schritt (Zeile "abfolge.zeige(schritte.length - 1)"), und das Textfeld liegt in einem
    // frueheren, versteckten Schritt. Der Knopf scrollte also zu einem Kasten, in dem nichts
    // zu aendern war. Jetzt springt die Abfolge zu dem Schritt, in dem der Text WIRKLICH steht.
    if (!shown.designId) { say('Es ist noch kein fertiges Design da, das sich korrigieren liesse.', true); return; }
    korrekturVon = shown.designId;
    refresh();
    var ziel = null;
    if (abfolge && abfolge.schritte && abfolge.schritte.length) {
      for (var si = 0; si < abfolge.schritte.length && ziel === null; si++) {
        var fl = abfolge.schritte[si].felder || [];
        for (var fi = 0; fi < fl.length; fi++) {
          var f = null, alle = (current && current.fields) || [];
          for (var ai = 0; ai < alle.length; ai++) if (alle[ai].key === fl[fi]) { f = alle[ai]; break; }
          if (f && f.printed !== false && f.versteckt !== true && (f.type === 'text' || f.type === 'textarea')) { ziel = si; break; }
        }
      }
      if (ziel !== null) abfolge.zeige(ziel);
    }
    say('Korrektur von ' + shown.designId + ': Ändere nur den Text, der falsch ist'
      + (ziel !== null ? ' – mit „Weiter“ kommst du zu den übrigen Textfeldern' : '')
      + ', und drück dann auf „Korrektur starten“. Das Motiv bleibt, nur der Text wird ausgetauscht.');
    var hin = (ziel !== null && document.querySelector('.ab-schritt.on')) || fieldsBox;
    if (hin && hin.scrollIntoView) hin.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  function updateMeta() {
    if (!shown.designId) return;
    var t = shown.mockups && shown.mockups[shown.tab];
    var g = t ? t.label : '';
    var withSize = t && t.sizes !== false;
    // Freestyle: bestellt ist der Artikel, nicht der Reiter. Sonst stand hier "T-Shirt · Größe M",
    // obwohl ein Strandtuch bestellt war.
    if (shown.artikel) {
      var eig = eigeneAnsicht();
      meta.textContent = 'Design-Nummer ' + shown.designId + ' · ' + shown.artikel.name +
        (shown.artikel.label ? ' · ' + shown.artikel.label : '') +
        (shown.tab === eig && withSize ? ' · Größe ' + shown.size : '');
      return;
    }
    var fn = t && !shown.artikel ? farbName() : '';
    meta.textContent = 'Design-Nummer ' + shown.designId + (g ? ' · ' + g + (fn ? ' · ' + fn : '') + (withSize ? ' · Größe ' + shown.size : '') : '');
  }
  $('names-edit-save').addEventListener('click', function () {
    var list = $('names-edit-text').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
    $('names-edit-save').disabled = true;
    var wantAuf = $('names-edit-auf') ? $('names-edit-auf').value : shown.aufteilung;
    fetchJson(API + '/names', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ designId: shown.designId, names: list, aufteilung: wantAuf }) }, 1)
      .then(function (r) {
        $('names-edit-save').disabled = false;
        if (!r.ok) { $('names-edit-msg').textContent = r.j && r.j.error === 'verboten' ? VERBOTEN_TEXT : r.j && r.j.error === 'marke' ? ('„' + (r.j.wort || '') + '" ist ein geschützter Name und darf nicht auf ein Textil.') : (r.j && r.j.error === 'zeichen nicht erlaubt' ? 'Zeichen, die wir nicht drucken können: ' + (r.j.feld || '') : 'Das hat nicht geklappt.'); return; }
        shown.names = r.j.names || []; shown.people = r.j.people || []; shown.n = 0;
        if (r.j.sig) shown.sig = r.j.sig;
        var oldAuf = shown.aufteilung; shown.aufteilung = r.j.aufteilung || 'vorne';
        // Aufteilung geändert: Rückseiten-Reiter nachziehen (Kaderliste kommt/geht) - ohne neues Bild
        if (shown.aufteilung !== oldAuf && shown.sig) {
          if (shown.aufteilung !== 'vorne' && shown.names.length) {
            var bq = 'exp=' + shown.sig.exp + '&sig=' + shown.sig.sig + '&side=back', bm2 = {};
            Object.keys(shown.mockups || {}).forEach(function (k) { bm2[k] = { label: shown.mockups[k].label, view: shown.mockups[k].view, black: API + '/mockup/' + shown.designId + '/' + k + '/black.jpg?' + bq, white: API + '/mockup/' + shown.designId + '/' + k + '/white.jpg?' + bq }; });
            shown.back = { count: shown.names.length, kader: true, preview: API + '/preview/' + shown.designId + '.png?' + bq, mockups: bm2 };
          } else if (shown.back && shown.back.kader) { shown.back = null; if (shown.tab === 'rueckseite') shown.tab = startReiter(shown); }
        }
        var ch = (r.j.bereinigt || []).map(function (c) { return c.nachher ? ('„' + c.vorher + '" → „' + c.nachher + '"') : ('„' + c.vorher + '" weggelassen'); });
        $('names-edit-msg').textContent = 'Übernommen – ' + shown.names.length + ' Namen.' + (ch.length ? ' Angepasst (Emojis setzen wir in Namen nicht): ' + ch.join(' · ') : '');
        drawNames(); drawResult();
      }).catch(function () { $('names-edit-save').disabled = false; });
  });

  var textilNurBeiTextil = function () {}, textilVomArtikel = null;
  // 1. Okt. (MASTER.md 8): Symbole als SVG statt Emoji - sieht auf jedem Handy gleich aus.
  var SYM_KAMERA = '<svg class="sym" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.4-2h4.6l1.4 2h1.8A2.5 2.5 0 0 1 20 8.5v9A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5z"/><circle cx="12" cy="12.8" r="3.6"/></svg>';
  var all = [], current = null, uploadId = null, uploadId2 = null, poll = null, tick = null, started = 0, phase = '', phaseZusatz = '', style = 'standard', textile = 'weiss', textilSelbstGewaehlt = false, nameFont = 'rund';
  // Fassung 43 (Markus, 15. Sept.): Solange ein Logo hochgeladen, nachgezeichnet oder noch nicht
  // bestaetigt ist, darf Otto nicht starten - sonst laeuft das Design ohne Logo los, weil die
  // Datei zu diesem Zeitpunkt noch gar nicht angenommen ist.
  var logoArbeit = null; // 'upload' | 'nachzeichnen' | 'entscheidung'
  function logoArbeitSetzen(was) { logoArbeit = was || null; refresh(); }
  // Fassung 24-26: Kundenfoto-Sitzung (nur eine Kennung, das Foto selbst bleibt im RAM des Servers) und der Artikelkatalog
  var fotoSitzung = null, fsKatalog = null;
  var fotoAnnehmen = null;   // wird im Freestyle-Aufbau gesetzt
  // 20. Sept.: die Abfolge (abfolge.js) - ein Bildschirm je Frage. Liegt am Motto ("abfolge" in
  // der Motto-Datei); dann uebernimmt sie das Zeigen und Verstecken.
  var abfolge = null;
  // 6. Okt.: schmaler Zugang fuer das Gespraech mit Otto (otto-gespraech.js) - Schritte, Start-Knopf, laeuft gerade ein Auftrag?
  window.MoSeite = { abfolge: function () { return abfolge; }, motto: function () { return current; }, laeuft: function () { return !!runActive; } };
  // 20. Sept., Markus: "Das muessten wir bei allen Themen, bei jedem Motto, ueberall genauso
  // machen." Ohne eigenen Eintrag baut abfolge.js die Standard-Abfolge aus den Feldern des
  // Mottos. Nur ein Motto mit "ohneAbfolge" bekommt die alte Seite.
  function mitAbfolge() { return !!(current && window.MoAbfolge && !current.ohneAbfolge); }
  // Ein Stil-Bildschirm zeigt vier Stile, der Rest steht hinter "Mehr Stile zeigen".
  function stileKuerzen() {
    var box = $('styles'); if (!box) return;
    var btns = box.querySelectorAll('button[data-s]');
    if (btns.length <= 4 || $('pk-mehr-stile')) return;
    for (var i = 4; i < btns.length; i++) btns[i].classList.add('hide');
    box.insertAdjacentHTML('afterend', '<button type="button" class="pk-link" id="pk-mehr-stile">Mehr Stile zeigen</button>');
    $('pk-mehr-stile').addEventListener('click', function () { [].forEach.call(btns, function (b) { b.classList.remove('hide'); }); this.classList.add('hide'); });
  }
  // Einsprechen in die grossen Textfelder der Schritte (siehe Feldbau, f.type === 'textarea'). Ein Klick startet, der
  // naechste beendet; der Text kommt an das Getippte dran, und das Feld meldet 'input' wie beim Tippen.
  var FeldSR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  var feldErk = null, feldKnopf = null, feldWill = false;
  // 6. Okt., Markus: "schneidet wieder bei den Woertern ab ... unbegrenzt" und die Text-KI dazu. Hoeren, bis "Fertig" getippt
  // wird (beendet der Browser nach einer Pause selbst, geht es weiter); danach zieht /api/mo/text-glaetten den Text glatt
  // (kuerzt nichts), "Original" holt das Gesprochene zurueck.
  function feldGlaetten(feld, msg) {
    var original = feld.value.trim();
    if (original.length < 3) return;
    msg.textContent = 'Otto räumt deinen Text auf …';
    fetchJson(API + '/text-glaetten', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: original }) }, 1).then(function (r) {
      var j = r && r.j;
      if (!r || !r.ok || !j || j.unveraendert || !j.text || feld.value.trim() !== original) { msg.textContent = 'Alles drin? Sonst noch einmal antippen und weitersprechen.'; return; }
      feld.value = j.text; feld.dispatchEvent(new Event('input', { bubbles: true })); feld.dispatchEvent(new Event('change', { bubbles: true }));
      msg.innerHTML = 'Otto hat deinen Text aufgeräumt. <button type="button" class="feld-original" style="font:inherit;font-weight:700;text-decoration:underline;background:none;border:0;padding:0;cursor:pointer;color:inherit">Original zeigen</button>';
      var o = msg.querySelector('.feld-original');
      if (o) o.addEventListener('click', function () { feld.value = original; feld.dispatchEvent(new Event('input', { bubbles: true })); feld.dispatchEvent(new Event('change', { bubbles: true })); msg.textContent = 'Das Original steht wieder drin.'; });
    });
  }
  document.addEventListener('click', function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('.feld-mic') : null;
    if (!b || !FeldSR) return;
    var feld = $(b.getAttribute('data-ziel')), msg = b.parentNode.querySelector('.feld-mic-msg');
    if (!feld) return;
    if (feldErk) { var war = feldKnopf; feldWill = false; try { feldErk.stop(); } catch (e) { /* egal */ } if (war === b) return; }
    feldWill = true;
    var starten = function () {
      var erk = new FeldSR(); erk.lang = 'de-DE'; erk.interimResults = true; erk.continuous = true;
      var vorher = feld.value.trim(), fertig = '';
      erk.onresult = function (e2) {
        var zwischen = '';
        for (var i = e2.resultIndex; i < e2.results.length; i++) { var t = e2.results[i][0].transcript; if (e2.results[i].isFinal) fertig += t + ' '; else zwischen += t; }
        feld.value = ((vorher ? vorher + ' ' : '') + (fertig + zwischen).trim()).slice(0, Number(feld.getAttribute('maxlength')) || 5000);
        feld.dispatchEvent(new Event('input', { bubbles: true }));
      };
      erk.onerror = function (e2) { if (e2.error === 'not-allowed' || e2.error === 'service-not-allowed') { feldWill = false; msg.textContent = 'Bitte das Mikrofon erlauben – oder einfach tippen.'; } };
      erk.onend = function () {
        if (feldErk === erk && feldWill) { try { starten(); return; } catch (e4) { feldWill = false; } }
        if (feldErk === erk) { feldErk = null; feldKnopf = null; }
        b.textContent = '🎤 Einsprechen';
        feld.dispatchEvent(new Event('change', { bubbles: true }));
        if (!/erlauben/.test(msg.textContent)) feldGlaetten(feld, msg);
      };
      feldErk = erk; feldKnopf = b;
      erk.start();
    };
    msg.textContent = 'Ich höre zu … zum Beenden noch einmal antippen.';
    b.textContent = '⏹ Fertig';
    try { starten(); } catch (e3) { feldWill = false; feldErk = null; feldKnopf = null; b.textContent = '🎤 Einsprechen'; msg.textContent = 'Das hat nicht geklappt – tipp es einfach.'; }
  });
  // Firmenkonto: ein einmal hinterlegtes Logo wird hier vorgeschlagen, statt dass der
  // Betrieb es bei jedem Auftrag neu heraussucht. Genau dafuer gibt es den Firmenbereich.
  var firmenLogo = null, firmenName = '', firmenListen = [], listenFeld = null, firmenDaten = null;

  // Firmenkonto: die Design-Seite geht AUSGEFUELLT auf. "Da muesste ja schon alles eingetragen
  // sein, was zu der Firma passt." Firma, Ort und Gewerk kommen aus den Firmendaten, das Logo
  // ueber logoVorschlagen(). Nur leere Felder werden gefuellt - was der Kunde tippt, bleibt.
  function firmenFelderVorbelegen() {
    if (!firmenDaten || !current) return;
    var f = firmenDaten, geaendert = false;
    function setze(key, wert) {
      var el = $('v_' + key); if (!el || !wert || el.value.trim()) return;
      el.value = wert; geaendert = true;
    }
    setze('firma', f.name); setze('betrieb', f.name);
    setze('ort', f.ort); setze('stadt', f.ort);
    var sel = $('v_gewerk');
    if (sel && f.gewerk && sel.tagName === 'SELECT' && !sel.value) {
      var g = String(f.gewerk).toLowerCase(), treffer = null, anderes = null;
      Array.prototype.forEach.call(sel.options, function (o) {
        var t = String(o.value || o.textContent).toLowerCase();
        if (!treffer && t && (t === g || t.indexOf(g) >= 0 || g.indexOf(t) >= 0)) treffer = o.value || o.textContent;
        if (/anderes/.test(t)) anderes = o.value || o.textContent;
      });
      if (treffer) { sel.value = treffer; geaendert = true; }
      else if (anderes) { sel.value = anderes; setze('gewerk_frei', f.gewerk); geaendert = true; }
      if (geaendert) sel.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (sel && f.gewerk) { setze('gewerk', f.gewerk); }
    if (geaendert && typeof refresh === 'function') refresh();
  }
  fetch('/api/mo/firma', { credentials: 'same-origin' }).then(function (r) { return r.json(); })
    .then(function (d) {
      // Kein Firmenkonto: dann das im Browser gemerkte Logo anbieten (jetzt, nach dem Aufbau der Felder)
      if (!d || !d.angemeldet) { logoVorschlagen(); return; }
      firmenName = (d.firma && d.firma.name) || '';
      firmenDaten = d.firma || null;
      firmenListen = d.listen || [];
      // Firmenkonto = Unternehmer. Ab hier stehen Nettopreise da, und zwar sofort:
      // die Preisliste kann schon gezeichnet sein, wenn diese Antwort eintrifft.
      firmaNetto = !!d.netto;   // 7. Okt.: nur Firmen mit Unternehmer-Erklaerung, nicht jedes angemeldete Konto
      try { kfPreiseZeichnen(); } catch (e) { /* Preisbox noch nicht offen - dann beim Oeffnen */ }
      if (d.firmaLogo) { firmenLogo = d.firmaLogo; logoVorschlagen(); }
      listenAnbieten();
      firmenFelderVorbelegen();
    })
    .catch(function () { logoVorschlagen(); /* kein Firmenkonto - dann eben nicht */ });

  // Gespeicherte Mitarbeiterlisten aus dem Firmenkonto anbieten. Das ist die zweite
  // Haelfte des Versprechens im Firmenbereich: einmal eintragen, beim naechsten Auftrag
  // auswaehlen. Eingesetzt wird ueber denselben Weg wie eine hochgeladene Datei - also
  // dieselben Regeln, dieselbe Anzeige, und der Kunde kann danach frei weiterbearbeiten.
  function listenAnbieten() {
    if (!listenFeld || !firmenListen.length) return;
    var werkzeuge = document.querySelector('.names-tools');
    if (!werkzeuge || $('firmen-listen')) return;
    var sel = document.createElement('select');
    sel.id = 'firmen-listen';
    sel.style.cssText = 'margin-right:8px;max-width:230px';
    sel.innerHTML = '<option value="">Gespeicherte Liste einsetzen …</option>' +
      firmenListen.map(function (l) {
        return '<option value="' + esc(l.id) + '">' + esc(l.name) + ' (' + (l.leute || []).length + ')</option>';
      }).join('');
    werkzeuge.insertBefore(sel, werkzeuge.firstChild);
    sel.addEventListener('change', function () {
      var l = firmenListen.filter(function (x) { return x.id === sel.value; })[0];
      if (!l) return;
      var zeilen = (l.leute || []).map(function (pp) {
        return [pp.name, pp.size || '', pp.garment || ''].filter(Boolean).join('; ');
      });
      var ta = $('v_' + listenFeld);
      var schon = ta.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
      // Anhaengen statt ersetzen: wer schon jemanden eingetragen hat, verliert ihn nicht.
      ta.value = schon.concat(zeilen).slice(0, 100).join('\n');
      nlAufbauen(listenFeld, $('nl_' + listenFeld).dataset.kontakt === '1');
      $('names-info').textContent = zeilen.length + ' Personen aus „' + l.name + '" übernommen.';
      refresh();
      sel.value = '';
    });
  }

  // Das Logo eintragen, als haette der Kunde es gerade hochgeladen. Er kann es jederzeit
  // mit "Entfernen" wegnehmen und ein anderes waehlen - vorgeschlagen ist nicht verordnet.
  // ---- Nachgezeichnetes Logo merken (Fassung 56) ----
  // Angemeldet: ans Konto (dort wird es bei jedem Design vorgeschlagen, siehe Firmenbereich).
  // Gast: im Browser gemerkt und beim naechsten Besuch angeboten. Nichts wird doppelt gezeichnet.
  var LOGO_KEY = 'mo_logo';
  function logoMerken(j, name) {
    var eintrag = { uploadId: j.uploadId, vorschau: j.vorschau, name: name || '', width: j.width, height: j.height, at: Date.now() };
    function lokal() { try { localStorage.setItem(LOGO_KEY, JSON.stringify(eintrag)); } catch (e) { /* privates Fenster */ } say('Logo gemerkt – beim nächsten Design in diesem Browser wird es gleich vorgeschlagen.'); }
    fetchJson(API + '/firma/logo', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ uploadFile: j.uploadId }) }, 0)
      .then(function (r) { if (r.ok) { firmenLogo = j.uploadId; say('Logo im Konto hinterlegt – es wird beim nächsten Design gleich vorgeschlagen.'); } else lokal(); })
      .catch(lokal);
  }
  function logoGemerkt() { try { return JSON.parse(localStorage.getItem(LOGO_KEY) || 'null'); } catch (e) { return null; } }
  function logoVergessen() { try { localStorage.removeItem(LOGO_KEY); } catch (e) { /* egal */ } }

  function logoVorschlagen() {
    var gemerkt = firmenLogo ? null : logoGemerkt();
    if ((!firmenLogo && !(gemerkt && gemerkt.uploadId)) || !current || uploadId) return;
    // Fassung 37 (Markus, 14. Sept.): das Firmenlogo nur dort vorschlagen, wo ein Logo gebraucht
    // wird - bei gewerblichen Mottos mit Logo-Feld. Beim Motorrad oder Landwirt ist das Feld ein
    // FOTO als Vorlage, dort hat das Firmenlogo nichts verloren.
    if (!current.upload || current.upload.mode !== 'exact' || !current.firmenFrage) return;
    if (firmenLogo && /^fr_/.test(firmenLogo)) {
      // 1. Okt.: das Logo des freigegebenen Betriebs aus dem Link (/bei/<slug>) - es bleibt drauf,
      // der Knopf zum Entfernen ist weg (Markus: "100 % das EAST-Logo drauf").
      uploadId = firmenLogo;
      $('thumb-img').src = '/api/mo/firmenlogo/' + encodeURIComponent(firmenLogo.replace(/^fr_/, '').replace(/\.png$/, '')) + '.png';
      $('thumb-name').textContent = (firmenName ? firmenName + ' · ' : '') + 'das Logo des Hauses - bleibt drauf';
      if ($('thumb-del')) $('thumb-del').classList.add('hide');
    } else if (firmenLogo) {
      uploadId = firmenLogo;
      $('thumb-img').src = '/api/mo/firma/logo.png?v=' + encodeURIComponent(firmenLogo);
      $('thumb-name').textContent = (firmenName ? firmenName + ' · ' : '') + 'euer hinterlegtes Firmenlogo';
    } else {
      // Das im Browser gemerkte, nachgezeichnete Logo - spart das Nachzeichnen beim naechsten Design
      uploadId = gemerkt.uploadId;
      $('thumb-img').src = gemerkt.vorschau || '';
      $('thumb-name').textContent = 'Dein gemerktes Logo' + (gemerkt.name ? ' · ' + gemerkt.name : '') + ' (nachgezeichnet)';
    }
    thumb.classList.remove('hide');
    drop.classList.add('hide');
    if (typeof refresh === 'function') refresh();
  }
  // Fassung 15: Farbstimmung und Druckplatzierung reisen wie der Stil mit
  var mood = 'standard', placement = '', nameArt = 'unten', figuren = 'standard';
  // Fassung 59: Logo eingearbeitet (nachgezeichnet, Standard) oder Original exakt auf eigener Flaeche
  var logoArt = 'eingearbeitet';
  // Fassung 53: "Passend zum Logo" ist die Voreinstellung, sobald ein Logo hochgeladen ist.
  // Wer selbst etwas anderes antippt, behaelt seine Wahl - auch beim naechsten Upload.
  var moodSelbstGewaehlt = false;
  function moodsAnpassen() {
    var kasten = $('moods'); if (!kasten) return;
    var knopf = kasten.querySelector('[data-nurlogo]');
    if (!knopf) return;
    var da = !!uploadId;
    knopf.classList.toggle('hide', !da);
    if (da && !moodSelbstGewaehlt && mood === 'standard') mood = 'logo';
    if (!da && mood === 'logo') mood = 'standard';
    Array.prototype.forEach.call(kasten.querySelectorAll('button'), function (x) {
      x.classList.toggle('on', x.getAttribute('data-m') === mood);
    });
  }
  // Welches Textil gehoert zu einem Stil? Die Antwort kommt vom Server (STIL_TEXTIL in
  // mottos.js, je Stil aus seinem eigenen Palettentext begruendet). Hier stand bis zum
  // 23. Sept. "var NUR_HELL = { aquarell: true }" - EIN Stil von siebzehn, von Hand
  // eingetragen. Darum landete alles andere auf Dunkel, auch Vintage und Meisterwerk,
  // deren Paletten dafuer gar nicht gemacht sind.
  // Wo wir es in einem Satz genauer sagen koennen als die allgemeine Regel, sagen wir es genauer.
  var TEXTIL_GRUND = {
    aquarell: 'Aquarell wird auf hellem Textil gedruckt: Die hellsten Stellen eines Aquarells sind unbemaltes Papier – auf schwarzem Stoff wären genau die durchsichtig.',
    vintage: 'Vintage wird auf hellem Textil gedruckt: Ein ausgewaschener 70er-Siebdruck lebt von Creme, Senf und Rost – gedeckte Töne, die auf Schwarz absaufen.',
    tattoo: 'Tattoo wird auf hellem Textil gedruckt: Die dicken schwarzen Linien und die schwarze Schattierung sind das Gerüst der Zeichnung – auf schwarzem Stoff bliebe davon nichts übrig.',
    japan: 'Japan wird auf hellem Textil gedruckt: Ein Holzschnitt ist Druckfarbe auf hellem Papier, mit schwarzer Konturplatte.',
    comic: 'Comic wird auf hellem Textil gedruckt: Tinte auf Papier – die tiefen Schwarzflächen der Schattierung brauchen einen hellen Grund.',
    popart: 'Pop-Art wird auf hellem Textil gedruckt: Die Ben-Day-Raster liegen klassisch auf cremefarbenem Grund, und die schwarzen Konturen sind dick.',
    meisterwerk: 'Meisterwerk wird auf hellem Textil gedruckt: Creme, Elfenbein und sonnenwarmes Ocker tragen das Bild – ein heller Stil auf hellem Stoff.',
    neon: 'Neon wird auf dunklem Textil gedruckt: Leuchtröhren leuchten nur nachts.',
    graffiti: 'Graffiti wird auf dunklem Textil gedruckt: Der Stoff ist die Wand, und die weißen Glanzlichter brauchen einen dunklen Grund.',
    streetart: 'Street Art wird auf dunklem Textil gedruckt: Das reine Weiß knallt nur gegen tiefes Schwarz.',
    minimal: 'Minimalistisch wird auf dunklem Textil gedruckt: Zwei Farben, und die tragende ist gebrochenes Weiß – auf hellem Stoff bliebe davon nichts.',
    college: 'College wird auf dunklem Textil gedruckt: Der Varsity-Druck sitzt klassisch auf dem dunklen Trikot.',
    fotoreal: 'Fotorealistisch wird auf dunklem Textil gedruckt: Das Motiv wird lesbar, weil sein Material hell beleuchtet ist – gegen dunklen Stoff.',
    robotic: 'Robotic wird auf dunklem Textil gedruckt: Chrom, Gunmetal und glühende Leiterbahnen brauchen den dunklen Grund.'
  };
  // Vier Toene seit dem 25. Sept.: weiss und schwarz sind die REINEN - dort bleibt unbedruckt,
  // was die Stofffarbe haben soll. hell und dunkel sind Buntfarben, dort wird alles gedruckt.
  var TEXTILTOENE = ['weiss', 'hell', 'dunkel', 'schwarz'];
  function hellerStoff(t) { return t === 'hell' || t === 'weiss'; }
  // Ein Stil legt nur die GRUPPE fest ('hell' oder 'dunkel'), nicht den genauen Ton - sonst
  // koennte ein Stil, der helles Textil verlangt, das reine Weiss nicht mehr zulassen.
  function tonGruppe(t) { return hellerStoff(t) ? 'hell' : 'dunkel'; }
  function stilTextil(k) {
    var st = ((current && current.styles) || []).filter(function (s) { return s.key === k; })[0];
    return (st && st.textil) || '';
  }

  function esc(s) { return String(s == null ? '' : s).replace(/[<>&"]/g, function (c) { return ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]; }); }
  function say(t, err) { status.textContent = t || ''; status.className = 'status' + (err ? ' err' : ''); var ma = $('marke-ausweg'); if (ma && t !== status.dataset.markeText) ma.remove(); }
  // 6. Okt., Markus (Blues Brothers, berechtigt gesperrt): "Jetzt waere es ja schoen, dass wir das in dem Stil machen, dass es
  // ansatzweise so aussieht, aber ohne dass es rechtliche Probleme gibt." Bei einer Markensperre im Freestyle: Ausweg statt
  // Sackgasse - eigener Text, die Text-KI beschreibt den Look frei (/api/mo/marke-ausweg), dann baut Otto sofort.
  // 6. Okt., Markus: "wenn gesperrte Woerter drin sind, dass wir gar nicht anfangen zu produzieren ... Kunden direkt drauf
  // hinweisen, ganz lieb und nett. Wir koennen das hoechstens im aehnlichen Stil machen. Dann kurze Abfrage, ob ja oder nein."
  // Freestyle: Ja = die Text-KI beschreibt den Look frei nach (/api/mo/marke-ausweg), Otto baut sofort.
  // Andere Mottos: Ja = der Name kommt aus dem Feld raus, Otto baut; geht das nicht, fuehrt Ja zum Feld.
  // Nein = zurueck zum Feld, der Kunde sagt es anders. Per Sprache: "ja" / "nein" (otto-gespraech.js, window.MoMarkeFrage).
  function markeFrageFeld(wort, eingabe) {
    var w = String(wort || '').toLowerCase(), e = String(eingabe || '');
    var fs = (current && current.fields) || [];
    for (var i = 0; i < fs.length; i++) {
      var el = $('v_' + fs[i].key); if (!el || typeof el.value !== 'string' || !el.value) continue;
      if ((e && el.value === e) || (w && el.value.toLowerCase().indexOf(w) >= 0)) return { f: fs[i], el: el };
    }
    return null;
  }
  function zumFeld(t) {
    if (!t) return;
    if (abfolge) for (var si = 0; si < abfolge.schritte.length; si++) {
      if ((abfolge.schritte[si].felder || []).indexOf(t.f.key) >= 0) { abfolge.zeige(si); break; }
    }
    setTimeout(function () { try { t.el.focus(); t.el.select(); } catch (e) { /* egal */ } }, 250);
  }
  function markeFrage(wort, eingabe) {
    if (!current) return;
    var alt = $('marke-ausweg'); if (alt) alt.remove();
    var frei = !!current.freestyle && !!$('v_motiv');
    var ziel = frei ? { f: { key: 'motiv' }, el: $('v_motiv') } : markeFrageFeld(wort, eingabe);
    // die feste Liste meldet das Wort normalisiert (ADIDAS) - gezeigt wird es so, wie es im Feld steht
    var treffer = wort && ziel ? new RegExp(String(wort).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[\\s-]*'), 'i').exec(ziel.el.value) : null;
    if (treffer) wort = treffer[0];
    var name = wort ? '„' + wort + '“' : 'Das';
    var frage = 'Oh, ' + name + ' ist geschützt – das dürfen wir leider nicht drucken. ' +
      (frei ? 'Ich kann dir aber etwas im ähnlichen Stil machen, ganz ohne das. Möchtest du das?'
            : 'Soll ich das einfach weglassen und den Rest so machen?');
    say(frage);
    status.dataset.markeText = status.textContent;
    status.insertAdjacentHTML('afterend', '<div id="marke-ausweg" class="marke-frage">' +
      '<div class="marke-knoepfe"><button type="button" id="ma-los">Ja, gerne</button><button type="button" id="ma-nein" class="leise">Nein, ich ändere es</button></div>' +
      (frei ? '<label class="marke-eigen">Euer eigener Text auf dem Design (freiwillig)<input id="ma-eigen" maxlength="60" placeholder="z. B. Harmstorf Brothers"></label>' : '') +
      '<div id="ma-msg" class="hint" aria-live="polite"></div></div>');
    var ende = function () { window.MoMarkeFrage = null; var ma = $('marke-ausweg'); if (ma) ma.remove(); };
    var nein = function () { ende(); say('Alles klar – ändere es einfach, ohne ' + name + '. Danach geht es mit „Otto starten“ weiter.'); zumFeld(ziel); };
    var ja = function () {
      var b = $('ma-los'); if (!b || b.disabled) return;
      if (!frei) {
        var rest = ziel ? ziel.el.value.replace(new RegExp(String(wort || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ').replace(/\s+/g, ' ').trim() : '';
        if (!ziel || (!rest && ziel.f.required)) { ende(); say('Dann schreib an dieser Stelle einfach etwas Eigenes – zum Beispiel euren Ort, eure Farben oder einen eigenen Spruch.'); zumFeld(ziel); return; }
        ziel.el.value = rest; ziel.el.dispatchEvent(new Event('input', { bubbles: true })); ziel.el.dispatchEvent(new Event('change', { bubbles: true }));
        ende(); say('Erledigt – ohne ' + name + '. Otto legt los …');
        try { refresh(); } catch (e) { /* egal */ }
        setTimeout(function () { if (!go.disabled) go.click(); }, 300);
        return;
      }
      b.disabled = true; $('ma-msg').textContent = 'Otto beschreibt den Look neu …';
      fetchJson(API + '/marke-ausweg', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: ziel.el.value, wort: wort || '', eigen: (($('ma-eigen') || {}).value || '').trim() }) }, 1).then(function (r) {
        b.disabled = false;
        if (!r.ok || !r.j || !r.j.wunsch) { $('ma-msg').textContent = (r.j && r.j.hinweis) || 'Das hat leider nicht geklappt – sag mir deinen Wunsch bitte noch einmal ohne den Namen.'; return; }
        ziel.el.value = r.j.wunsch; ziel.el.dispatchEvent(new Event('input', { bubbles: true })); ziel.el.dispatchEvent(new Event('change', { bubbles: true }));
        ende();
        say('Neuer Wunsch steht in „Was soll drauf?“' + (r.j.text ? ' – Text auf dem Design: „' + r.j.text + '“' : '') + '. Otto legt los …');
        try { refresh(); } catch (e) { /* egal */ }
        setTimeout(function () { if (!go.disabled) go.click(); }, 300);
      });
    };
    $('ma-los').addEventListener('click', ja);
    $('ma-nein').addEventListener('click', nein);
    window.MoMarkeFrage = { ja: ja, nein: nein };
    try { if (window.MoGespraech && window.MoGespraech.sag) window.MoGespraech.sag('marke'); } catch (e) { /* ohne Stimme */ }
  }

  function fetchJson(url, opts, tries) {
    var n = tries == null ? 2 : tries;
    return fetch(url, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, status: r.status, j: j }; });
    }).catch(function (e) {
      if (n > 0) return new Promise(function (res) { setTimeout(res, 900); }).then(function () { return fetchJson(url, opts, n - 1); });
      throw e;
    });
  }

  all = [window.MOTTO];
  sel.innerHTML = '<option value="' + esc(window.MOTTO.slug) + '">' + esc(window.MOTTO.name) + '</option>';
  sel.value = window.MOTTO.slug;
  pick();

  sel.addEventListener('change', pick);

  // ---- Nach dem Anmelden automatisch weitermachen ----
  // Die Anfrage wird VOR dem Anmelden abgewiesen ("bitte anmelden"). Der Anmelde-Link laedt die
  // Seite neu - Felder leer, kein Design, und niemand stellt den Auftrag noch einmal. Genau so
  // ist es einem Kunden beim Geburtstag passiert: "eingeloggt, aber kein Design da".
  // Darum: Eingaben vor dem Anmelden merken, nach dem Laden pruefen, ob wir angemeldet sind,
  // dann Felder fuellen und den Auftrag von selbst starten.
  var WEITER_KEY = 'mo_weiter', WEITER_MAX_MS = 45 * 60 * 1000;
  function weiterMerken() {
    try { localStorage.setItem(WEITER_KEY, JSON.stringify(weiterDaten())); } catch (e) { /* ohne Speicher eben ohne Automatik */ }
  }
  function weiterDaten() {
    return ({
        slug: current.slug, at: Date.now(), values: values(), aufteilung: aufteilungOf(),
        uploadId: uploadId, uploadId2: uploadId2, textile: textile, style: style, mood: mood, placement: placement, nameFont: nameFont, nameArt: nameArt, logoArt: logoArt, figuren: figuren,
        colors: ($('v_colors') ? $('v_colors').value.trim() : ''),
        // Fassung 73 (Markus, 17. Sept.: "er hat mich gebeten mich anzumelden und dass ich dann
        // direkt wieder dahin zurueckkomme ohne irgendwas neu einzugeben - hat nicht geklappt"):
        // Bei Freestyle stehen Artikel, Flaeche und Mass NICHT in values() - sie gehen als eigene
        // Felder an den Server. Ohne sie startete der automatische Zweitversuch mit "artikel fehlt".
        artikelId: ($('v_artikel') ? $('v_artikel').value : '') || (current && current.artikelLink) || '',
        flaeche: ($('v_flaeche') ? $('v_flaeche').value : ''),
        breiteCm: ($('v_breite') ? $('v_breite').value : ''),
        hoeheCm: ($('v_hoehe') ? $('v_hoehe').value : ''),
        // Das Foto liegt eine Stunde im Arbeitsspeicher des Servers - die Sitzung ueberlebt den Login.
        fotoSitzung: fotoSitzung || ''
      });
  }
  // 4. Okt., Markus: "mit dem Link dann auch wieder sofort auf die gleiche Stelle zurueckkommen und da
  // weitermachen, sonst brechen ganz viele Leute ab". Der Anmelde-Link traegt ?weiter=<nummer>: der
  // Zwischenstand liegt beim Server und kommt auch in einem anderen Browser an (die Mail-App oeffnet den
  // Link oft woanders, als der Kunde angefangen hat). Ohne Nummer gilt der Speicher dieses Browsers wie bisher.
  function weiterNachLogin() {
    // 5. Okt.: der Wunsch von der Startseite (getippt oder gesprochen) - Otto hat das Motto schon ausgefuellt.
    var wn = (location.search.match(/[?&]wunsch=([a-f0-9]{24})/) || [])[1];
    if (wn) {
      fetchJson(API + '/wunsch/' + wn, { cache: 'no-store' }, 1).then(function (r) {
        if (r.ok && r.j && r.j.slug) {
          weiterAnwenden(r.j, true, { wunsch: true });
          // 6. Okt.: der Wunsch nannte einen geschuetzten Namen - Otto hat ihn schon frei nachempfunden. Offen sagen.
          if (r.j.markeHinweis) setTimeout(function () { say('„' + r.j.markeHinweis.wort + '“ ist geschützt – Otto macht den Look frei nach, ohne Namen, Logo und Figuren' + (r.j.markeHinweis.text ? '. Text auf dem Design: „' + r.j.markeHinweis.text + '“' : '') + '. Ändern kannst du alles in „Was soll drauf?“.'); }, 400);
        }
      }).catch(function () { /* dann eben von Hand */ });
      return;
    }
    var nr = (location.search.match(/[?&]weiter=([a-f0-9]{24})/) || [])[1];
    if (nr) {
      try { history.replaceState(history.state, '', location.pathname + location.search.replace(/([?&])weiter=[a-f0-9]{24}&?/, '$1').replace(/[?&]$/, '') + location.hash); } catch (e) { /* alte Adresse bleibt stehen */ }
      fetchJson(API + '/weiter/' + nr, { credentials: 'same-origin' }, 1).then(function (r) {
        if (r.ok && r.j && r.j.slug) weiterAnwenden(r.j, true); else weiterAusSpeicher();
      }).catch(weiterAusSpeicher);
      return;
    }
    weiterAusSpeicher();
  }
  function weiterAusSpeicher() {
    var m = null;
    try { m = JSON.parse(localStorage.getItem(WEITER_KEY) || 'null'); } catch (e) { m = null; }
    if (!m || (Date.now() - m.at) > WEITER_MAX_MS) return;
    weiterAnwenden(m, false);
  }
  function weiterAnwenden(m, vomServer, opt) {
    if (!m || !current || m.slug !== current.slug) return;
    var wunsch = !!(opt && opt.wunsch);
    (wunsch ? Promise.resolve({ ok: true, j: { user: true } }) : fetchJson(API + '/me', undefined, 1)).then(function (r) {
      if (!r.ok || !r.j || !r.j.user) return;          // noch nicht angemeldet - Eintrag bleibt liegen
      if (!wunsch) try { localStorage.removeItem(WEITER_KEY); } catch (e) { /* egal */ }
      // Felder wiederherstellen. Checkboxen haben keinen .value, den man setzen koennte -
      // "Ich darf dieses Foto verwenden" blieb deshalb leer und der Auftrag scheiterte erneut.
      Object.keys(m.values || {}).forEach(function (k) {
        var el = $('v_' + k); if (!el) return;
        if (el.type === 'checkbox') el.checked = !!m.values[k];
        else el.value = m.values[k] || '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      });
      // Namensliste: die Textbox ist die Quelle, die Kaderliste baut sich daraus auf
      var pf = current.fields.filter(function (f) { return f.personal; })[0];
      if (pf && $('v_' + pf.key) && typeof nlAufbauen === 'function') { try { nlAufbauen(pf.key); } catch (e) { /* egal */ } }
      var auf = $('v_aufteilung'); if (auf && m.aufteilung) { auf.value = m.aufteilung; aufMarkieren(); }
      if ($('v_colors')) $('v_colors').value = m.colors || '';
      textile = m.textile || textile; if (m.textile) textilSelbstGewaehlt = true;   // was vor dem Anmelden gewaehlt war, bleibt gewaehlt
      style = m.style || style; mood = m.mood || mood; placement = m.placement || placement; nameFont = m.nameFont || nameFont;
      if (wunsch) {
        // Kacheln sichtbar markieren (sonst stuende in der Zusammenfassung die Vorgabe)
        if (m.textile && typeof textilSetzen === 'function') { try { textilSetzen(m.textile); textilSelbstGewaehlt = true; } catch (e) { /* egal */ } }
        Array.prototype.forEach.call(document.querySelectorAll('#styles button[data-s]'), function (b) { b.classList.toggle('on', b.getAttribute('data-s') === style); });
      }
      if (m.uploadId) {
        uploadId = m.uploadId;
        $('thumb-img').src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
        $('thumb-name').textContent = 'Dein Bild von eben';
        thumb.classList.remove('hide'); drop.classList.add('hide');
      }
      if (m.uploadId2) uploadId2 = m.uploadId2;
      if (m.fotoSitzung) fotoSitzung = m.fotoSitzung;
      // Freestyle: Artikel setzen, Flaechenliste aufbauen lassen, dann Flaeche und Mass.
      // Der Artikelkatalog kommt per fetch - also warten, bis die Liste wirklich da ist.
      // Nicht wieder bei Frage 1 anfangen (nachgestellt am 4. Okt.: alles war ausgefuellt, die Seite stand
      // trotzdem auf "Habt ihr ein Foto von euch?") - sondern dort, wo der Kunde war: am Ende, und los.
      var fsFertig = function () {
        refresh();
        zumWartescreen();
        if (wunsch) {
          // 19. Okt. abends: der Wunsch von der Startseite landet auf "Alles klar?" - der freiwillige Foto-Schritt (Freestyle:
          // "Hast du ein Foto oder eine Datei dazu?") stand dort nur als Zeile "ohne Foto". Jetzt ein eigener Knopf dorthin.
          var ff = ((current && current.fields) || []).filter(function (f) { return f.type === 'upload' && f.ohneGeht && !f.versteckt; })[0];
          var fIdx = -1;
          if (ff && !fotoSitzung && abfolge && abfolge.schritte) for (var si = 0; si < abfolge.schritte.length; si++) if ((abfolge.schritte[si].felder || []).indexOf(ff.key) >= 0) { fIdx = si; break; }
          if (fIdx >= 0 && !$('wunsch-foto')) {
            var wf = document.createElement('button'); wf.type = 'button'; wf.id = 'wunsch-foto'; wf.className = 'mo-knopf hell';
            wf.style.margin = '10px 0'; wf.innerHTML = SYM_KAMERA + ' <span>' + esc(ff.knopf || 'Foto wählen') + '</span>';
            wf.addEventListener('click', function () { abfolge.zeige(fIdx); wf.remove(); });
            var los = document.querySelector('.ab-schritt.on .ab-inhalt'); if (los) los.insertBefore(wf, los.firstChild); else go.parentNode.insertBefore(wf, go);
            say('Otto hat deinen Wunsch eingetragen. Hast du ein Foto oder eine Datei dazu? Dann tipp auf den Knopf – sonst gleich „Otto starten“.');
            return;
          }
          say('Otto hat deinen Wunsch eingetragen. Kurz drüberschauen – zum Ändern auf die Zeile tippen –, dann „Otto starten“.'); return;
        }
        say('Angemeldet – deine Eingaben sind wieder da, dein Design wird jetzt erzeugt.');
        setTimeout(function () { if (!go.disabled) go.click(); }, 400);
      };
      // Druckgroesse (Kachel "Brust klein 8 x 8" usw.) gilt fuer jedes Motto, nicht nur fuer Freestyle -
      // nachgestellt am 4. Okt.: nach dem Anmelden fehlte sie, das Design waere in Standardgroesse entstanden.
      if (!m.artikelId) ['breite', 'hoehe'].forEach(function (k) {
        var el = $('v_' + k), w = m[k + 'Cm']; if (!el || !w) return;
        el.value = w; el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      if (m.artikelId && $('v_artikel')) {
        var versuche = 0;
        var setzen = function () {
          var sel = $('v_artikel');
          if (!sel || !sel.querySelector('option[value="' + m.artikelId + '"]')) {
            if (++versuche > 40) { fsFertig(); return; }     // nach 8 Sekunden ohne Katalog: ohne Automatik
            setTimeout(setzen, 200); return;
          }
          sel.value = m.artikelId;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
          if (m.flaeche && $('v_flaeche') && $('v_flaeche').querySelector('option[value="' + m.flaeche + '"]')) {
            $('v_flaeche').value = m.flaeche;
            $('v_flaeche').dispatchEvent(new Event('change', { bubbles: true }));
          }
          if (m.breiteCm && $('v_breite')) $('v_breite').value = m.breiteCm;
          if (m.hoeheCm && $('v_hoehe')) { $('v_hoehe').value = m.hoeheCm; $('v_hoehe').dispatchEvent(new Event('input')); }
          fsFertig();
        };
        setzen();
        return;
      }
      fsFertig();
    }).catch(function () { /* dann eben von Hand */ });
  }
  setTimeout(weiterNachLogin, 150);

  // ---- Geburtstag: Vorschläge unter 18 ohne Alkohol ----
  // Das Alter steht im Feld "alter" oder ergibt sich aus dem Jahrgang. Sobald es unter 18 liegt,
  // verschwinden Sprüche wie "betreutes Trinken" aus den Klick-Vorschlägen. Die Motive selbst
  // regelt der Server (geburtstag.js), das hier ist nur die Oberfläche.
  var U18_TABU = /trink|prost|\bbier|\bwein\b|\bsekt|schnaps|\bbar\b|kater/i;
  function alterAusFeldern() {
    var a = ($('v_alter') ? $('v_alter').value : '').match(/\d{1,3}/);
    if (a && +a[0] > 0 && +a[0] < 130) return +a[0];
    var j = ($('v_jahrgang') ? $('v_jahrgang').value : '').match(/(19|20)\d{2}/);
    if (j) { var al = new Date().getFullYear() - +j[0]; if (al >= 0 && al < 130) return al; }
    return null;
  }
  function vorschlaegeNachAlter() {
    if (!current || current.slug !== 'geburtstag') return;
    var alter = alterAusFeldern(), u18 = alter != null && alter < 18;
    Array.prototype.forEach.call(document.querySelectorAll('#f-suggest button.s'), function (b) {
      b.style.display = (u18 && U18_TABU.test(b.getAttribute('data-motto') || '')) ? 'none' : '';
    });
  }
  app.addEventListener('input', function (ev) {   // app statt fieldsBox: die Abfolge verschiebt die Felder (20. Sept.)
    if (ev.target && (ev.target.id === 'v_alter' || ev.target.id === 'v_jahrgang')) vorschlaegeNachAlter();
  });

  function pick() {
    current = all.filter(function (m) { return m.slug === sel.value; })[0] || null;
    uploadId = null; uploadId2 = null;
    thumb.classList.add('hide'); $('thumb2').classList.add('hide'); $('drop2').classList.remove('hide');
    fieldsBox.innerHTML = '';
    intro.classList.add('hide');
    result.classList.add('hide');
    say('');
    setTimeout(logoVorschlagen, 0);   // nach dem Aufbau der Felder, sonst ist f-upload noch versteckt
    setTimeout(firmenFelderVorbelegen, 0);

    if (!current) { fUpload.classList.add('hide'); $('f-upload2').classList.add('hide'); refresh(); return; }

    intro.classList.add('hide');

    fieldsBox.innerHTML = current.fields.map(function (f) {
      var id = 'v_' + f.key;
      // 19. Sept., "Gruesse aus": versteckte Felder fuellt die Seite selbst (Standort, Foto-Weg).
      // Sie stehen im Formular, damit values() und der Server sie wie jedes Feld behandeln.
      if (f.versteckt) {
        return '<div class="field hide" id="f_' + f.key + '" aria-hidden="true">' + (f.type === 'select'
          ? '<select id="' + id + '" tabindex="-1">' + f.options.map(function (o) { return '<option value="' + esc(o) + '"' + (f.default === o ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>'
          : '<input type="hidden" id="' + id + '">') + '</div>';
      }
      if (f.personal) {
        // Druck-Aufteilung (Fassung 9): Name im Motiv / vorne Motiv + hinten Kaderliste / hinten groß + Brust-Print
        // Fassung 36: das Wort fuer die Liste kommt vom Motto (Kaderliste, Mitarbeiterliste, Stufenliste ...)
        var lw = current.listeWort || 'Namensliste';
        // 4. Okt., Markus: "einmal vorne klein mit Namen und hinten gross - das ist ueberhaupt nicht erklaert
        // und auch nicht anzutippen." Die Liste bleibt (versteckt) als Wert; sichtbar sind drei Kacheln
        // mit je einer kleinen Zeichnung Vorder- und Rueckseite. Die Abfolge macht daraus eine eigene Seite.
        var AUF = [
          ['vorne', 'Name vorne im Motiv', 'Jeder bekommt sein eigenes Design mit seinem Namen darin.', 'vorne'],
          ['vorne-kader', 'Vorne das Motiv, hinten alle Namen', 'Vorne groß das Design, hinten die ganze ' + lw + '.', 'kader'],
          ['brust-kader', 'Vorne klein mit Namen, hinten groß', 'Vorne ein kleiner Brust-Print mit dem eigenen Namen, hinten das große Motiv mit allen Namen' + (current.slug === 'abi' ? ' – der Abi-Klassiker' : '') + '.', 'brust']
        ];
        var auf = current.kader ? '<div class="field" id="f_aufteilung" style="margin-top:12px"><label for="v_aufteilung" class="hide">Wo sollen die Namen hin?</label><select id="v_aufteilung" class="hide" aria-hidden="true" tabindex="-1">' +
          AUF.map(function (a) { return '<option value="' + a[0] + '">' + esc(a[1]) + '</option>'; }).join('') + '</select>' +
          '<div class="styles schmal auf-wahl" id="aufteilung-wahl">' + AUF.map(function (a, i) {
            return '<button type="button" data-au="' + a[0] + '"' + (i === 0 ? ' class="on"' : '') + '>' + aufBild(a[3]) + '<b>' + esc(a[1]) + '</b><small>' + esc(a[2]) + '</small></button>';
          }).join('') + '</div>' +
          '<div class="hint">Die ' + esc(lw) + ' wird aus eurer Liste gesetzt – Größen stehen nie auf dem Shirt, sie ergeben eure Bestellliste.</div></div>' : '';
        return '<div class="field" id="f_' + f.key + '"><label>' + esc(f.label) + ' – eine Person je Zeile' + (f.required ? '' : ' – optional') + '</label>' +
          '<div class="nl" id="nl_' + f.key + '"></div>' +
          '<textarea id="' + id + '" class="hide" aria-hidden="true" tabindex="-1"></textarea>' +
          '<div class="names-tools"><button type="button" id="names-tpl-btn">📥 Leere Vorlage (Excel)</button><button type="button" id="names-file-btn">Ausgefüllte Liste hochladen</button><input type="file" id="names-file" accept=".xlsx,.xls,.csv,.txt" style="display:none"><span id="names-info">Ihr könnt die Liste <b>direkt hier ausfüllen</b> – Namen auch als ganze Spalte aus Excel oder WhatsApp einfügen. Für große Gruppen gibt es die Excel-Vorlage zum Herumschicken. Die Größen kommen nie aufs Shirt, sie ergeben eure Bestellliste. Ein Design, viele Namen – das Motiv bleibt gleich, bis zu 100 Personen. Mit E-Mail oder Handy bestätigst du, dass die Personen mit dem Versand einverstanden sind.</span></div>' +
          (f.hint ? '<div class="hint">' + esc(f.hint) + '</div>' : '') + auf + '</div>';
      }
      if (f.type === 'list') {
        return '<div class="field" id="f_' + f.key + '"><label>' + esc(f.label) + ' – eine Person je Zeile' + (f.required ? '' : ' – optional') + '</label>' +
          '<div class="nl" id="nl_' + f.key + '"></div>' +
          '<textarea id="' + id + '" class="hide" aria-hidden="true" tabindex="-1"></textarea>' +
          '<div class="names-tools"><button type="button" id="names-tpl-btn">📥 Leere Vorlage (Excel)</button><button type="button" id="names-file-btn">Ausgefüllte Liste hochladen</button><input type="file" id="names-file" accept=".xlsx,.xls,.csv,.txt" style="display:none"><span id="names-info">Ihr könnt die Liste <b>direkt hier ausfüllen</b> – Namen auch als ganze Spalte aus Excel oder WhatsApp einfügen. Für große Gruppen gibt es die Excel-Vorlage zum Herumschicken. Alle Namen kommen zusammen auf die <b>Rückseite</b> – das Front-Motiv bleibt gleich, bis zu 100 Personen. Mit E-Mail oder Handy bestätigst du das Einverständnis der Personen.</span></div>' +
          (f.hint ? '<div class="hint">' + esc(f.hint) + '</div>' : '') + '</div>';
      }
      // Fassung 24/25: textarea (Freitext-Motiv), checkbox (Rechte-Haken), upload (Kundenfoto, nur RAM)
      if (f.type === 'checkbox') {
        return '<div class="field" id="f_' + f.key + '"><label for="' + id + '" style="display:flex;gap:10px;align-items:flex-start;cursor:pointer"><input type="checkbox" id="' + id + '" style="width:auto;margin:3px 0 0"> <span>' + esc(f.label) + (f.required ? '' : ' – optional') + '</span></label>' + (f.hint ? '<div class="hint">' + esc(f.hint) + '</div>' : '') + '</div>';
      }
      if (f.type === 'upload' && f.ohneGeht) {
        // 2. Okt., Gruppen-Mottos: das Foto ist freiwillig und der ganze Schritt - also ein grosser
        // Knopf statt des nackten Datei-Felds ("Choose File" auf Englisch, gemessen im iPhone-Browser).
        return '<div class="field" id="f_' + f.key + '"><label class="foto-frage" for="' + id + '">' + esc(f.label) + '</label>' +
          '<input type="file" id="' + id + '" accept="image/*,.heic,.heif,.svg" class="pk-versteckt">' +
          '<label class="mo-knopf hell foto-waehlen" for="' + id + '">' + SYM_KAMERA + ' <span id="foto-waehlen-text">' + esc(f.knopf || 'Foto wählen') + '</span></label>' +
          '<div class="hint" id="foto-status" aria-live="polite"></div>' + (f.hint ? '<div class="hint">' + esc(f.hint) + '</div>' : '') + '<div class="hint" id="foto-zusage"></div></div>';
      }
      if (f.type === 'upload') {
        return '<div class="field" id="f_' + f.key + '"><label for="' + id + '">' + esc(f.label) + (f.required ? '' : ' – optional') + '</label>' +
          '<input type="file" id="' + id + '" accept="image/*,.heic,.heif,.svg">' +
          '<div class="hint" id="foto-status"></div>' + (f.hint ? '<div class="hint">' + esc(f.hint) + '</div>' : '') + '<div class="hint" id="foto-zusage"></div></div>';
      }
      // 20. Sept., Kachelwahl ('wahl'): grosse Kacheln mit Beispielbild,
      // der Wert steht in einem versteckten Feld - values() und der Server sehen ein normales Feld.
      if (f.type === 'wahl') {
        var vorgabe = (f.default && f.options.some(function (o) { return o.key === f.default; })) ? f.default : '';
        // Ohne Beispielbilder wird die Reihe schmal, und die FORM zeigt ein Kaestchen im echten
        // Seitenverhaeltnis (o.seiten, aus der Motto-Datei). Ein Beispielbild bleibt weiter
        // moeglich; hat eine Kachel eines, gilt die grosse Darstellung wie bisher.
        var ohneBild = !f.options.some(function (o) { return o.bild; });
        return '<div class="field" id="f_' + f.key + '"><label>' + esc(f.label) + (f.required ? '' : ' – optional') + '</label>' +
          '<div class="styles wahl' + (ohneBild ? ' form' : '') + '" id="w_' + f.key + '">' + f.options.map(function (o) {
            var pic = o.bild ? '<span class="wahl-bild"><img src="' + esc(o.bild) + '" alt="" loading="lazy" onerror="this.parentNode.remove()"></span>' : '';
            var form = (!pic && /^[0-9]+\/[0-9]+$/.test(String(o.seiten || ''))) ? '<span class="wahl-form" style="aspect-ratio:' + esc(o.seiten) + '"></span>' : '';
            return '<button type="button" data-w="' + esc(o.key) + '" class="' + (pic ? 'pic' : '') + (o.key === vorgabe ? ' on' : '') + '">' + pic + form + '<b>' + esc(o.label) + '</b><small>' + esc(o.desc) + '</small></button>';
          }).join('') + '</div>' +
          '<input type="hidden" id="' + id + '" value="' + esc(vorgabe) + '">' + (f.hint ? '<div class="hint">' + esc(f.hint) + '</div>' : '') + '</div>';
      }
      var input = f.type === 'select'
        ? '<select id="' + id + '"><option value="">bitte wählen</option>' + f.options.map(function (o) { return '<option value="' + esc(o) + '"' + (f.default === o ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>'
        : f.type === 'textarea'
          ? '<textarea id="' + id + '" maxlength="' + f.max + '" rows="4" placeholder="' + esc(f.placeholder) + '" style="width:100%;box-sizing:border-box"></textarea>'
            // 5. Okt. abends, Markus (Freestyle "Was soll drauf?"): "hatten wir noch einen Aufnahmeknopf hingelegt, damit die
            // Leute das einsprechen koennen" - wie beim Wunsch auf der Startseite. Nur, wo der Browser es kann.
            + ((window.SpeechRecognition || window.webkitSpeechRecognition) ? '<div class="names-tools" style="margin-top:8px"><button type="button" class="feld-mic" data-ziel="' + id + '">🎤 Einsprechen</button><span class="feld-mic-msg" aria-live="polite"></span></div>' : '')
          // Fassung 74: Ein langer Spruch gehoert in ein Feld, in dem man ihn ganz sieht. In einer
          // einzeiligen Zeile scrollt der Anfang aus dem Bild, sobald man ueber die Breite kommt -
          // genau das hat Markus am 17. Sept. auf dem Handy erwischt. Ab 70 Zeichen also zwei
          // Zeilen und ein Zaehler, damit niemand mitten im Satz gegen die Grenze laeuft.
          : f.max > 70
            ? '<textarea id="' + id + '" maxlength="' + f.max + '" rows="2" placeholder="' + esc(f.placeholder) + '" style="width:100%;box-sizing:border-box"></textarea><div class="hint" id="zaehl_' + f.key + '"></div>'
            : '<input type="text" id="' + id + '" maxlength="' + f.max + '" placeholder="' + esc(f.placeholder) + '">';
      return '<div class="field" id="f_' + f.key + '"><label for="' + id + '">' + esc(f.label) + (f.required ? '' : ' – optional') + '</label>' + input + (f.hint ? '<div class="hint">' + esc(f.hint) + '</div>' : '') + '</div>';
    }).join('');

    fieldsBox.dataset.touched = '0';
    current.fields.forEach(function (f) {
      var el = $('v_' + f.key);
      var zaehler = $('zaehl_' + f.key);
      var zaehlen = function () {
        if (!zaehler) return;
        var n = (el.value || '').length;
        zaehler.textContent = n + ' von ' + f.max + ' Zeichen' + (n > f.max - 15 ? ' – gleich ist Schluss' : '');
      };
      zaehlen();
      el.addEventListener('input', function () { fieldsBox.dataset.touched = '1'; zaehlen(); refresh(); });
      el.addEventListener('change', function () { fieldsBox.dataset.touched = '1'; zaehlen(); refresh(); });
    });
    // Kachelwahl: Tipp auf eine Kachel setzt das versteckte Feld und meldet es wie eine Eingabe.
    [].forEach.call(fieldsBox.querySelectorAll('.styles.wahl'), function (box) {
      box.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-w]'); if (!b) return;
        [].forEach.call(box.querySelectorAll('button[data-w]'), function (x) { x.classList.toggle('on', x === b); });
        var inp = $('v_' + box.id.slice(2));
        if (inp) { inp.value = b.getAttribute('data-w'); inp.dispatchEvent(new Event('change', { bubbles: true })); }
      });
    });
    // Fassung 24: Otto Freestyle - Artikel und Fläche direkt nach "Was soll drauf?". Der Artikel
    // bestimmt Verfahren, Druckfläche und ob das Motiv randlos läuft; das entscheidet der Kunde nicht.
    fotoSitzung = null;
    // Freie Groesse in Zentimetern - bei jedem Motto (Fassung 32: "ueberall mit angeben, in welcher
    // Groesse die Leute sich das wuenschen"). Bei Freestyle nur fuer Textil, sonst immer, optional.
    // 2. Okt., Markus: "Wir sollten auf jeden Fall noch ein Feld dazu packen mit freier Groessenauswahl,
    // ganz wichtig" - die Groesse stand ganz unten in "Feinheiten" und wurde nicht gefunden. Jetzt ein
    // eigener Schritt (abfolge.js) mit Kacheln; "Eigene Groesse" oeffnet Breite x Hoehe. Der Kasten
    // heisst f-druckmass: f_groesse ist beim Babyshirt das Feld "Groesse" (Laenge des Babys), und mit
    // zwei gleichen Kennungen fand die Seite immer das Babyfeld.
    var GROESSEN = [['8', '8', 'Brust klein', '8 × 8 cm'], ['10', '10', 'Brust', '10 × 10 cm'], ['25', '10', 'Streifen', '25 × 10 cm'], ['28', '20', 'Brust groß', '28 × 20 cm'], ['30', '35', 'Rücken', '30 × 35 cm']];
    // Im eigenen Schritt steht die Frage schon als Titel - die Ueberschrift im Kasten nur bei Freestyle.
    var groesseHtml = '<div class="field hide" id="f-druckmass">' + (current.freestyle ? '<label>Wie groß soll das Design werden?</label>' : '') +
      '<div class="sugg groessen" id="groesse-vorschlaege">' +
      // 5. Okt. abends: die Kachel "Ruecken" traegt die Seite mit (druckSeite) - sonst kam das Motiv in der Vorschau vorn.
      GROESSEN.map(function (v) { return '<button type="button" class="s" data-b="' + v[0] + '" data-h="' + v[1] + '"' + (v[2] === 'Rücken' ? ' data-seite="ruecken"' : '') + '><b>' + v[2] + '</b><span>' + v[3] + '</span></button>'; }).join('') +
      '<button type="button" class="s" data-eigen="1"><b>Eigene Größe</b><span>Breite × Höhe</span></button>' +
      (current.freestyle ? '' : '<button type="button" class="s" data-standard="1"><b>Standard</b><span>Otto entscheidet</span></button>') +
      '</div><div class="eigenmass" id="eigenmass" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:10px"><input type="number" inputmode="decimal" id="v_breite" min="3" max="38" step="0.5" placeholder="Breite" aria-label="Breite in cm" style="width:110px"> <span>×</span> <input type="number" inputmode="decimal" id="v_hoehe" min="3" max="48" step="0.5" placeholder="Höhe" aria-label="Höhe in cm" style="width:110px"> <span>cm</span></div>' +
      '<div class="hint" id="groesse-hint">' + (current.freestyle ? 'Breite 3 bis 38 cm, Höhe 3 bis 48 cm. Das Design wird genau auf dieses Maß gebaut.' : 'Standard heißt: Otto nimmt die übliche Größe. Mit Maß (Breite bis 38, Höhe bis 48 cm) wird das Design genau darauf gebaut, die Druckdatei hat dann dieses Maß.') + '</div></div>';
    // Welche Kachel ist gewaehlt? Aus den Zahlen abgelesen, damit Tippen und Antippen dasselbe zeigen.
    var groesseMarkieren = function () {
      var bb = $('v_breite'), hh = $('v_hoehe'); if (!bb || !hh) return;
      var b = bb.value.trim(), h = hh.value.trim(), vor = false;
      var e = document.querySelector('#groesse-vorschlaege .s[data-eigen]'), st = document.querySelector('#groesse-vorschlaege .s[data-standard]');
      var eigenOffen = !!(e && e.dataset.offen === '1');
      [].forEach.call(document.querySelectorAll('#groesse-vorschlaege .s[data-b]'), function (k) { var on = !eigenOffen && k.getAttribute('data-b') === b && k.getAttribute('data-h') === h; k.classList.toggle('on', on); if (on) vor = true; });
      if (e) e.classList.toggle('on', eigenOffen || (!vor && !!(b || h)));
      if (st) st.classList.toggle('on', !b && !h && !eigenOffen);
      // Breite x Hoehe erst mit "Eigene Groesse" (bei Freestyle immer, dort gibt es kein Standard)
      var em = $('eigenmass'); if (em) em.style.display = (current.freestyle || (e && e.classList.contains('on'))) ? 'flex' : 'none';
    };
    var groesseKnoepfe = function () {
      ['v_breite', 'v_hoehe'].forEach(function (k) { $(k).addEventListener('input', function () { fieldsBox.dataset.touched = '1'; groesseMarkieren(); refresh(); }); });
      [].forEach.call(document.querySelectorAll('#groesse-vorschlaege .s'), function (b) {
        b.addEventListener('click', function () {
          var e = document.querySelector('#groesse-vorschlaege .s[data-eigen]');
          if (e) e.dataset.offen = b.hasAttribute('data-eigen') ? '1' : '0';
          if (b.hasAttribute('data-b')) { $('v_breite').value = b.getAttribute('data-b'); $('v_hoehe').value = b.getAttribute('data-h'); }
          else if (b.hasAttribute('data-standard')) { $('v_breite').value = ''; $('v_hoehe').value = ''; }
          else if (b.hasAttribute('data-eigen')) { setTimeout(function () { try { $('v_breite').focus(); } catch (x) { } }, 30); }
          fieldsBox.dataset.touched = '1'; groesseMarkieren(); refresh();
        });
      });
      groesseMarkieren();
    };
    if (!current.freestyle) {
      fieldsBox.insertAdjacentHTML('beforeend', groesseHtml);
      $('f-druckmass').classList.remove('hide');
      groesseKnoepfe();
      // 6. Okt., Markus (Kissen aus der Artikel-Galerie, dann "Fuer welches Textil?" und "Brust klein"):
      // "Was sollen denn diese schwachsinnigen Fragen?" Kommt die Seite mit ?artikel=<kein Textil>,
      // gibt es weder Textil- noch Groessenfrage - der Server zeichnet auf die Flaeche des Artikels.
      current.artikelLink = '';
      var linkA = ''; try { linkA = (new URLSearchParams(location.search).get('artikel') || '').replace(/[^a-z0-9_-]/g, ''); } catch (e) { linkA = ''; }
      if (linkA) fetchJson(API + '/freestyle/artikel', undefined, 1).then(function (r) {
        if (!r.ok || !r.j || !r.j.gruppen) return;
        var gef = null, textilArt = (r.j.gruppen.Textil || []).some(function (t) { return t.id === linkA; });
        Object.keys(r.j.gruppen).forEach(function (g) { r.j.gruppen[g].forEach(function (a) { if (a.id === linkA) gef = a; }); });
        if (!gef || textilArt) return;
        current.artikelLink = linkA;
        ['f-textile', 'f-druckmass', 'f-placement'].forEach(function (id) { var el = $(id); if (el) el.classList.add('hide'); });
        $('v_breite').value = ''; $('v_hoehe').value = '';
        try { textilSetzen('weiss'); textilSelbstGewaehlt = true; } catch (e) { }
        // 6. Okt., Markus: "dass der Kunde bei jeder Bestellung, egal ob Kissen oder Strandhandtuch, sobald er
        // das antippt, die Moeglichkeit hat, einfach nur einzusprechen" - oder unseren normalen Ablauf zu gehen.
        var kopf = document.querySelector('#app > header');
        if (kopf && !$('art-einsprechen')) kopf.insertAdjacentHTML('beforeend',
          '<div id="art-einsprechen" style="margin:14px 0;padding:14px 16px;border:2px solid currentColor;border-radius:14px;display:grid;gap:10px">' +
          '<b>' + esc(gef.name) + ' · ' + esc(gef.verfahren) + (gef.motivart === 'vollflaechig' ? ' · randlos bedruckt' : '') + '</b>' +
          '<span>Am schnellsten: einfach sagen, was drauf soll – Otto macht den Rest.</span>' +
          '<a class="mo-knopf" id="art-einsprechen-los" href="/m/freestyle?artikel=' + encodeURIComponent(linkA) + '" style="justify-self:start">🎤 Einfach einsprechen</a>' +
          '<small>Oder unten Schritt für Schritt mit diesem Motto – ohne Textil- und Größenfragen.</small></div>');
        try { refresh(); } catch (e) { }
      });
    }
    if (current.freestyle) {
      // Steht der Artikel am Motto fest (artikelFest), gibt es keine Artikelwahl - der Rest des Freestyle-Wegs (Foto im Arbeitsspeicher) bleibt.
      if (!current.artikelFest) {
      var artHtml = '<div class="field" id="f_artikel"><label for="v_artikel">Worauf soll es?</label><select id="v_artikel"><option value="">Artikel wählen …</option></select><div class="hint" id="artikel-hint">Verfahren und Druckfläche kommen vom Artikel.</div></div>' +
        '<div class="field hide" id="f_flaeche"><label for="v_flaeche">Fläche / Variante</label><select id="v_flaeche"></select><div class="hint" id="flaeche-hint"></div></div>' +
        groesseHtml;
      var nachMotiv = $('f_motiv');
      if (nachMotiv) nachMotiv.insertAdjacentHTML('afterend', artHtml); else fieldsBox.insertAdjacentHTML('beforeend', artHtml);
      var fuellen = function () {
        var sel = $('v_artikel'); if (!sel || !fsKatalog) return;
        Object.keys(fsKatalog.gruppen).forEach(function (g) {
          var og = document.createElement('optgroup'); og.label = g;
          fsKatalog.gruppen[g].forEach(function (a) { var o = document.createElement('option'); o.value = a.id; o.textContent = a.name + ' · ' + a.verfahren; og.appendChild(o); });
          sel.appendChild(og);
        });
        if (fsKatalog.texte && $('foto-zusage')) $('foto-zusage').textContent = fsKatalog.texte.beimHochladen;
        // 19. Sept.: von der Startseite gewuenschter Artikel (?artikel=kissen) - vorwaehlen und
        // die Folgefelder (Flaeche, Groesse) genauso aufklappen wie bei einer Auswahl von Hand.
        try {
          var wa = new URLSearchParams(location.search).get('artikel');
          if (wa && sel.querySelector('option[value="' + wa.replace(/[^a-z0-9-]/g, '') + '"]')) {
            sel.value = wa; sel.dispatchEvent(new Event('change'));
            setTimeout(function () { try { $('f_artikel').scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { } }, 250);
          }
        } catch (e) { }
      };
      if (fsKatalog) fuellen();
      else fetchJson(API + '/freestyle/artikel', undefined, 1).then(function (r) { if (r.ok && r.j && r.j.gruppen) { fsKatalog = r.j; fuellen(); } });
      // 1. Okt., Markus: "Das mit den anderen Sachen, wo Textilien steht, muss natuerlich geaendert
      // werden, wenn's keine Textilien sind." Die Frage "Fuer welches Textil?" gibt es nur fuer die
      // Gruppe Textil des Katalogs (T-Shirt, Hoodie, Shopper). Brotdose, Kissen, Poster & Co. werden
      // vollflaechig gedruckt - dort ignoriert der Bildauftrag den Textilton ohnehin (printRules);
      // der Sticker liegt auf weissem Vinyl. Also: Frage weg, Untergrund weiss. Zurueck zu einem
      // Textil, und die Frage ist wieder da, mit der Vorgabe von vorher.
      textilNurBeiTextil = function () {
        var a = artikelVon($('v_artikel').value);
        var keinTextil = !!a && !((fsKatalog.gruppen.Textil || []).some(function (t) { return t.id === a.id; }));
        $('f-textile').classList.toggle('hide', keinTextil || !!current.einfach);
        farbHinweis();
        if (keinTextil && !textilVomArtikel) { textilVomArtikel = { vorher: textile, selbst: textilSelbstGewaehlt }; textilSetzen('weiss'); textilSelbstGewaehlt = true; }
        if (!keinTextil && textilVomArtikel) { textilSetzen(textilVomArtikel.vorher); textilSelbstGewaehlt = textilVomArtikel.selbst; textilVomArtikel = null; }
      };
      var artikelVon = function (id) { var t = null; if (!fsKatalog) return null; Object.keys(fsKatalog.gruppen).forEach(function (g) { fsKatalog.gruppen[g].forEach(function (a) { if (a.id === id) t = a; }); }); return t; };
      $('v_artikel').addEventListener('change', function () {
        var a = artikelVon($('v_artikel').value);
        var fs = $('v_flaeche'); fs.innerHTML = '';
        if (!a) { $('f_flaeche').classList.add('hide'); $('f-druckmass').classList.add('hide'); $('artikel-hint').textContent = 'Verfahren und Druckfläche kommen vom Artikel.'; fieldsBox.dataset.touched = '1'; refresh(); return; }
        a.flaechen.forEach(function (f) { var o = document.createElement('option'); o.value = f.key; o.textContent = f.label + (f.label.indexOf('cm') < 0 ? ' · ' + f.masse : ''); fs.appendChild(o); });
        // Textil: freie Groesse statt Flaechenliste; sonst die Variante des Artikels
        // Freestyle einfach (5. Okt. abends): keine Groessenfrage - der Server nimmt "Brust gross" bzw. die erste Flaeche.
        $('f-druckmass').classList.toggle('hide', !a.freieGroesse || !!current.einfach);
        textilNurBeiTextil();
        $('f_flaeche').classList.toggle('hide', !!a.freieGroesse || a.flaechen.length < 2 || !!current.einfach);
        $('artikel-hint').textContent = a.beschreibung + ' · ' + a.material + ' · ' + a.verfahren + (a.motivart === 'vollflaechig' ? ' · randlos bedruckt' : ' · freistehendes Motiv') + (a.hinweis ? ' · ' + a.hinweis : '');
        fieldsBox.dataset.touched = '1'; refresh();
      });
      $('v_flaeche').addEventListener('change', refresh);
      groesseKnoepfe();
      }
    }
    // 2. Okt.: das Kundenfoto gibt es auch bei den Gruppen-Mottos (Foto zuerst, current.gruppenFoto) -
    // derselbe Weg wie beim Freestyle, nur Arbeitsspeicher.
    if (current.freestyle || current.gruppenFoto) {
      // Kundenfoto (Fassung 25/26): Originaldatei, nicht die verkleinerte Fassung - der Server
      // hält es nur im Arbeitsspeicher und sagt sofort, ob die Auflösung für die Fläche reicht.
      var fotoEl = $('v_foto');
      if (fotoEl) fotoEl.addEventListener('change', function () {
        var file = (fotoEl.files || [])[0]; if (!file) { fotoSitzung = null; refresh(); return; }
        fotoAnnehmen(file);
      });
      // Ein Foto annehmen - von der Galerie oder direkt von der Kamera ("Jetzt Selfie machen").
      fotoAnnehmen = function (file) {
        // Ein neues Foto: die alte Sitzung zaehlt nicht mehr.
        fotoSitzung = null;
        var maxMb = (fsKatalog && fsKatalog.maxMb) || 25;
        if (file.size > maxMb * 1024 * 1024) { $('foto-status').textContent = 'Das Foto ist größer als ' + maxMb + ' MB. Bitte ein kleineres nehmen.'; fotoSitzung = null; refresh(); return; }
        $('foto-status').textContent = 'Foto wird geprüft …';
        var rd = new FileReader();
        rd.onload = function () {
          fetchJson(API + '/foto', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ dataUrl: rd.result, slug: current.slug || '', artikelId: current.artikelFest || ($('v_artikel') ? $('v_artikel').value : '') || current.artikelLink || '', flaeche: $('v_flaeche') ? $('v_flaeche').value : '', fotoModus: $('v_foto_modus') ? $('v_foto_modus').value : '', breiteCm: $('v_breite') ? $('v_breite').value : '', hoeheCm: $('v_hoehe') ? $('v_hoehe').value : '' }) }, 1)
            .then(function (r) {
              if (!r.ok || !r.j || !r.j.fotoSitzung) {
                fotoSitzung = null;
                $('foto-status').textContent = (r.j && r.j.hinweis) || 'Das Foto konnte nicht gelesen werden. Bitte JPG oder PNG.';
                refresh(); return;
              }
              fotoSitzung = r.j.fotoSitzung;
              if ($('foto-waehlen-text')) $('foto-waehlen-text').textContent = 'Anderes Foto wählen';
              var p = r.j.pruef;
              $('foto-status').textContent = (p ? p.text : current.gruppenFoto ? 'Foto ist da – Otto zeichnet euch ins Design.' : 'Foto angekommen (' + r.j.px[0] + ' × ' + r.j.px[1] + '). Wähle den Artikel, dann prüfen wir die Auflösung.') + ' Bleibt eine Stunde bei uns, dann ist es automatisch weg.';
              refresh();
            })
            .catch(function () { fotoSitzung = null; $('foto-status').textContent = 'Das Hochladen hat nicht geklappt. Bitte noch einmal.'; refresh(); });
        };
        rd.onerror = function () { $('foto-status').textContent = 'Die Datei konnte nicht gelesen werden.'; };
        rd.readAsDataURL(file);
      };
    }
    // Empfehlungen aufgeräumt und in der Reihenfolge Motto -> Bezug -> Empfehlungen:
    // direkt NACH dem Bezug-Feld (bzw. dem Recherche-Feld) einfügen. Klick übernimmt das Motto.
    if (current.suggestions && current.suggestions.length) {
      // Zielfeld: eigens gesetztes Feld, sonst das Recherche-Feld, sonst "spruch".
      var rf = current.suggestField || current.researchField || 'spruch';
      var anchor = (current.research && $('f_bezug')) || $('f_' + rf) || $('f_bezug');
      if (anchor) {
        var suggIntro = current.research
          ? 'Ihr habt selbst noch keine Idee? Ein paar Vorschläge – zum Übernehmen antippen:'
          : 'Beliebte Sprüche – zum Übernehmen antippen:';
        var html = '<div class="field" id="f-suggest"><div class="sugg-intro">' + esc(suggIntro) + '</div><div class="sugg">' +
          current.suggestions.map(function (sug) {
            var parts = String(sug).split(/\s+[–-]\s+/);
            var mo = parts[0].trim(); var rest = parts.slice(1).join(' – ').trim();
            return '<button type="button" class="s" data-motto="' + esc(mo) + '"><b>' + esc(mo) + '</b>' + (rest ? '<span>' + esc(rest) + '</span>' : '') + '</button>';
          }).join('') + '</div></div>';
        anchor.insertAdjacentHTML('afterend', html);
        [].forEach.call(document.querySelectorAll('#f-suggest .s'), function (b) {
          b.addEventListener('click', function () { var el = $('v_' + rf); if (el) { el.value = b.getAttribute('data-motto'); el.dispatchEvent(new Event('input', { bubbles: true })); el.focus(); } });
        });
      }
    }
    var pf = current.fields.filter(function (f) { return f.personal || f.type === 'list'; })[0];
    if (pf) {
      nlAufbauen(pf.key, false);
      nlBinden(pf.key);
      if ($('names-tpl-btn')) $('names-tpl-btn').addEventListener('click', downloadTemplate);
      listenFeld = pf.key;
      listenAnbieten();
      // Vorwarnen: der Excel-Leser faengt schon an zu laden, waehrend der Dateidialog offen ist.
      $('names-file-btn').addEventListener('click', function () { xlsxHolen(); $('names-file').click(); });
      $('names-file').addEventListener('change', function () {
        var file = $('names-file').files[0]; if (!file) return;
        readNames(file, function (list, err) {
          if (err) { $('names-info').textContent = err; return; }
          var ta = $('v_' + pf.key);
          var have = ta.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
          ta.value = have.concat(list).slice(0, 100).join('\n');
          // Kontaktspalten aufklappen, wenn in der Datei welche stehen - sonst wären sie unsichtbar
          var kontakt = $('nl_' + pf.key).dataset.kontakt === '1'
            || list.some(function (l) { return /@/.test(l); });
          nlAufbauen(pf.key, kontakt);
          $('names-info').textContent = list.length + ' Namen aus „' + file.name + '“ übernommen.';
          refresh();
        });
      });
    }

    if (current.upload && current.upload.mode !== 'off') {
      $('up-label').textContent = current.upload.label + (current.upload.required ? '' : ' – optional');
      $('up-hint').textContent = current.upload.hint || '';
      fUpload.classList.remove('hide');
      // Co-Branding: zweites Logo nur, wenn das Motto es erlaubt (z. B. Handwerker: Innung, Partner)
      $('f-upload2').classList.toggle('hide', !(current.upload.mode === 'exact' && current.upload.coBrand));
      if (current.upload.label2) $('up2-label').textContent = current.upload.label2 + ' – optional';
      // Fassung 59: Logo-Weg nur bei echten Logos (nicht bei Fotos als Vorlage)
      $('f-logoart').classList.toggle('hide', current.upload.mode !== 'exact');
    } else {
      fUpload.classList.add('hide'); $('f-upload2').classList.add('hide'); $('f-logoart').classList.add('hide');
    }
    logoArt = 'eingearbeitet';
    Array.prototype.forEach.call($('logoart').querySelectorAll('button'), function (x) { x.classList.toggle('on', x.getAttribute('data-l') === logoArt); });

    style = 'standard';
    // "Gruesse aus": der erste Stil der Reihe (Ansichtskarte) ist vorgewaehlt - so wenig wie
    // moeglich selbst tun. Ein ?stil= von der Startseite gewinnt weiter.
    if (current.stileVorne && current.stileVorne.length && current.styles && current.styles.some(function (st) { return st.key === current.stileVorne[0]; })) style = current.stileVorne[0];
    var samples = current.styleSamples || {};
    if (current.styleChoice !== false && current.styles && current.styles.length) {
      // Optional per URL vorgewaehlter Stil (?stil=key) von der Startseite
      try {
        var wish = new URLSearchParams(location.search).get('stil');
        if (wish && current.styles.some(function (st) { return st.key === wish; })) style = wish;
      } catch (e) { }
      // 21. Sept., Markus: "Wie vorgesehen kann weg." Der Standard bleibt die stille Vorgabe (so, wie
      // das Motto gedacht ist); als Kachel erscheint er nicht mehr.
      var ohneStandard = !current.artikelFest && current.styles.length > 1;
      $('styles').innerHTML = current.styles.filter(function (st) { return !(ohneStandard && st.key === 'standard'); }).map(function (st) {
        var pic = samples[st.key] ? '<img src="' + esc(samples[st.key]) + '" alt="" loading="lazy">' : '';
        return '<button type="button" data-s="' + esc(st.key) + '" class="' + (st.key === style ? 'on' : '') + (pic ? ' pic' : '') + '">' + pic + '<b>' + esc(st.label) + '</b><small>' + esc(st.desc) + '</small></button>';
      }).join('');
      $('f-style').classList.remove('hide');
      textilHinweis();
      // In der Abfolge zeigt jeder Stil-Bildschirm vier Stile, der Rest steht hinter "Mehr Stile".
      if (mitAbfolge()) stileKuerzen();
    } else {
      $('f-style').classList.add('hide');
    }
    // 19. Sept.: Die Kacheln der Startseite bringen Stil, Textilfarbe und Teil mit. Was sie
    // versprechen, muss hier vorbelegt sein - sonst landet der Besucher "irgendwo".
    try {
      var q = new URLSearchParams(location.search);
      var tx = q.get('textil');
      // Seit dem 26. Sept. gibt es alle vier Kacheln, die Adresse wird also unveraendert
      // uebernommen. Aeltere Designs haben nur hell/dunkel gespeichert - das sind gueltige
      // Toene und treffen ihre eigene Kachel.
      if (TEXTILTOENE.indexOf(tx) >= 0) { textilSetzen(tx); textilSelbstGewaehlt = true; }   // die Kachel hat genau diesen Ton versprochen
      var tl = q.get('teil');
      wunschTeil = (tl && /^[a-z0-9-]+$/.test(tl)) ? tl : '';
      var fi = q.get('firma');
      // 1. Okt., "Textil machen" am Tor: Freestyle wie immer, nur mit dem Logo des Hauses (Motto
      // haus). Der Betrieb steht im versteckten Feld, sein Logo ist der Upload fr_<slug>.png.
      if (current.hausTextil && $('v_firma')) {
        var slugH = (fi && /^[a-z0-9_-]{1,80}$/i.test(fi)) ? fi.toLowerCase().replace(/[^a-z0-9_-]/g, '') : '';
        $('v_firma').value = slugH;
        if (slugH) { firmenLogo = 'fr_' + slugH + '.png'; firmenName = ''; logoVorschlagen(); }
        else say('Dieses Motto braucht den Link des Betriebs (…/bei/…). Ohne ihn geht es nicht weiter.', true);
      }
      if ((q.get('stil') || tx || tl) && !vorbelegtGescrollt) {
        vorbelegtGescrollt = true;
        var ziel = (!$('f-style').classList.contains('hide')) ? $('f-style') : $('textiles');
        setTimeout(function () { try { ziel.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { } }, 250);
      }
    } catch (e) { }

    // Farbstimmung: zweite Knopfreihe neben dem Stil, gleiche Bedienung.
    mood = 'standard';
    moodSelbstGewaehlt = false;
    if (current.moodChoice !== false && current.moods && current.moods.length) {
      $('moods').innerHTML = current.moods.map(function (mo) {
        // "Passend zum Logo" gibt es nur bei Mottos mit Logo-Upload und erst, wenn eins da ist
        var nurLogo = mo.key === 'logo' ? ' data-nurlogo="1"' : '';
        return '<button type="button" data-m="' + esc(mo.key) + '"' + nurLogo + ' class="' + (mo.key === mood ? 'on' : '') + '"><b>' + esc(mo.label) + '</b><small>' + esc(mo.desc) + '</small></button>';
      }).join('');
      $('f-mood').classList.remove('hide');
      moodsAnpassen();
    } else { $('f-mood').classList.add('hide'); }

    // Druckplatzierung: bestimmt Format und Motivdichte der Druckdatei, darum mit echtem Mass.
    placement = '';
    if (current.placementChoice && current.placements && current.placements.length) {
      $('placements').innerHTML = current.placements.map(function (pl) {
        return '<button type="button" data-p="' + esc(pl.key) + '"><b>' + esc(pl.label) + '</b><small>' + esc(pl.mass) + '</small></button>';
      }).join('');
      $('f-placement').classList.remove('hide');
    } else { $('f-placement').classList.add('hide'); }

    // Wer "Nur unsere Logos" waehlt, bekommt gar kein gezeichnetes Design - dann sind Stil,
    // Farbstimmung und Lieblingsfarben sinnlos und wuerden nur Fragen aufwerfen. Umgekehrt
    // ist die Logo-Groesse nur dann eine Frage. Die Platzierung bleibt in beiden Faellen.
    var aufbauEl = $('v_aufbau');
    function aufbauAnwenden() {
      if (!aufbauEl) return;
      var nur = aufbauEl.value.indexOf('Nur unsere Logos') === 0;
      // Beim Zurueckschalten entscheidet, was das Motto ueberhaupt anbietet - nicht, was
      // gerade zufaellig sichtbar war. Eine Momentaufnahme hat hier die Lieblingsfarben verloren.
      var kann = {
        'f-style': current.styleChoice !== false && current.styles && current.styles.length > 0,
        'f-mood': current.moodChoice !== false && current.moods && current.moods.length > 0,
        'f-colors': current.colorChoice !== false
      };
      Object.keys(kann).forEach(function (id) {
        var el = $(id);
        if (el) el.classList.toggle('hide', nur || !kann[id]);
      });
      var g = $('f_logogroesse');
      if (g) g.classList.toggle('hide', !nur);
      var ph = $('placement-hint');
      if (ph) ph.textContent = nur
        ? 'Jede Platzierung ist eine eigene Druckdatei im richtigen Format – eure Logos werden unverändert hineingesetzt.'
        : 'Jede Platzierung ist eine eigene Druckdatei im richtigen Format. Ein kleiner Brustprint bekommt ein einzelnes Motiv, kein Panorama.';
    }
    if (aufbauEl) {
      aufbauEl.addEventListener('change', aufbauAnwenden);
      aufbauAnwenden();
    }
    // Stil-Galerie: alle Beispiele dieses Mottos nebeneinander
    var gal = (current.styles || []).filter(function (st) { return samples[st.key]; });
    if (gal.length) {
      $('gallery-row').innerHTML = gal.map(function (st) {
        return '<a href="#f-style" data-g="' + esc(st.key) + '"><img src="' + esc(samples[st.key]) + '" alt="' + esc(st.label) + '" loading="lazy"><span>' + esc(st.label) + '</span></a>';
      }).join('');
      $('gallery').classList.remove('hide');
    } else {
      $('gallery').classList.add('hide');
    }
    $('f-colors').classList.toggle('hide', current.colorChoice === false);

    // Schriftart-Auswahl nur zeigen, wenn dieses Motto Namen setzt (Namensband oder Rueckseiten-Liste)
    var hasNames = current.fields.some(function (f) { return f.personal || f.type === 'list'; });
    nameFont = ['rund', 'schmal', 'serif'].indexOf(current.nameFont) >= 0 ? current.nameFont : 'rund';
    nameArt = 'unten';
    figuren = 'standard';
    if (current.figurenChoice && current.figuren && current.figuren.length) {
      // Fassung 68 (Markus, 16. Sept.: "Bei den Figuren auch die Figuren zeigen"): jeder Knopf
      // bekommt ein Bild. Erste Wahl ist ein freigegebenes Design mit genau dieser Figurenart
      // (figurenSamples), sonst die gezeichnete Miniatur - so ist die Auswahl nie nur Text.
      var fs = current.figurenSamples || {};
      $('figuren').innerHTML = current.figuren.map(function (f) {
        // Fassung 74 (Markus, 17. Sept.): gezeichnete Miniaturen sahen nach Clipart aus und haben der
        // Seite geschadet. Ein Knopf bekommt nur noch ein Bild, wenn es ein ECHTES Design mit dieser
        // Figurenart gibt; sonst steht er schlicht da wie die anderen Auswahlen.
        var bild = fs[f.key] ? '<img src="' + esc(fs[f.key]) + '" alt="" loading="lazy" onerror="this.remove()">' : '';
        return '<button type="button" data-fg="' + esc(f.key) + '" class="' + (bild ? 'pic ' : '') + (f.key === figuren ? 'on' : '') + '">' + bild + '<b>' + esc(f.label) + '</b><small>' + esc(f.desc) + '</small></button>';
      }).join('');
      $('f-figuren').classList.remove('hide');
    } else { $('f-figuren').classList.add('hide'); }
    Array.prototype.forEach.call($('nameart').querySelectorAll('button'), function (x) { x.classList.toggle('on', x.getAttribute('data-n') === nameArt); });
    $('f-font').classList.toggle('hide', !hasNames);
    $('f-nameart').classList.toggle('hide', !hasNames);
    Array.prototype.forEach.call($('fonts').querySelectorAll('button'), function (x) { x.classList.toggle('on', x.getAttribute('data-f') === nameFont); });

    // 20. Sept.: die Abfolge - ganz zum Schluss, wenn alle Kaesten der Seite stehen. Sie
    // verschiebt die vorhandenen Felder in Bildschirme; der Server bekommt dieselben Werte.
    abfolge = null;
    // 5. Okt. abends, Markus: "Wir muessen Freestyle viel, viel einfacher machen ... Stil auswaehlen passt ueberhaupt nicht.
    // Die Leute sollen einfach nur einsprechen". Freestyle einfach: Artikel und Wunsch - Stil, Stoff, Farben, Groesse und Co.
    // fuellt der Server aus dem Wunsch (freestyleBruecke).
    if (current.einfach) ['f-style', 'f-textile', 'f-mood', 'f-colors', 'f-placement', 'f-figuren', 'f-druckmass', 'f_flaeche', 'f-font', 'f-nameart', 'f-suggest', 'f-upload', 'f-logoart', 'f-upload2'].forEach(function (id) { var el = $(id); if (el) el.classList.add('hide'); });
    document.body.classList.toggle('mit-abfolge', mitAbfolge());
    if (mitAbfolge()) {
      abfolge = MoAbfolge.starten({
        motto: current, $: $, vor: fieldsBox, werte: values,
        fotoOk: function () { return !!fotoSitzung; },
        gilt: function (f) { return sichtbar(f, values()); },
        bereichText: bereichText,
        bereichFehlt: bereichFehlt,
        mitnehmen: ['check', 'go', 'bar', 'status', 'cleanup'],
        // Was das Motto selbst versteckt hat, bleibt in der Abfolge zu (Logo-Art und zweites
        // Logo gibt es nur beim echten Logo, mode 'exact' - nicht beim Foto als Vorlage).
        bleibtZu: ['f-upload', 'f-logoart', 'f-upload2'].filter(function (id) { return $(id) && $(id).classList.contains('hide'); }),
        merken: 'mo_abfolge_' + current.slug
      });
      textilNurBeiTextil();   // die Abfolge oeffnet beim Bauen alle ihre Kaesten - ein Nicht-Textil bleibt ohne Textilfrage
      // Laeuft schon ein Auftrag (Neuladen waehrend des Zeichnens)? Dann gleich zum Wartescreen.
      if (runActive) zumWartescreen();
      // Zwischenstand aus dieser Sitzung (Neuladen, Anmelde-Link): Texte und Kacheln zurueck.
      var alt = abfolge && abfolge.gemerkt();
      if (alt) Object.keys(alt).forEach(function (k) {
        var el = $('v_' + k); if (!el || el.value) return;
        el.value = alt[k];
        var kb = $('w_' + k) && $('w_' + k).querySelector('button[data-w="' + alt[k].replace(/"/g, '') + '"]');
        if (kb) [].forEach.call($('w_' + k).querySelectorAll('button[data-w]'), function (x) { x.classList.toggle('on', x === kb); });
      });
    }
    refresh();
  }
  // Was ein Bereich noch verlangt, bevor es weitergeht - dieselben Regeln wie refresh():
  // Artikel bei Freestyle, Mass in Zentimetern, Pflicht-Logo.
  function bereichFehlt(b) {
    if (!current) return '';
    if (b === 'artikel' && current.freestyle && !current.artikelFest && $('v_artikel') && !$('v_artikel').value) return 'Artikel';
    if (b === 'groesse' && current.freestyle && $('f-druckmass') && !$('f-druckmass').classList.contains('hide')) {
      var gb = parseFloat($('v_breite').value), gh = parseFloat($('v_hoehe').value);
      if (!(gb >= 3 && gb <= 45 && gh >= 3 && gh <= 45)) return 'Größe in cm';
    }
    if (b === 'logo' && current.upload && current.upload.mode !== 'off' && current.upload.required && !uploadId) return current.upload.label;
    return '';
  }
  // Text eines Bereichs fuer die Zusammenfassung der Abfolge (Stil-Name, Textilfarbe ...)
  function bereichText(b) {
    var label = function (list, key) { var t = ''; (list || []).forEach(function (x) { if (x.key === key) t = x.label; }); return t; };
    if (b === 'stil') return label(current.styles, style) ? 'Stil: ' + label(current.styles, style) : (style === 'standard' ? 'Stil: wie vorgesehen' : '');
    if (b === 'textil') return ({ weiss: 'Weißes Textil', hell: 'Helles Textil', dunkel: 'Dunkles Textil', schwarz: 'Schwarzes Textil' })[textile] || 'Schwarzes Textil';
    if (b === 'stimmung') return mood && mood !== 'standard' ? 'Farbstimmung: ' + label(current.moods, mood) : '';
    if (b === 'farben') return $('v_colors') && $('v_colors').value.trim() ? 'Farben: ' + $('v_colors').value.trim() : '';
    if (b === 'figuren') return figuren && figuren !== 'standard' ? label(current.figuren, figuren) : '';
    if (b === 'platzierung') return placement ? label(current.placements, placement) : '';
    if (b === 'logo') return uploadId ? 'Logo ist da' : '';
    if (b === 'artikel') { var s = $('v_artikel'); return s && s.value ? s.options[s.selectedIndex].textContent : ''; }
    if (b === 'groesse') { var bb = $('v_breite'), hh = $('v_hoehe'); return bb && bb.value && hh && hh.value ? bb.value + ' × ' + hh.value + ' cm' : (current.freestyle ? '' : 'Standardgröße'); }
    // Ein Kasten, der gerade zu ist (Schrift ohne Namen ...), hat auch nichts gewaehlt.
    if ((b === 'schrift' && $('f-font').classList.contains('hide')) || (b === 'namen' && $('f-nameart').classList.contains('hide'))) return '';
    if (b === 'schrift') return { rund: 'Schrift: rund & kräftig', schmal: 'Schrift: schmal & hoch', serif: 'Schrift: klassisch' }[nameFont] || '';
    if (b === 'namen') return nameArt === 'motiv' ? 'Name im Motiv' : '';
    if (b === 'aufteilung') { var au = $('v_aufteilung'); return au && $('f_aufteilung') && !$('f_aufteilung').classList.contains('hide') ? au.options[au.selectedIndex].textContent : ''; }
    return '';
  }

  // 27. Sept., Markus (dunkles Textil gewaehlt, weisses Shirt bekommen): "Wichtig ist natuerlich,
  // wenn ein Textil gewaehlt ist, dass das dann auch beim Weiterschicken so benutzt wird."
  // Was der Kunde hier antippt, ist entschieden: kein Stil darf es danach still umstellen.
  $('textiles').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-x]');
    if (!b) return;
    textile = b.getAttribute('data-x');
    textilSelbstGewaehlt = true;
    Array.prototype.forEach.call($('textiles').querySelectorAll('button'), function (x) { x.classList.toggle('on', x === b); });
    vorschauHinweis();
    textilHinweis();
    farbHinweis();
  });
  $('fonts').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-f]');
    if (!b) return;
    nameFont = b.getAttribute('data-f');
    Array.prototype.forEach.call($('fonts').querySelectorAll('button'), function (x) { x.classList.toggle('on', x === b); });
  });
  function textilSetzen(x) {
    textile = x;
    Array.prototype.forEach.call($('textiles').querySelectorAll('button'), function (b) {
      b.classList.toggle('on', b.getAttribute('data-x') === x);
    });
    vorschauHinweis();
    farbHinweis();
  }
  // 1. Okt.: Der Hinweis bei den Farben sprach immer vom "schwarzen Shirt" - auch bei Brotdose,
  // Poster und Kissen, und auch beim weissen Shirt. Jetzt passt er zu dem, worauf gedruckt wird.
  function farbHinweis() {
    var h = document.querySelector('#f-colors .hint'); if (!h) return;
    var stoff = !$('f-textile') || !$('f-textile').classList.contains('hide') || !(current && current.freestyle);
    if (current && current.artikelFest) stoff = false;
    h.textContent = !stoff ? 'Leer lassen heißt: Otto sucht die Farben aus.'
      : (textile === 'weiss' || textile === 'hell')
        ? 'Leer lassen heißt: Otto sucht die Farben aus. Dunkle Schrift bleibt immer, damit es auf dem hellen Stoff lesbar ist.'
        : 'Leer lassen heißt: Otto sucht die Farben aus. Helle Schrift bleibt immer, damit es auf dem dunklen Stoff lesbar ist.';
  }
  // Ehrlich bleiben: gezeichnet wird fuer den gewaehlten Ton, aber die Vorschaubilder gibt es
  // nur in Weiss und Schwarz. Wer Sand oder Navy waehlt, soll nicht denken, sein Shirt sei
  // falsch geliefert worden, wenn die Vorschau weiss bzw. schwarz aussieht.
  function vorschauHinweis() {
    var h = $('textil-vorschau'); if (!h) return;
    var bunt = textile === 'hell' || textile === 'dunkel';
    h.classList.toggle('hide', !bunt);
    if (bunt) h.textContent = 'Otto zeichnet für ' + (textile === 'hell' ? 'helles' : 'dunkles')
      + ' Textil. Die Vorschau zeigt der Einfachheit halber ein '
      + (textile === 'hell' ? 'weißes' : 'schwarzes') + ' Shirt – dein Motiv ist für die gewählte Farbe gemacht.';
  }
  // Der Stil bringt seine Palette mit und EMPFIEHLT das Textil dazu. Bis zum 27. Sept. hat er
  // die andere Kachel gesperrt und die Wahl des Kunden umgestellt - Markus (dunkles Textil
  // gewaehlt, weisses Shirt bekommen): "wenn ein Textil gewaehlt ist, dass das dann auch beim
  // Weiterschicken so benutzt wird." Jetzt bleiben alle Kacheln waehlbar. Der Hinweis sagt,
  // was der Stil empfiehlt und warum; hat der Kunde etwas anderes gewaehlt, sagt er auch das -
  // und Otto zeichnet fuer genau diesen Ton (mottos.js textilFuerAuftrag).
  function textilHinweis() {
    var gehoert = stilTextil(style);
    var h = $('textil-hinweis');
    if (h) {
      h.classList.toggle('hide', !gehoert);
      if (gehoert) {
        var grund = (TEXTIL_GRUND[style] ||
          (bereichText('stil').replace('Stil: ', '') || 'Dieser Stil') +
          (gehoert === 'hell'
            ? ' wird auf hellem Textil gedruckt: seine Farben brauchen einen hellen Grund, auf Schwarz würden sie im Stoff verschwinden.'
            : ' wird auf dunklem Textil gedruckt: er lebt von hellen Farben, die gegen den dunklen Stoff leuchten.')).replace(' wird auf ', ' kommt auf ').replace(' Textil gedruckt:', ' Textil am besten:');
        var anders = tonGruppe(textile) !== tonGruppe(gehoert);
        h.textContent = grund + (anders
          ? ' Du hast ' + bereichText('textil').toLowerCase().replace('es textil', 'es Textil') + ' gewählt – dann zeichnet Otto dafür.'
          : '');
      }
    }
    Array.prototype.forEach.call($('textiles').querySelectorAll('button'), function (b) {
      b.disabled = false;
      b.style.opacity = '';
      b.style.cursor = '';
    });
  }
  $('styles').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-s]');
    if (!b) return;
    style = b.getAttribute('data-s');
    Array.prototype.forEach.call($('styles').querySelectorAll('button'), function (x) { x.classList.toggle('on', x === b); });
    // Vorbelegen, solange der Kunde noch nichts gewaehlt hat. Hat er, bleibt seine Wahl.
    var gehoert = stilTextil(style);
    // 4. Okt. abends, Markus: "Ja, stelle das um auf weiss" (keine schwarzen Textilien mehr als Vorgabe). Ein Stil, der
    // dunklen Stoff braucht (Neon, Glitzer ...), belegt das farbige dunkle Textil vor (Navy, Flaschengruen), nie Schwarz.
    if (gehoert && !textilSelbstGewaehlt && tonGruppe(textile) !== tonGruppe(gehoert)) textilSetzen(gehoert === 'hell' ? 'weiss' : 'dunkel');
    textilHinweis();
  });
  $('figuren').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    figuren = b.getAttribute('data-fg');
    Array.prototype.forEach.call($('figuren').querySelectorAll('button'), function (x) { x.classList.toggle('on', x === b); });
  });
  $('nameart').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    nameArt = b.getAttribute('data-n');
    Array.prototype.forEach.call($('nameart').querySelectorAll('button'), function (x) { x.classList.toggle('on', x === b); });
  });
  $('logoart').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    logoArt = b.getAttribute('data-l');
    Array.prototype.forEach.call($('logoart').querySelectorAll('button'), function (x) { x.classList.toggle('on', x === b); });
  });
  $('moods').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-m]');
    if (!b) return;
    mood = b.getAttribute('data-m');
    moodSelbstGewaehlt = true;
    Array.prototype.forEach.call($('moods').querySelectorAll('button'), function (x) { x.classList.toggle('on', x === b); });
  });
  // Die Platzierung laesst sich auch wieder abwaehlen - dann entscheidet das Motto selbst.
  $('placements').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-p]');
    if (!b) return;
    var war = placement;
    placement = b.getAttribute('data-p') === war ? '' : b.getAttribute('data-p');
    Array.prototype.forEach.call($('placements').querySelectorAll('button'), function (x) {
      x.classList.toggle('on', placement && x === b);
    });
  });
  $('gallery-row').addEventListener('click', function (e) {
    var a = e.target.closest('a[data-g]');
    if (!a) return;
    var key = a.getAttribute('data-g');
    var b = $('styles').querySelector('button[data-s="' + key + '"]');
    if (b) { b.click(); }
  });

  drop.addEventListener('click', function () { file.click(); });
  drop.addEventListener('dragover', function (e) { e.preventDefault(); });
  drop.addEventListener('drop', function (e) { e.preventDefault(); if (e.dataTransfer.files[0]) send(e.dataTransfer.files[0]); });
  file.addEventListener('change', function () { if (file.files[0]) send(file.files[0]); });
  $('thumb-del').addEventListener('click', function () { uploadId = null; thumb.classList.add('hide'); drop.classList.remove('hide'); zeigePreflight(null); dunkelHinweis(null); refresh(); });
  var drop2 = $('drop2'), file2 = $('file2');
  drop2.addEventListener('click', function () { file2.click(); });
  drop2.addEventListener('dragover', function (e) { e.preventDefault(); });
  drop2.addEventListener('drop', function (e) { e.preventDefault(); if (e.dataTransfer.files[0]) send(e.dataTransfer.files[0], true); });
  file2.addEventListener('change', function () { if (file2.files[0]) send(file2.files[0], true); });
  $('thumb2-del').addEventListener('click', function () { uploadId2 = null; $('thumb2').classList.add('hide'); drop2.classList.remove('hide'); });

  // Handy-Fotos sind oft HEIC und mehrere MB. Wir dekodieren + verkleinern im Browser
  // und schicken ein normales JPEG - das löst HEIC, Dateigröße und Bild-Drehung (EXIF) auf einmal.
  function toJpeg(file, maxPx, q) {
    return new Promise(function (resolve) {
      var done = false;
      function draw(src, w, h) {
        if (done) return; done = true;
        if (!w || !h) { resolve(null); return; }
        var scale = Math.min(1, maxPx / Math.max(w, h));
        var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
        var c = document.createElement('canvas'); c.width = cw; c.height = ch;
        try { c.getContext('2d').drawImage(src, 0, 0, cw, ch); resolve(c.toDataURL('image/jpeg', q)); }
        catch (e) { resolve(null); }
      }
      function viaImg() {
        var url = URL.createObjectURL(file), im = new Image();
        im.onload = function () { draw(im, im.naturalWidth, im.naturalHeight); URL.revokeObjectURL(url); };
        im.onerror = function () { URL.revokeObjectURL(url); resolve(null); };
        im.src = url;
      }
      if (window.createImageBitmap) {
        createImageBitmap(file, { imageOrientation: 'from-image' })
          .then(function (bmp) { draw(bmp, bmp.width, bmp.height); if (bmp.close) bmp.close(); })
          .catch(viaImg);
      } else viaImg();
    });
  }
  // Fortschritt im Feld selbst: "Logo wird hochgeladen ..." - Markus, 14. Sept.: "Hier erkenne ich
  // beim Hochladen nicht, was er macht." Die Statuszeile unten sieht auf dem Handy niemand.
  function feldStatus(zone, text) {
    if (!zone) return;
    if (!zone.dataset.urtext) zone.dataset.urtext = zone.innerHTML;
    if (text) { zone.classList.add('laeuft'); zone.innerHTML = '<b>' + esc(text) + '</b><small>bitte einen Moment – das Bild wird vorbereitet, hochgeladen und geprüft</small>'; }
    else { zone.classList.remove('laeuft'); zone.innerHTML = zone.dataset.urtext; }
  }
  function send(f, second) {
    var zone = second ? drop2 : drop;
    var was = (current && current.upload && current.upload.mode === 'reference') ? 'Foto' : 'Logo';
    if (f.size > 40 * 1024 * 1024) { say('Das Bild ist sehr groß (über 40 MB). Bitte ein kleineres nehmen.', true); return; }
    say('Bild wird vorbereitet …');
    feldStatus(zone, was + ' wird vorbereitet …');
    logoArbeitSetzen('upload');
    // Fassung 37 (Markus, 14. Sept., "???" mit schwarzem Logo in der Vorschau): bisher wurde JEDES
    // Bild im Browser zu JPEG - und JPEG kennt keine Transparenz. Aus durchsichtig wurde schwarz,
    // schwarze Buchstaben verschmolzen mit dem Grund und flogen beim Freistellen mit raus ("yber-tics").
    // Logos (PNG, WebP, SVG, PDF) gehen jetzt UNVERAENDERT zum Server, der kann alle lesen.
    // Nur Fotos (JPEG, HEIC) werden weiter im Browser verkleinert und gedreht.
    var typ = String(f.type || '').toLowerCase(), name = String(f.name || '').toLowerCase();
    var roh = /png|webp|gif|svg|pdf/.test(typ) || /\.(png|webp|gif|svg|pdf|ai)$/.test(name);
    var vorbereiten = roh && f.size <= 8 * 1024 * 1024
      ? new Promise(function (resolve) { var fr = new FileReader(); fr.onload = function () { resolve(fr.result); }; fr.onerror = function () { resolve(null); }; fr.readAsDataURL(f); })
      : toJpeg(f, was === 'Logo' ? 2400 : 1600, 0.9);
    vorbereiten.then(function (dataUrl) {
      if (!dataUrl) { feldStatus(zone, null); logoArbeitSetzen(null); say('Das Bild konnte nicht gelesen werden. Bitte ein anderes Foto nehmen (JPG/PNG).', true); return; }
      say('Bild wird hochgeladen …');
      feldStatus(zone, was + ' wird hochgeladen und geprüft …');
      fetchJson(API + '/upload', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ dataUrl: dataUrl, motto: current && current.slug }) }, 1)
        .then(function (r) {
          feldStatus(zone, null);
          if (r.j && r.j.error === 'verboten') { logoArbeitSetzen(null); say(VERBOTEN_TEXT, true); return; }
          if (r.j && r.j.error === 'pruefung') { logoArbeitSetzen(null); say(r.j.hinweis || 'Wir konnten das Bild gerade nicht prüfen. Bitte in einem Moment noch einmal hochladen.', true); return; }
          if (r.j && r.j.error === 'marke') { logoArbeitSetzen(null); say('Das Bild zeigt ein geschütztes Logo oder Wappen' + (r.j.wort && r.j.wort !== 'echtes Vereins-/Markenzeichen' ? ' (' + r.j.wort + ')' : '') + ' und darf nicht auf ein Textil. Bitte ein eigenes Bild oder Logo nehmen.', true); return; }
          if (!r.ok || !r.j.uploadId) { logoArbeitSetzen(null); say('Das Bild konnte nicht gelesen werden. Bitte ein anderes nehmen.', true); return; }
          if (second) {
            uploadId2 = r.j.uploadId;
            $('thumb2-img').src = dataUrl;
            $('thumb2-name').textContent = f.name + ' · ' + r.j.width + ' × ' + r.j.height;
            $('thumb2').classList.remove('hide'); drop2.classList.add('hide');
            logoArbeitSetzen(null); say(''); return;
          }
          // Fassung 35: Preflight. Unbrauchbar = wird NICHT angenommen, der Kunde sieht warum und
          // kann Otto das Logo sauber nachzeichnen lassen. Maessig = angenommen, aber mit Warnung
          // und demselben Angebot.
          var pf = r.j.preflight;
          // Fassung 59: bei "eingearbeitet" zeichnet Otto das Logo ohnehin neu - ein kleines oder
          // unscharfes Logo ist dann eine Vorlage, kein Hindernis. Nur bei "Original exakt" bleibt die Sperre.
          if (pf && pf.stufe === 'unbrauchbar' && logoArt === 'exakt') {
            uploadId = null;
            thumb.classList.add('hide'); drop.classList.remove('hide');
            zeigePreflight(pf, r.j, dataUrl, f.name, false);
            say('');
            // Der Kunde muss erst entscheiden: nachzeichnen lassen oder anderes Logo
            logoArbeitSetzen('entscheidung');
            return;
          }
          uploadId = r.j.uploadId;
          $('thumb-img').src = dataUrl;
          $('thumb-name').textContent = f.name + ' · ' + r.j.width + ' × ' + r.j.height;
          thumb.classList.remove('hide');
          drop.classList.add('hide');
          if (pf && (pf.stufe === 'maessig' || pf.stufe === 'unbrauchbar')) zeigePreflight(pf, r.j, dataUrl, f.name, true); else zeigePreflight(null);
          // Schwarze Logoteile auf dunklem Textil drucken Ton in Ton - Markus: "nicht so schlimm, manchmal
          // auch so gewollt". Also nur ein Hinweis unter dem Feld, keine Warnung.
          dunkelHinweis(pf);
          say('');
          logoArbeitSetzen(null);
        }).catch(function () { feldStatus(zone, null); logoArbeitSetzen(null); say('Hochladen fehlgeschlagen. Bitte noch einmal versuchen.', true); });
    });
  }
  function dunkelHinweis(pf) {
    var alt = $('up-dunkel'); if (alt) alt.remove();
    if (!pf || !(pf.dunkelFrei >= 3) || hellerStoff(textile) || !$('up-hint')) return;
    var z = document.createElement('div'); z.id = 'up-dunkel'; z.style.cssText = 'margin-top:6px;color:var(--ink2)';
    z.textContent = 'Hinweis: Schwarze Flächen des Logos drucken auf dunklem Textil Ton in Ton. Wenn das nicht gewollt ist, die helle Logovariante nehmen.';
    $('up-hint').appendChild(z);
  }
  // Achtung, Logo nicht brauchbar - und der Ausweg: Otto zeichnet es sauber nach.
  function zeigePreflight(pf, antwort, dataUrl, name, angenommen) {
    var box = $('preflight'); if (!box) return;
    if (!pf) { box.classList.add('hide'); box.innerHTML = ''; return; }
    var gruendeListe = (pf.gruende || []).slice();
    // Schwarze Logoteile auf schwarzem Shirt: unsichtbar. Das Logo wird so gedruckt, wie es ist.
    var gruende = gruendeListe.map(function (g) { return '<li>' + esc(g) + '</li>'; }).join('');
    box.className = 'preflight' + (angenommen ? '' : ' ');
    box.innerHTML = '<img src="' + esc(dataUrl) + '" alt=""><div class="t"><b>' +
      (angenommen ? 'Achtung: Dieses Logo ist nur bedingt druckbar.' : 'Achtung: Dieses Logo ist so nicht brauchbar.') + '</b>' +
      '<ul>' + gruende + '</ul>' +
      (angenommen && logoArt === 'eingearbeitet' ? '<div>Bei „Eingearbeitet“ zeichnet Otto das Logo im Design ohnehin neu – sauber und scharf, Schrift und Form werden geprüft. Die Qualität der Datei spielt dann keine Rolle. Nur für „Original, unverändert“ bräuchte es eine bessere Datei.</div>' : '') +
      (antwort.nachzeichnen ? '<div>Otto kann das Logo sauber nachzeichnen: gleiche Formen, gleiche Schrift, gleiche Farben – nur scharf und ohne Reste. Die Schrift wird vorher gelesen und hinterher geprüft. Du siehst das Ergebnis und entscheidest.</div>' : '<div>Bitte lade die Originaldatei hoch: PNG, SVG oder PDF, mindestens 700 Pixel breit.</div>') +
      '<div class="k">' + (antwort.nachzeichnen ? '<button type="button" class="haupt" id="pf-nach">Otto soll es nachzeichnen</button>' : '') +
      '<button type="button" id="pf-anders">' + (angenommen ? 'Trotzdem so verwenden' : 'Anderes Logo hochladen') + '</button></div></div>';
    box.classList.remove('hide');
    var nach = $('pf-nach');
    // ---- Nachzeichnen: anstossen, warten, Ergebnis zeigen - und auf Wunsch nachbessern und merken ----
    // Fassung 56 (Markus, 16. Sept.): "dass man sagen kann: schau mal am Logo auch das und das, Fehler
    // bitte beheben - und dann speichern". Jede Korrektur ist ein neuer Lauf mit dem nachgezeichneten
    // Logo als Quelle und dem Wunsch des Kunden im Prompt. Das Ergebnis kann gemerkt werden, damit es
    // beim naechsten Design nicht wieder von vorn losgeht.
    var nzStart = 0;
    function nzWarten(auftrag, knopf) {
      return new Promise(function (resolve, reject) {
        (function frag() {
          fetchJson(API + '/upload/nachzeichnen/' + encodeURIComponent(auftrag), undefined, 1).then(function (r) {
            var s = r.j || {};
            if (s.status === 'laeuft') {
              knopf.textContent = (knopf.dataset.tun || 'Otto zeichnet') + ' … ' + Math.round((Date.now() - nzStart) / 1000) + ' s';
              if (Date.now() - nzStart > 6 * 60000) { reject(new Error('zeit')); return; }
              setTimeout(frag, 3000); return;
            }
            resolve({ ok: s.status === 'fertig' && !!s.uploadId, j: s });
          }).catch(function () { setTimeout(frag, 4000); });
        })();
      });
    }
    // Start mit Geduld: waehrend eines Deploys antwortet der Server kurz mit einer Fehlerseite -
    // dann nicht sofort aufgeben, sondern bis zu dreimal nach ein paar Sekunden neu anstossen.
    function nzStarten(quellId, korrektur, knopf, versuch) {
      return fetchJson(API + '/upload/nachzeichnen', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ uploadId: quellId, motto: current && current.slug, korrektur: korrektur || '' }) }, 1)
        .then(function (r0) {
          if (r0.ok && r0.j.auftrag) return nzWarten(r0.j.auftrag, knopf);
          if ((r0.status >= 500 || r0.status === 0) && versuch < 3) {
            knopf.textContent = 'Server antwortet nicht (' + r0.status + ') – neuer Versuch …';
            return new Promise(function (res) { setTimeout(res, 4000); }).then(function () { return nzStarten(quellId, korrektur, knopf, versuch + 1); });
          }
          return { ok: false, j: r0.j || {}, status: r0.status };
        });
    }
    // Der Grund gehoert in den Kasten - die Statuszeile unten sieht auf dem Handy niemand
    function nzGrund(text) {
      var g = box.querySelector('.pf-grund');
      if (!g) { g = document.createElement('div'); g.className = 'pf-grund'; g.style.cssText = 'margin-top:8px;color:var(--warn);font-weight:700'; box.querySelector('.t').appendChild(g); }
      g.textContent = text; say(text, true);
    }
    function nzLaufen(quellId, korrektur, knopf) {
      knopf.disabled = true;
      knopf.dataset.tun = korrektur ? 'Otto bessert nach' : 'Otto zeichnet';
      knopf.textContent = knopf.dataset.tun + ' … (etwa eine Minute)';
      logoArbeitSetzen('nachzeichnen');
      nzStart = Date.now();
      nzStarten(quellId, korrektur, knopf, 1)
        .then(function (r) {
          if (!r.ok || !r.j.uploadId) {
            knopf.disabled = false; knopf.textContent = 'Noch einmal versuchen';
            logoArbeitSetzen('entscheidung');
            nzGrund(r.j && r.j.error === 'verboten' ? VERBOTEN_TEXT : r.j && r.j.error === 'marke' ? 'Im nachgezeichneten Logo steckt ein geschütztes Zeichen. Bitte ein anderes Logo nehmen.' : (r.j && r.j.hinweis) || ('Das Nachzeichnen hat gerade nicht geklappt' + (r.status ? ' (Antwort ' + r.status + ')' : '') + '.'));
            return;
          }
          nzErgebnis(r.j);
        })
        .catch(function (e) {
          knopf.disabled = false; knopf.textContent = 'Noch einmal versuchen'; logoArbeitSetzen('entscheidung');
          nzGrund(e && e.message === 'zeit' ? 'Das dauert heute zu lange – bitte später noch einmal.' : 'Keine Verbindung zum Server. Bitte noch einmal tippen.');
        });
    }
    function nzErgebnis(j) {
      var pf2 = j.preflight;
      box.innerHTML = '<img src="' + esc(j.vorschau) + '" alt=""><div class="t"><b>' + (j.korrektur ? 'So sieht das Logo nach der Korrektur aus.' : 'So sieht das nachgezeichnete Logo aus.') + '</b>' +
        (pf2 && pf2.stufe !== 'gut' ? '<ul>' + (pf2.gruende || []).map(function (g) { return '<li>' + esc(g) + '</li>'; }).join('') + '</ul>' : '<div>' + esc((pf2 && pf2.hinweise || []).join(' ')) + (j.erwartet && j.erwartet.length ? ' Erwartete Schrift: „' + esc(j.erwartet.join(' ')) + '“, gelesen: „' + esc((j.gelesen || []).join(' ')) + '“.' : '') + ' Ist die Schrift korrekt und stimmen die Farben? Dann nimm es.</div>') +
        '<div class="k"><button type="button" class="haupt" id="pf-ja">Ja, so verwenden</button><button type="button" id="pf-nein">Nein, anderes Logo hochladen</button></div>' +
        '<label class="pf-merk"><input type="checkbox" id="pf-merken" checked> Logo merken – beim nächsten Design wird es gleich vorgeschlagen, ohne neues Nachzeichnen</label>' +
        '<div class="pf-korr"><div><b>Stimmt noch etwas nicht?</b> Sag Otto, was er ändern soll – er bessert genau das nach und lässt den Rest, wie er ist.</div>' +
        '<textarea id="pf-korr-text" rows="2" placeholder="z. B. „Das n ist zu fett, der Ring muss überall gleich dick sein, das Blau etwas heller“"></textarea>' +
        '<button type="button" id="pf-korr-go">Otto soll das nachbessern</button></div></div>';
      box.className = 'preflight gut';
      logoArbeitSetzen('entscheidung');
      $('pf-ja').addEventListener('click', function () {
        uploadId = j.uploadId;
        $('thumb-img').src = j.vorschau;
        $('thumb-name').textContent = 'Nachgezeichnet: ' + name + ' · ' + j.width + ' × ' + j.height;
        thumb.classList.remove('hide'); drop.classList.add('hide');
        var merken = $('pf-merken') && $('pf-merken').checked;
        zeigePreflight(null); say(''); logoArbeitSetzen(null);
        if (merken) logoMerken(j, name);
      });
      $('pf-nein').addEventListener('click', function () { uploadId = null; thumb.classList.add('hide'); drop.classList.remove('hide'); zeigePreflight(null); logoArbeitSetzen(null); file.click(); });
      $('pf-korr-go').addEventListener('click', function () {
        var t = $('pf-korr-text').value.trim();
        if (t.length < 3) { $('pf-korr-text').focus(); nzGrund('Schreib kurz, was Otto ändern soll.'); return; }
        nzLaufen(j.uploadId, t, $('pf-korr-go'));
      });
    }
    if (nach) nach.addEventListener('click', function () { nzLaufen(antwort.uploadId, '', nach); });
    var anders = $('pf-anders');
    if (anders) anders.addEventListener('click', function () {
      // "Trotzdem so verwenden" bzw. "Anderes Logo": in beiden Faellen ist die Entscheidung
      // gefallen, der Start ist wieder frei (beim Neuhochladen sperrt send() sofort erneut).
      if (angenommen) { zeigePreflight(null); logoArbeitSetzen(null); return; }
      zeigePreflight(null); logoArbeitSetzen(null); file.click();
    });
  }

  // ---------------- Namensliste direkt auf der Seite ausfüllen ----------------
  // Die Textarea bleibt der Wert, den alles Weitere liest (eine Person je Zeile,
  // "Name, Größe, Artikel, E-Mail, Handy, Rolle"). Darüber liegt eine Tabelle mit
  // eigenen Feldern - das ist die Liste, in die man wirklich hineinschreibt.
  var NL_LEER = { name: '', size: '', art: '', mail: '', tel: '', rolle: '' };

  function nlSizes() { return (current && current.sizes && current.sizes.length) ? current.sizes : ['XS', 'S', 'M', 'L', 'XL', 'XXL']; }
  function nlArtikel() { return (current && current.artikel && current.artikel.length) ? current.artikel : []; }

  // Eine Zeile der Textarea in Felder zerlegen - gleiche Regeln wie der Server beim Einlesen,
  // damit eine hochgeladene oder getippte Liste in der Tabelle richtig landet.
  function nlParse(zeile) {
    var teile = String(zeile || '').split(/[;,\t]/).map(function (s) { return s.trim(); }).filter(function (s) { return s !== ''; });
    var p = { name: teile.shift() || '', size: '', art: '', mail: '', tel: '', rolle: '' };
    var sizes = nlSizes(), artikel = nlArtikel();
    teile.forEach(function (t) {
      var low = t.toLowerCase();
      if (!p.mail && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t)) p.mail = t;
      else if (!p.rolle && /^(orga|orga-?team|organisation|team|teilnehmer)$/.test(low)) p.rolle = /^teilnehmer$/.test(low) ? 'Teilnehmer' : 'Orga';
      else if (!p.size && sizes.some(function (s) { return s.toLowerCase() === low; })) p.size = sizes.filter(function (s) { return s.toLowerCase() === low; })[0];
      else if (!p.art && artikel.some(function (a) { return a.toLowerCase() === low; })) p.art = artikel.filter(function (a) { return a.toLowerCase() === low; })[0];
      else if (!p.art && /hoodie|shirt|zip|jacke|pulli/.test(low)) p.art = t;
      else if (!p.tel && /^(\+|00|0)?[\d\s\-()\/.]{6,}$/.test(t) && t.replace(/\D/g, '').length >= 6) p.tel = t;
    });
    return p;
  }
  function nlZeile(p) {
    return [p.name, p.size, p.art, p.mail, p.tel, p.rolle].filter(function (x) { return String(x || '').trim(); })
      .map(function (x) { return String(x).trim(); }).join(', ');
  }

  // Tabelle -> Textarea. Leere Zeilen fallen dabei weg, im Formular bleiben sie stehen.
  function nlSchreiben(key) {
    var box = $('nl_' + key), ta = $('v_' + key);
    if (!box || !ta) return;
    var zeilen = [].map.call(box.querySelectorAll('.nl-row[data-i]'), function (r) {
      return nlZeile({
        name: r.querySelector('.nl-name').value,
        size: nlWert(r, '.nl-size'), art: nlWert(r, '.nl-art'),
        mail: nlWert(r, '.nl-mail'), tel: nlWert(r, '.nl-tel'), rolle: nlWert(r, '.nl-rolle')
      });
    }).filter(Boolean);
    var vorher = ta.value;
    ta.value = zeilen.join('\n');
    var z = box.querySelector('.nl-zahl');
    if (z) z.textContent = zeilen.length === 0 ? 'noch niemand eingetragen' : zeilen.length === 1 ? '1 Person' : zeilen.length + ' Personen';
    // Nur melden, wenn sich wirklich etwas geändert hat - sonst gälte das Formular schon beim Aufbau als angefasst
    if (ta.value !== vorher) ta.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function nlWert(row, sel) { var el = row.querySelector(sel); return el ? el.value : ''; }

  // Textarea -> Tabelle. Wird beim Aufbau und nach jedem Datei-Upload aufgerufen.
  function nlLesen(key, mindestens) {
    var ta = $('v_' + key);
    var leute = String(ta && ta.value || '').split('\n').map(function (l) { return l.trim(); })
      .filter(Boolean).slice(0, 100).map(nlParse);
    var min = Math.min(Math.max(3, mindestens || 0), 100);
    while (leute.length < min) leute.push(Object.assign({}, NL_LEER));
    return leute;
  }

  function nlAufbauen(key, kontakt) {
    var box = $('nl_' + key);
    if (!box) return;
    // Beim Umbauen (Kontakte ein/aus, Upload) bleiben die leeren Zeilen erhalten, die schon da waren
    var leute = nlLesen(key, box.querySelectorAll('.nl-row[data-i]').length);
    var artikel = nlArtikel();
    var opt = function (werte, gewaehlt, leerText) {
      return '<option value="">' + esc(leerText) + '</option>' + werte.map(function (w) {
        return '<option value="' + esc(w) + '"' + (String(gewaehlt) === String(w) ? ' selected' : '') + '>' + esc(w) + '</option>';
      }).join('');
    };
    var kopf = '<div class="nl-row nl-head' + (kontakt ? ' kontakt' : '') + '"><span></span><span>Name</span><span>Größe</span>'
      + (artikel.length ? '<span>Artikel</span>' : '<span></span>')
      + (kontakt ? '<span>E-Mail</span><span>Handy</span><span>Rolle</span>' : '') + '<span></span></div>';
    var zeilen = leute.map(function (p, i) {
      return '<div class="nl-row' + (kontakt ? ' kontakt' : '') + '" data-i="' + i + '">' +
        '<span class="nl-n">' + (i + 1) + '</span>' +
        '<input class="nl-name" type="text" inputmode="text" autocomplete="off" maxlength="40" placeholder="Name" value="' + esc(p.name) + '">' +
        '<select class="nl-size" aria-label="Größe">' + opt(nlSizes(), p.size, 'Größe') + '</select>' +
        (artikel.length ? '<select class="nl-art" aria-label="Artikel">' + opt(artikel, p.art, 'Artikel') + '</select>' : '<span></span>') +
        (kontakt
          ? '<input class="nl-mail" type="email" autocomplete="off" placeholder="E-Mail" value="' + esc(p.mail) + '">' +
            '<input class="nl-tel" type="tel" autocomplete="off" placeholder="Handy" value="' + esc(p.tel) + '">' +
            '<select class="nl-rolle" aria-label="Rolle">' + opt(['Teilnehmer', 'Orga'], p.rolle, 'Rolle') + '</select>'
          : '') +
        '<button type="button" class="nl-del" title="Zeile löschen" aria-label="Zeile löschen">✕</button>' +
        '</div>';
    }).join('');
    var fuss = '<div class="nl-foot">' +
      '<button type="button" class="nl-add">+ Zeile</button>' +
      '<button type="button" class="nl-add10">+ 10 Zeilen</button>' +
      '<button type="button" class="nl-kontakt">' + (kontakt ? 'Kontakte ausblenden' : 'E-Mail &amp; Handy für die Abstimmung') + '</button>' +
      '<span class="zahl nl-zahl"></span></div>';
    box.innerHTML = kopf + zeilen + fuss;
    box.dataset.kontakt = kontakt ? '1' : '';
    nlSchreiben(key);
  }

  function nlBinden(key) {
    var box = $('nl_' + key);
    if (!box) return;
    var kontaktAn = function () { return box.dataset.kontakt === '1'; };
    box.addEventListener('input', function (e) { if (e.target.closest('.nl-row')) nlSchreiben(key); });
    box.addEventListener('change', function (e) { if (e.target.closest('.nl-row')) nlSchreiben(key); });
    box.addEventListener('click', function (e) {
      var del = e.target.closest('.nl-del');
      if (del) {
        var rows = box.querySelectorAll('.nl-row[data-i]');
        if (rows.length <= 1) { del.closest('.nl-row').querySelector('.nl-name').value = ''; nlSchreiben(key); return; }
        del.closest('.nl-row').remove();
        nlNummern(box);
        nlSchreiben(key);
        return;
      }
      if (e.target.closest('.nl-add')) { nlAnhaengen(key, 1); return; }
      if (e.target.closest('.nl-add10')) { nlAnhaengen(key, 10); return; }
      if (e.target.closest('.nl-kontakt')) { nlAufbauen(key, !kontaktAn()); return; }
    });
    // Ganze Namensspalte aus Excel oder WhatsApp einfügen: eine Zeile je Person, statt alles in ein Feld
    box.addEventListener('paste', function (e) {
      var ziel = e.target.closest('.nl-name');
      if (!ziel) return;
      var txt = (e.clipboardData || window.clipboardData).getData('text') || '';
      var zeilen = txt.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean);
      if (zeilen.length < 2) return; // eine Zeile: ganz normal einfügen lassen
      e.preventDefault();
      var alt = [].map.call(box.querySelectorAll('.nl-row[data-i]'), function (r) {
        return nlZeile({ name: r.querySelector('.nl-name').value, size: nlWert(r, '.nl-size'), art: nlWert(r, '.nl-art'), mail: nlWert(r, '.nl-mail'), tel: nlWert(r, '.nl-tel'), rolle: nlWert(r, '.nl-rolle') });
      });
      var pos = +ziel.closest('.nl-row').dataset.i;
      var neu = alt.slice(0, pos).filter(Boolean).concat(zeilen).concat(alt.slice(pos + 1).filter(Boolean));
      $('v_' + key).value = neu.slice(0, 100).join('\n');
      nlAufbauen(key, kontaktAn());
    });
  }
  function nlNummern(box) {
    [].forEach.call(box.querySelectorAll('.nl-row[data-i]'), function (r, i) { r.dataset.i = i; r.querySelector('.nl-n').textContent = i + 1; });
  }
  // Leere Zeilen werden direkt in die Tabelle gehängt - über die Textarea würden sie verschwinden,
  // dort steht ja nur, wer schon eingetragen ist.
  function nlAnhaengen(key, wieviele) {
    var box = $('nl_' + key);
    for (var i = 0; i < wieviele; i++) {
      if (box.querySelectorAll('.nl-row[data-i]').length >= 100) break;
      nlZeileAnhaengen(box);
    }
    nlSchreiben(key);
    var felder = box.querySelectorAll('.nl-row[data-i] .nl-name');
    var ziel = felder[Math.max(0, felder.length - wieviele)];
    if (ziel) ziel.focus();
  }
  function nlZeileAnhaengen(box) {
    var rows = box.querySelectorAll('.nl-row[data-i]');
    var vorlage = rows[rows.length - 1];
    if (!vorlage) return;
    var neu = vorlage.cloneNode(true);
    [].forEach.call(neu.querySelectorAll('input'), function (el) { el.value = ''; });
    [].forEach.call(neu.querySelectorAll('select'), function (el) { el.selectedIndex = 0; });
    vorlage.parentNode.insertBefore(neu, box.querySelector('.nl-foot'));
    nlNummern(box);
  }

  // Vorlage zum Ausfüllen: ein fertiges Formular vom Server - Kopf mit dem Motto, durchnummerierte
  // Zeilen, Auswahllisten für Größe, Artikel und Rolle, dazu ein Blatt mit Beispiel und Hinweisen.
  // Die Spalten sind genau die, die der Upload unten wieder einliest.
  function downloadTemplate() {
    var slug = (current && current.slug) ? current.slug : 'vorlage';
    var a = document.createElement('a');
    a.href = '/api/mo/namensliste/' + encodeURIComponent(slug) + '.xlsx';
    a.rel = 'noopener';
    document.body.appendChild(a); a.click();
    setTimeout(function () { a.remove(); }, 1500);
  }
  // Fassung 77 (Ladezeit): Der Excel-Leser ist knapp ein Megabyte von einem fremden Server und
  // wurde bisher auf JEDER Mottoseite mitgeladen - gebraucht wird er nur, wenn wirklich jemand
  // eine Tabelle hochlaedt. Er kommt jetzt erst dann. Beim Klick auf "Liste hochladen" faengt
  // er schon an zu laden, waehrend der Dateidialog noch offen ist; bis die Datei gewaehlt ist,
  // ist er in aller Regel da. Und wenn er gar nicht kommt (kein Netz, Werbeblocker), sagen wir
  // das jetzt klar und nennen den Ausweg, statt "laedt noch, gleich nochmal".
  var xlsxLauf = null;
  function xlsxHolen() {
    if (window.XLSX) return Promise.resolve(true);
    if (xlsxLauf) return xlsxLauf;
    xlsxLauf = new Promise(function (fertig) {
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = function () { fertig(!!window.XLSX); };
      s.onerror = function () { xlsxLauf = null; fertig(false); };
      document.head.appendChild(s);
    });
    return xlsxLauf;
  }

  function readNames(file, cb) {
    var isCsv = /\.(csv|txt)$/i.test(file.name);
    if (isCsv) return readNamesNun(file, true, cb);
    xlsxHolen().then(function (da) {
      if (!da) { cb(null, 'Der Excel-Leser lässt sich nicht laden. Speichert die Liste als CSV – oder fügt die Namen direkt hier in das Feld ein.'); return; }
      readNamesNun(file, false, cb);
    });
  }
  function readNamesNun(file, isCsv, cb) {
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var rows;
        if (isCsv) {
          rows = String(rd.result).split(/\r?\n/).map(function (l) { return l.split(/[;,\t]/); });
        } else {
          var wb = XLSX.read(rd.result, { type: 'array' });
          rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false });
        }
        // Spalten erkennen: per Kopfzeile (Name/Größe/Artikel) oder heuristisch.
        // Die Kopfzeile muss nicht die erste Zeile sein - unsere Vorlage hat darüber einen Kopf mit
        // Motto und Anleitung. Deshalb die ersten Zeilen danach absuchen.
        var klein = function (r) { return (r || []).map(function (x) { return String(x == null ? '' : x).toLowerCase().trim(); }); };
        // In Zeile 1 genügt "Name". Weiter unten muss eine zweite Überschrift dabeistehen, sonst könnte
        // eine Datenzeile mit dem Wort "Teilnehmer" fälschlich als Kopfzeile durchgehen.
        var istKopf = function (h, erste) {
          if (!h.some(function (x) { return /^(name|namen|vorname|spieler|teilnehmer)$/.test(x); })) return false;
          return erste || h.some(function (x) { return /^(gr(ö|oe|o)?sse|größe|size|artikel|teil|produkt|e-?mail|mail|handy|telefon|mobil|rolle|funktion)$/.test(x); });
        };
        var hRow = -1;
        for (var hi = 0; hi < Math.min(rows.length, 15); hi++) { if (istKopf(klein(rows[hi]), hi === 0)) { hRow = hi; break; } }
        var head = klein(rows[hRow < 0 ? 0 : hRow]);
        var hasHead = hRow >= 0;
        if (hasHead && hRow > 0) rows = rows.slice(hRow);
        var cName = 0, cSize = -1, cGarment = -1, cEmail = -1, cPhone = -1, cRole = -1;
        var reEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, rePhone = /^(\+|00|0)?[\d\s\-()\/.]{6,}$/;
        if (hasHead) {
          head.forEach(function (h, i) {
            if (/^(e-?mail|email|mail)$/.test(h)) cEmail = i;
            else if (/handy|telefon|mobil|nummer|phone/.test(h)) cPhone = i;
            else if (/rolle|role|funktion/.test(h)) cRole = i;
            else if (/name|vorname|spieler|teilnehmer/.test(h)) cName = i;
            else if (/gr(ö|oe|o)?sse|größe|size/.test(h)) cSize = i;
            else if (/artikel|teil|shirt|kleidung|produkt/.test(h)) cGarment = i;
          });
          rows = rows.slice(1);
        } else {
          // beste Textspalte = Namen
          var best = 0; for (var c = 0; c < 6; c++) { var n = rows.filter(function (r) { return r[c] && isNaN(r[c]); }).length; if (n > best) { best = n; cName = c; } }
          // Größe/Teil/Mail/Handy/Rolle in anderen Spalten raten
          for (var c2 = 0; c2 < 8; c2++) { if (c2 === cName) continue; var vals = rows.map(function (r) { return String(r[c2] == null ? '' : r[c2]).trim(); });
            var low = vals.map(function (v) { return v.toLowerCase(); });
            if (cEmail < 0 && vals.some(function (v) { return reEmail.test(v); })) cEmail = c2;
            else if (cPhone < 0 && vals.some(function (v) { return rePhone.test(v) && (v.replace(/\D/g, '').length >= 6); })) cPhone = c2;
            else if (cRole < 0 && low.some(function (v) { return /^(orga|orga-?team|organisation|team|teilnehmer|abstimmung)$/.test(v); })) cRole = c2;
            else if (cSize < 0 && low.some(function (v) { return /^(gr\.?\s*|größe\s*|size\s*)?(xxs|xs|s|m|l|xl|xxl|2xl|3xl|xxxl|4xl|5xl|98|104|110|116|122|128|134|140|146|152|158|164|176)$/.test(v); })) cSize = c2;
            else if (cGarment < 0 && low.some(function (v) { return /hoodie|shirt|zip|jacke|pulli/.test(v); })) cGarment = c2;
          }
        }
        var col = function (r, i) { return (i >= 0 && r[i] != null && String(r[i]).trim()) ? String(r[i]).trim() : ''; };
        var list = rows.map(function (r) {
          var nm = r[cName] == null ? '' : String(r[cName]).trim();
          if (!nm) return '';
          var parts = [nm];
          [cSize, cGarment, cEmail, cPhone, cRole].forEach(function (i) { var v = col(r, i); if (v) parts.push(v); });
          return parts.join(', ');
        }).filter(Boolean);
        cb(list.slice(0, 100));
      } catch (e) { cb(null, 'Die Datei konnte nicht gelesen werden.'); }
    };
    if (isCsv) rd.readAsText(file); else rd.readAsArrayBuffer(file);
  }
  function namesOf() {
    var pf = current && current.fields.filter(function (f) { return f.personal; })[0];
    if (!pf) return [];
    return $('v_' + pf.key).value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 100);
  }
  // Kachel angetippt -> Wert in die (versteckte) Liste, change wie bisher (Merken, Abfolge, Pruefliste).
  function aufMarkieren() {
    var sel = $('v_aufteilung'); if (!sel) return;
    [].forEach.call(document.querySelectorAll('#aufteilung-wahl [data-au]'), function (k) { k.classList.toggle('on', k.getAttribute('data-au') === sel.value); });
  }
  document.addEventListener('click', function (e) {
    var k = e.target && e.target.closest ? e.target.closest('#aufteilung-wahl [data-au]') : null;
    var sel = $('v_aufteilung'); if (!k || !sel) return;
    sel.value = k.getAttribute('data-au');
    aufMarkieren();
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  function aufteilungOf() { var el = $('v_aufteilung'); return el && namesOf().length ? el.value : 'vorne'; }
  // Kleine Zeichnung Vorder- und Rueckseite fuer die Aufteilungs-Kacheln (4. Okt.): wo das Motiv sitzt
  // (Flaeche) und wo die Namen stehen (Linien).
  function aufBild(art) {
    // Shirt im Raster 0..30 (Rumpf x 8.5-20.5), Rueckseite um 32 versetzt.
    var hemd = function (x) { return '<path d="M' + (x + 6) + ' 4l5-2.5h6l5 2.5 4 5-4 3.5-2.5-2V30H' + (x + 8.5) + 'V10.5l-2.5 2-4-3.5z" fill="#fff" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>'; };
    var flaeche = function (x, y, w, h) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="1" fill="currentColor" opacity=".8"/>'; };
    var namen = function (x, y, n) { var o = ''; for (var i = 0; i < n; i++) o += '<rect x="' + x + '" y="' + (y + i * 2.6) + '" width="7" height="1.3" rx=".6" fill="currentColor"/>'; return o; };
    var vorne = art === 'brust' ? flaeche(15.5, 11.5, 3.2, 3.2) : flaeche(10.5, 11, 8, 9);
    var hinten = art === 'vorne' ? '' : art === 'brust' ? flaeche(42.5, 10, 8, 8) + namen(43, 19.5, 4) : namen(43, 11, 6);
    return '<svg class="auf-bild" viewBox="0 0 62 32" width="72" height="37" aria-hidden="true">' + hemd(0) + vorne + hemd(32) + hinten + '</svg>';
  }


  function values() {
    var v = {};
    if (current) current.fields.forEach(function (f) {
      var el = $('v_' + f.key);
      if (f.type === 'checkbox') { v[f.key] = el && el.checked ? 'ja' : ''; return; }
      if (f.type === 'upload') { v[f.key] = ''; return; }
      v[f.key] = f.personal ? namesOf().join('\n') : (el ? el.value.trim() : '');
    });
    return v;
  }
  // Fassung 25: zeigeWenn - ein Feld gilt nur, wenn die genannten Felder einen der Werte haben
  function sichtbar(f, v) {
    if (!f.zeigeWenn) return true;
    return Object.keys(f.zeigeWenn).every(function (k) { return (f.zeigeWenn[k] || []).indexOf(String(v[k] || '')) >= 0; });
  }
  // Ein Feld, das der Kunde nicht mehr sieht, darf auch nichts mehr sagen: es traegt wieder genau
  // das, was beim Aufbauen drinstand. Bei einer Kachelwahl geht auch die Markierung aus.
  function zurueckAufVorgabe(f) {
    var el = $('v_' + f.key);
    if (!el) return;
    var vorgabe = '';
    if (f.type === 'wahl') {
      vorgabe = (f.default && (f.options || []).some(function (o) { return o.key === f.default; })) ? f.default : '';
      var kbox = $('w_' + f.key);
      if (kbox) [].forEach.call(kbox.querySelectorAll('button'), function (b) {
        b.classList.toggle('on', b.getAttribute('data-w') === vorgabe);
      });
    } else if (f.type === 'select' || f.type === 'text' || f.type === 'textarea') {
      vorgabe = String(f.default || '');
    } else {
      // Haken, Datei, Namensliste: die haengen nicht an einem einfachen Wert - Finger weg.
      return;
    }
    if (el.value !== vorgabe) el.value = vorgabe;
  }

  // 19. Okt. abends, Markus: "Ich muss erst einsprechen, was geaendert werden soll, und kann gar nicht sagen, was geaendert
  // werden soll." Bei Freestyle kommt das Foto jetzt VOR dem Wunsch; liegt eins vor, fragt der Wunsch-Schritt danach, was
  // Otto am Foto aendern soll (Feld-Eigenschaft mitFoto: Titel und Hinweis), sonst wie immer "Was soll drauf?".
  function mitFotoTexte() {
    ((current && current.fields) || []).forEach(function (f) {
      if (!f.mitFoto) return;
      var box = $('f_' + f.key); if (!box) return;
      var h = box.querySelector(':scope > .hint');
      if (box.dataset.ohneFotoHint === undefined) box.dataset.ohneFotoHint = h ? h.textContent : '';
      var mit = !!fotoSitzung;
      var titel = (mit && f.mitFoto.label) || f.label, text = (mit && f.mitFoto.hint) || box.dataset.ohneFotoHint;
      var t = document.querySelector('.ab-schritt[data-schritt="feld_' + f.key + '"] .ab-titel');
      if (t && t.textContent !== titel) t.textContent = titel;
      var lab = box.querySelector(':scope > label');
      if (lab && lab.childElementCount === 0) { var soll = titel + (f.required ? '' : ' – optional'); if (lab.textContent !== soll) lab.textContent = soll; }
      if (h && h.textContent !== text) h.textContent = text;
    });
  }
  function refresh() {
    try { moodsAnpassen(); } catch (e) { /* Farbwahl ist Kuer */ }
    try { mitFotoTexte(); } catch (e) { console.warn('mitFotoTexte:', e && e.message); }
    if (!current) {
      check.innerHTML = '';
      go.textContent = 'Bitte kurz warten …';
      go.disabled = true;
      return;
    }
    var v = values();
    var items = [];
    var missing = null;
    // 1. Okt., Markus: "Wenn ich kein Foto hochlade, brauche ich nicht die Frage, wie die Menschen
    // aussehen sollen." Bei den Gruppen-Mottos gibt es die Frage nur mit Foto; ohne Foto gilt
    // wieder die Vorgabe des Mottos (der Server rechnet genauso).
    if (current.gruppenFoto && current.figurenChoice && $('f-figuren')) {
      var mitFoto = !!fotoSitzung;
      $('f-figuren').classList.toggle('hide', !mitFoto);
      if (!mitFoto && figuren !== 'standard') {
        figuren = 'standard';
        Array.prototype.forEach.call($('figuren').querySelectorAll('button'), function (x) { x.classList.toggle('on', x.getAttribute('data-fg') === 'standard'); });
      }
    }

    // 3. Okt., Markus: "wenn jemand keinen Namen ausgewaehlt hat, dann muss man ja auch nicht mehr
    // angeben, wo die Namen hin sollen". Wohin, wie und in welcher Schrift - nur mit Namen.
    if (current.fields.some(function (f) { return f.personal || f.type === 'list'; })) {
      var mitNamen = current.fields.some(function (f) {
        if (f.personal) return namesOf().length > 0;
        var t = f.type === 'list' && $('v_' + f.key);
        return !!(t && t.value.trim());
      });
      ['f_aufteilung', 'f-nameart', 'f-font'].forEach(function (id) { var el = $(id); if (el) el.classList.toggle('hide', !mitNamen); });
    }
    // Ebenso "Alle Namen auf die Rueckseite": ohne einen Namen gibt es keine Liste fuer hinten.
    if ($('f_rueckseite') && $('v_rueckseite')) {
      var nf = current.fields.filter(function (f) { return f.personal || f.type === 'list' || f.key === 'namen'; });
      var namenDa = nf.some(function (f) { return f.personal ? namesOf().length > 0 : !!String(v[f.key] || '').trim(); });
      if (nf.length) {
        $('f_rueckseite').classList.toggle('hide', !namenDa);
        if (!namenDa && $('v_rueckseite').checked) { $('v_rueckseite').checked = false; v.rueckseite = ''; }
      }
    }

    // Fehlende Pflichtfelder erst markieren, wenn der Kunde angefangen hat (nicht schon beim Öffnen der Seite)
    var touched = fieldsBox.dataset.touched === '1';
    current.fields.forEach(function (f) {
      var box = $('f_' + f.key);
      var zeigen = sichtbar(f, v);
      if (box && f.zeigeWenn) box.classList.toggle('hide', !zeigen);
      // 27. Sept. gemessen: wer an der Sehenswuerdigkeit "Meine eigenen Fotos" antippt und dann
      // doch die Hausnummer nebenan waehlt, hat die Frage nicht mehr vor sich - aber "eigene"
      // stand noch im versteckten Feld, und der Server baute eine Karte ohne den Ort. Ein Feld,
      // das nicht mehr zu sehen ist, traegt wieder seine Vorgabe. Gilt genauso fuer die Sterne,
      // wenn der Ort kein Ort zum Essen mehr ist: dann sind es keine Sterne.
      if (!zeigen && f.zeigeWenn) zurueckAufVorgabe(f);
      if (!zeigen) return;
      var ok = !f.required || (f.personal ? namesOf().length > 0 : !!v[f.key]);
      // Kundenfoto: die Datei zaehlt erst, wenn der Server sie angenommen hat
      // 3. Okt. (Markus, Hochzeit ohne Foto: "lässt er mich unten nicht weitermachen"): ein Foto,
      // ohne das es auch geht (ohneGeht, die 13 Mottos mit Figurenwahl), sperrt den Start nie.
      if (f.type === 'upload') ok = !!fotoSitzung || !!f.ohneGeht;
      if (f.required || (f.type === 'upload' && (!f.ohneGeht || fotoSitzung))) items.push([f.label, ok]);
      if (box) box.classList.toggle('miss', touched && !ok);
      if (!ok && !missing) missing = f.label;
    });
    if (current.freestyle) {
      var aok = !!current.artikelFest || !!($('v_artikel') && $('v_artikel').value);
      if (!current.artikelFest) items.push(['Artikel', aok]);
      if ($('f_artikel')) $('f_artikel').classList.toggle('miss', touched && !aok);
      if (!aok && !missing) missing = 'Artikel';
      // Textil: Breite und Hoehe muessen da sein und im erlaubten Bereich liegen
      if (aok && $('f-druckmass') && !$('f-druckmass').classList.contains('hide')) {
        var gb = parseFloat($('v_breite').value), gh = parseFloat($('v_hoehe').value);
        var gok = gb >= 3 && gb <= 45 && gh >= 3 && gh <= 45;
        items.push(['Größe in cm', gok]);
        $('f-druckmass').classList.toggle('miss', touched && !gok);
        if (!gok && !missing) missing = 'Größe in cm';
      }
    } else if ($('f-druckmass') && ($('v_breite').value || $('v_hoehe').value)) {
      // Andere Mottos: Groesse ist freiwillig - aber wenn eine Zahl drinsteht, muessen beide stimmen
      var ob = parseFloat($('v_breite').value), oh = parseFloat($('v_hoehe').value);
      var ook = ob >= 3 && ob <= 45 && oh >= 3 && oh <= 45;
      items.push(['Größe in cm', ook]);
      $('f-druckmass').classList.toggle('miss', touched && !ook);
      if (!ook && !missing) missing = 'Größe in cm (Breite und Höhe)';
    }

    if (current.upload && current.upload.mode !== 'off' && current.upload.required) {
      var uok = !!uploadId;
      items.push([current.upload.label, uok]);
      fUpload.classList.toggle('miss', touched && !uok);
      if (!uok && !missing) missing = current.upload.label;
    }

    if (logoArbeit) items.push([logoArbeit === 'nachzeichnen' ? 'Logo wird nachgezeichnet' : logoArbeit === 'upload' ? 'Bild wird hochgeladen' : 'Logo bestätigen', false]);
    check.innerHTML = items.map(function (p) {
      return '<span class="' + (p[1] ? 'done' : 'todo') + '">' + (p[1] ? '&#10003; ' : '&#9675; ') + esc(p[0]) + '</span>';
    }).join('');
    if (abfolge) abfolge.aktualisieren();

    if (app.classList.contains('busy')) return;
    // Logo noch in Arbeit: Start gesperrt, egal ob das Logo Pflicht ist oder nicht
    if (logoArbeit) {
      go.textContent = logoArbeit === 'nachzeichnen' ? 'Otto zeichnet dein Logo noch …'
        : logoArbeit === 'upload' ? 'Dein Bild wird noch hochgeladen …'
        : 'Bitte entscheide erst über dein Logo';
      go.disabled = true;
      return;
    }
    go.textContent = missing ? ('Bitte noch ausfüllen: ' + missing) : (korrekturVon ? (aenderung ? 'Änderung starten' : 'Korrektur starten') : 'Otto starten');
    go.disabled = !!missing;
  }
  // Klick auf den (gesperrten) Start-Knopf-Bereich: ab jetzt fehlende Pflichtfelder markieren
  go.parentNode.addEventListener('click', function () { if (go.disabled && current) { fieldsBox.dataset.touched = '1'; refresh(); } });

  // ---- Der laufende Auftrag, damit er einen Tabwechsel und ein Neuladen ueberlebt ----
  // Ohne das hier war der Auftrag an die geoeffnete Seite gefesselt: Handy gesperrt, kurz in
  // die Mail geschaut, Safari wirft die Seite weg - und der Kunde sitzt vor "Bild wird
  // gezeichnet", waehrend sein Design laengst fertig ist und die Mail schon raus war.
  // Die Auftragsnummer liegt darum im Browser, und beim Aufmachen fragen wir zuerst nach ihr.
  var laufJob = null, laufBudget = 0, laufUeberzogen = false;
  var LAUF_KEY = 'mo_lauf';
  function laufMerken(jobId) {
    try { localStorage.setItem(LAUF_KEY, JSON.stringify({ jobId: jobId, started: started, slug: current ? current.slug : '' })); } catch (e) { /* privates Fenster */ }
  }
  function laufVergessen() { laufJob = null; try { localStorage.removeItem(LAUF_KEY); } catch (e) { /* privates Fenster */ } }

  function stopRun() {
    runActive = false;
    laufVergessen();
    clearInterval(poll); clearInterval(tick);
    app.classList.remove('busy');
    bar.classList.add('hide'); fill.style.width = '0';
    if (rateBox) rateBox.classList.add('hide');
    var topBox = $('top'); if (topBox) topBox.classList.add('hide');
    refresh();
  }
  function fmt(ms) { var s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }

  // ---- „Keine Lust zu warten?" ----
  // Ein Design dauert Minuten. Wer nicht davor sitzen bleiben mag, hinterlegt seine
  // Adresse und macht die Seite zu - die Mail kommt, sobald das Bild fertig ist, und
  // holt das Design (auch als Gast) ueber einen Anmelde-Link ins Konto.
  var warteJob = null;
  function wartemailAnbieten(jobId, mailAn, meineMail) {
    var box = $('warte-mail');
    if (!box) return;
    warteJob = jobId;
    // Ohne eingerichteten Mailversand gar nicht erst anbieten - ein Versprechen,
    // das nicht eingeloest wird, ist schlimmer als kein Angebot.
    if (!mailAn || !jobId) { box.classList.add('hide'); return; }
    box.classList.remove('hide');
    $('warte-box').classList.add('hide');
    $('warte-auf').classList.remove('hide');
    $('warte-msg').classList.remove('gut');
    $('warte-msg').textContent = 'Dann kannst du die Seite zumachen – wir schreiben dir, sobald dein Design fertig ist.';
    $('warte-ok').disabled = false;
    $('warte-adr').disabled = false;
    $('warte-zu').classList.add('hide');
    if (meineMail) $('warte-adr').value = meineMail;
  }
  // Fenster zumachen, nachdem die Adresse hinterlegt ist. Der Auftrag laeuft weiter und die
  // Seite fragt weiter nach - wird das Design fertig, solange die Seite offen ist, erscheint
  // es wie gewohnt. Wer die Seite zumacht, bekommt die Mail. Bis zum naechsten Start bleibt
  // das Fenster zu (rateVersteckt), sonst holt es der naechste Wartescreen wieder hoch.
  var rateVersteckt = false;
  function warteZumachen() {
    rateVersteckt = true;
    if (rateBox) rateBox.classList.add('hide');
    var adr = $('warte-adr').value.trim();
    phaseZusatz = adr ? ' · Mail an ' + adr + ' ist hinterlegt, du kannst die Seite zumachen' : '';
  }
  if ($('warte-zu')) $('warte-zu').addEventListener('click', warteZumachen);
  if ($('warte-auf')) $('warte-auf').addEventListener('click', function () {
    this.classList.add('hide');
    $('warte-box').classList.remove('hide');
    $('warte-adr').focus();
  });
  function warteSenden() {
    var adr = $('warte-adr'), ok = $('warte-ok'), msg = $('warte-msg');
    var email = adr.value.trim();
    if (!warteJob) return;
    if (email.indexOf('@') < 1 || email.length < 6) { msg.classList.remove('gut'); msg.textContent = 'Das sieht noch nicht nach einer E-Mail-Adresse aus.'; return; }
    ok.disabled = true; msg.classList.remove('gut'); msg.textContent = 'Wird gespeichert …';
    fetchJson(API + '/benachrichtigen', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ jobId: warteJob, email: email }) }, 1)
      .then(function (r) {
        if (r.ok) {
          msg.classList.add('gut');
          msg.textContent = 'Alles klar – wir schreiben an ' + email + ', sobald dein Design fertig ist. Du kannst die Seite jetzt zumachen.';
          adr.disabled = true; $('warte-auf').classList.add('hide');
          $('warte-zu').classList.remove('hide');
          $('warte-zu').focus();
        } else {
          ok.disabled = false;
          msg.textContent = r.j && r.j.error === 'email ungueltig' ? 'Das sieht noch nicht nach einer E-Mail-Adresse aus.'
            : r.j && r.j.error === 'mail aus' ? 'Der Mailversand ist gerade nicht eingerichtet. Bitte lass die Seite noch kurz offen.'
            : 'Das hat gerade nicht geklappt. Bitte noch einmal tippen.';
        }
      })
      .catch(function () { ok.disabled = false; msg.textContent = 'Das hat gerade nicht geklappt. Bitte noch einmal tippen.'; });
  }
  if ($('warte-ok')) $('warte-ok').addEventListener('click', warteSenden);
  if ($('warte-adr')) $('warte-adr').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); warteSenden(); } });

  // Nur das Anmelden VOR dem Start nimmt den Zwischenstand mit (danach startet der Auftrag von selbst);
  // "Design sichern" nach einem fertigen Design startet nichts Neues.
  var gateWeiter = false;
  function showGate(title, text) {
    $('gate-title').textContent = title; $('gate-text').textContent = text;
    $('gate').classList.remove('hide');
    result.classList.remove('hide');
    $('gate').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  $('gate-send').addEventListener('click', function () {
    var email = $('gate-email').value.trim();
    $('gate-send').disabled = true;
    fetchJson(API + '/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: email, next: location.pathname + location.search, weiter: gateWeiter ? weiterDaten() : null }) }, 1)
      .then(function (r) {
        $('gate-send').disabled = false;
        // sent:false = der Server hat KEINE Mail verschickt (z. B. Mailversand nicht eingerichtet).
        // Dann darf hier nicht "Link ist unterwegs" stehen - der Kunde wartet sonst vergeblich.
        $('gate-msg').textContent = (r.ok && r.j && r.j.sent === false)
          ? 'Wir konnten gerade keine Mail verschicken. Bitte in ein paar Minuten noch einmal – und wenn es wieder passiert, schreib uns kurz (Adresse im Impressum).'
          : r.ok ? 'Link ist unterwegs – schau in dein Postfach (auch im Spam-Ordner). Danach geht es hier weiter.' : (r.j && r.j.error === 'email ungueltig' ? 'Das sieht nicht nach einer E-Mail-Adresse aus.' : 'Mail konnte gerade nicht verschickt werden. Bitte gleich noch einmal.');
      }).catch(function () { $('gate-send').disabled = false; });
  });

  // ---- „Darf mein Design bewertet werden?" ----
  // Es ist der Entwurf des Kunden. Er entscheidet, ob fremde Leute ihn zu sehen bekommen -
  // und zwar sichtbar direkt am Ergebnis, nicht versteckt in irgendwelchen Einstellungen.
  // Firmenlogos und hochgeladene Fotos sind von Haus aus draussen; wer will, schaltet sie
  // hier bewusst frei.
  function drawTeilen(b) {
    var box = $('teilen'), sw = $('teilen-an'), hint = $('teilen-hint'), msg = $('teilen-msg');
    if (!box || !shown.designId) return;
    if (!b) { box.classList.add('hide'); return; }
    box.classList.remove('hide');
    msg.textContent = ''; msg.classList.remove('gut');
    // Der Schalter zeigt den echten Zustand: was der Kunde gewaehlt hat, sonst was die Automatik tat.
    sw.checked = typeof b.wunsch === 'boolean' ? b.wunsch : !!b.freigegeben;
    sw.disabled = false;
    hint.textContent = b.wartet
      ? 'Sobald euer Fanclub-Nachweis geprüft ist, erscheint das Design bei den Community-Designs – aber nur, wenn dieser Schalter an ist.'
      : b.sperre
        ? 'Dein Design ist standardmäßig privat (' + teilenGrund(b.sperre) + '). Schalte es nur an, wenn es öffentlich bewertet werden darf.'
        : 'Andere sehen dein Motiv bei den Community-Designs und vergeben Sterne. Namenslisten, Größen und deine Daten bleiben immer draußen.';
  }
  // Aus dem technischen Grund vom Server wird hier Klartext fuer den Kunden.
  function teilenGrund(g) {
    if (/logo|foto/i.test(g)) return 'du hast ein eigenes Logo oder Foto hochgeladen';
    if (/gewerblich|B2B/i.test(g)) return 'Firmen-Design';
    if (/Namensliste|Rueckseite|Rückseite/i.test(g)) return 'es stehen Namen darauf';
    return 'eigenes Material';
  }
  if ($('teilen-an')) $('teilen-an').addEventListener('change', function () {
    var sw = this, msg = $('teilen-msg'), an = sw.checked;
    if (!shown.designId) return;
    sw.disabled = true; msg.classList.remove('gut'); msg.textContent = 'Wird gespeichert …';
    fetchJson(API + '/showcase/wunsch', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ designId: shown.designId, freigeben: an }) }, 1)
      .then(function (r) {
        sw.disabled = false;
        if (!r.ok) { sw.checked = !an; msg.textContent = 'Konnte gerade nicht gespeichert werden. Bitte noch einmal tippen.'; return; }
        sw.checked = !!r.j.wunsch;
        msg.classList.add('gut');
        msg.textContent = !r.j.wunsch
          ? 'Alles klar – dein Design bleibt privat.'
          : (r.j.wartet ? 'Notiert. Sobald der Fanclub-Nachweis geprüft ist, geht es in die Bewertung.' : 'Danke! Dein Design ist jetzt bei den Community-Designs dabei.');
      })
      .catch(function () { sw.disabled = false; sw.checked = !an; msg.textContent = 'Konnte gerade nicht gespeichert werden. Bitte noch einmal tippen.'; });
  });

  // ---- Zur Abstimmung schicken (Gruppen-Mottos mit >= 2 eigenen Designs) ----
  function refreshVoteCreate() {
    if (!current) return;
    var box = $('vote-create');
    // 1. Okt., Markus: nur wo eine Gruppe bestellt - nicht beim Shirt fuer Opa (gruppen-mottos.json)
    if (!current.gruppe) { box.classList.add('hide'); return; }
    fetch(API + '/abstimmung-designs?motto=' + encodeURIComponent(current.slug), { credentials: 'same-origin' })
      .then(function (r) { return r.json(); }).then(function (d) {
        var ds = (d && d.designs) || [];
        if (ds.length < 2) { box.classList.add('hide'); return; }
        $('vote-cands').innerHTML = ds.map(function (x, i) {
          return '<label class="vc"><input type="checkbox" class="vc-pick" value="' + esc(x.designId) + '" checked><img src="' + esc(x.img) + '" alt="Design ' + (i + 1) + '"><span>Design ' + (i + 1) + ' · ' + esc(x.style) + '</span></label>';
        }).join('');
        box.classList.remove('hide');
      }).catch(function () { });
  }
  function pickedDesigns() { return Array.prototype.map.call($('vote-cands').querySelectorAll('.vc-pick:checked'), function (c) { return c.value; }); }
  function showVoteStatus(j) {
    var box = $('vote-status'); box.classList.remove('hide');
    var waText = 'Abstimmung für unser ' + (current.name || current.slug) + '-Shirt! Jetzt abstimmen: ' + j.gruppenLink;
    var wa = 'https://wa.me/?text=' + encodeURIComponent(waText);
    box.innerHTML = '<div class="intro"><b style="color:var(--ink)">Abstimmung läuft</b>' +
      '<p style="margin:4px 0 10px">Geht an ' + j.teilnehmer + ' Teilnehmer, Ergebnis an ' + j.orgaEmpfaenger + ' Orga-Adresse(n).</p>' +
      '<a class="go" style="background:#25d366;color:#fff;display:block;text-align:center;text-decoration:none" href="' + wa + '" target="_blank" rel="noopener">In WhatsApp teilen</a>' +
      // Fassung 74 (Markus, 17. Sept.): WhatsApp laesst beim direkten Teilen hoechstens fuenf
      // Chats auswaehlen - fuer eine Stufe oder eine Mannschaft reicht das nicht. Vorher sagen,
      // nicht hinterher.
      '<p class="hint" style="margin:8px 0 0">WhatsApp lässt beim direkten Teilen höchstens <b>fünf Chats</b> auswählen. Ab fünf Leuten lohnt sich eine Gruppe: Gruppe anlegen, Link hier kopieren und dort einfügen.</p>' +
      '<button type="button" class="go" id="vs-copy" style="margin-top:8px;background:var(--card2);color:var(--ink);border:1px solid var(--line)">Gruppen-Link kopieren</button>' +
      '<a class="go" style="margin-top:8px;background:var(--card2);color:var(--ink);border:1px solid var(--line);display:block;text-align:center;text-decoration:none" href="' + esc(j.orgaLink) + '" target="_blank" rel="noopener">Übersicht (erinnern / beenden)</a></div>';
    $('vs-copy').onclick = function () { (navigator.clipboard && navigator.clipboard.writeText(j.gruppenLink) || Promise.reject()).then(function () { $('vs-copy').textContent = 'Kopiert ✓'; }, function () { prompt('Link kopieren:', j.gruppenLink); }); };
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  $('vote-start').addEventListener('click', function () {
    var ids = pickedDesigns();
    if (ids.length < 2) { $('vote-status').classList.remove('hide'); $('vote-status').innerHTML = '<p class="hint">Bitte mindestens 2 Designs auswählen.</p>'; return; }
    var channels = []; if ($('ch-gruppe').checked) channels.push('gruppe'); if ($('ch-mail').checked) channels.push('mail');
    var days = +$('vote-days').value || 3;
    var btn = $('vote-start'); btn.disabled = true;
    fetchJson(API + '/abstimmung', { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ motto: current.slug, designIds: ids, days: days, channels: channels }) }, 1)
      .then(function (r) {
        btn.disabled = false;
        if (!r.ok) { $('vote-status').classList.remove('hide'); $('vote-status').innerHTML = '<p class="hint">' + esc((r.j && r.j.error) || 'Das hat nicht geklappt.') + '</p>'; return; }
        showVoteStatus(r.j);
      }).catch(function () { btn.disabled = false; });
  });

  $('again').addEventListener('click', function () {
    if (app.classList.contains('busy')) return;
    refresh();
    if (go.disabled) { go.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    go.scrollIntoView({ behavior: 'smooth', block: 'center' });
    go.click();
  });

  // ---- Bewerten, während das Design entsteht (hält die Leute auf der Seite, liefert Content) ----
  var rateBox = $('rate'), rateImg = $('rate-img'), rateMotto = $('rate-motto'), rateStars = $('rate-stars'), rateSkip = $('rate-skip'), rateDone = $('rate-done'), rateH = $('rate-h'), rateBurst = $('rate-burst'), rateMute = $('rate-mute');
  var RATE_H_DEFAULT = rateH ? rateH.textContent : '';
  var ratePool = [], rateIdx = 0, rateBusy = false, rateCount = 0, runActive = false;
  // Jedes Design nur einmal bewerten – sitzungsübergreifend gemerkt (Server sperrt zusätzlich).
  var rated = (function () { try { return JSON.parse(localStorage.mo_rated || '[]'); } catch (e) { return []; } })();
  function saveRated() { try { localStorage.mo_rated = JSON.stringify(rated.slice(-800)); } catch (e) { } }
  var muted = (function () { try { return localStorage.mo_mute === '1'; } catch (e) { return false; } })();
  if (rateMute) { rateMute.textContent = muted ? '🔇' : '🔊'; rateMute.addEventListener('click', function () { muted = !muted; try { localStorage.mo_mute = muted ? '1' : '0'; } catch (e) { } rateMute.textContent = muted ? '🔇' : '🔊'; }); }

  // Dezenter Chime über WebAudio (kein Asset, CSP-sicher); Tonhöhe steigt mit der Sternzahl.
  var AC = null;
  function chime(stars) {
    if (muted) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      if (AC.state === 'suspended') AC.resume();
      var t = AC.currentTime, base = 380 + stars * 80;
      [0, 0.10].forEach(function (dt, i) {
        var o = AC.createOscillator(), g = AC.createGain();
        o.type = 'triangle'; o.frequency.value = i ? base * 1.5 : base;
        g.gain.setValueAtTime(0.0001, t + dt);
        g.gain.exponentialRampToValueAtTime(0.16, t + dt + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.3);
        o.connect(g); g.connect(AC.destination); o.start(t + dt); o.stop(t + dt + 0.32);
      });
    } catch (e) { }
  }
  function burst() {
    if (!rateBurst) return;
    rateBurst.textContent = ['✨', '🎉', '⭐', '💫', '🔥'][Math.floor(Math.random() * 5)];
    rateBurst.classList.remove('go'); void rateBurst.offsetWidth; rateBurst.classList.add('go');
  }
  function markStars(n) { if (rateStars) [].forEach.call(rateStars.querySelectorAll('button'), function (b) { b.classList.toggle('on', +b.getAttribute('data-s') <= n); }); }
  function resetCard() {
    if (rateStars) rateStars.style.display = '';
    if (rateSkip) rateSkip.style.display = '';
    if (rateImg) { rateImg.style.display = ''; rateImg.parentNode.style.display = ''; }
    if (rateMotto) rateMotto.style.display = '';
    if (rateH) rateH.textContent = RATE_H_DEFAULT;
  }
  function firstUnrated() {
    for (var k = 0; k < ratePool.length; k++) { var i = (rateIdx + k) % ratePool.length; if (rated.indexOf(ratePool[i].designId) < 0) { rateIdx = i; return ratePool[i]; } }
    return null;
  }
  var PROD_TEASER = 'Dein Motiv gibt’s später auch auf 👕 Shirt · Hoodie · ☕ Tasse · 🛋️ Kissen · 🖼️ Poster · 👜 Beutel & mehr.';
  // Verbotene Zeichen und Parolen. Bewusst knapp und ohne Belehrung: das gesperrte Wort wird
  // NICHT wiederholt (sonst steht es am Ende doch auf dem Bildschirm), und es gibt keinen
  // Hinweis darauf, WAS genau gegriffen hat - sonst ist die Meldung eine Anleitung zum Umgehen.
  var VERBOTEN_TEXT = 'Das können wir nicht drucken. Verfassungsfeindliche Zeichen und Parolen sind in Deutschland strafbar – auch auf Kleidung. Bitte nimm einen anderen Text oder ein anderes Motiv.';
  function showExhausted() {
    if (rateStars) rateStars.style.display = 'none';
    if (rateSkip) rateSkip.style.display = 'none';
    if (rateImg) { rateImg.style.display = 'none'; rateImg.parentNode.style.display = 'none'; }   // mit dem Bild auch die Stil-Plakette darauf (6. Okt.: lag sonst ueber dem Text)
    if (rateMotto) rateMotto.style.display = 'none';
    if (rateH) rateH.textContent = 'Danke fürs Bewerten! 🎉 Dein Design ist gleich fertig.';
    if (rateDone) rateDone.textContent = PROD_TEASER;
  }
  // Wartescreen ohne Designs zum Bewerten: Overlay bleibt sichtbar, nur ohne Sterne.
  function showWaiting() {
    if (!rateBox) return;
    if (!rateVersteckt) rateBox.classList.remove('hide');
    rateBox.removeAttribute('data-id');
    if (rateStars) rateStars.style.display = 'none';
    if (rateSkip) rateSkip.style.display = 'none';
    if (rateImg) { rateImg.style.display = 'none'; rateImg.parentNode.style.display = 'none'; }   // mit dem Bild auch die Stil-Plakette darauf (6. Okt.: lag sonst ueber dem Text)
    if (rateMotto) rateMotto.style.display = 'none';
    if (rateH) rateH.textContent = 'Gleich geht’s los – dein Design wird gezeichnet. Bald kannst du hier Designs der Community bewerten.';
    if (rateDone) rateDone.textContent = PROD_TEASER;
  }
  function showRate() {
    if (!rateBox) return;
    if (!ratePool.length) { showWaiting(); return; }
    if (!rateVersteckt) rateBox.classList.remove('hide');
    var d = firstUnrated();
    if (!d) { showExhausted(); return; }
    resetCard();
    rateBox.setAttribute('data-id', d.designId);
    rateImg.src = d.image; rateMotto.textContent = d.motto || '';
    var stilEl = $('rate-stil');
    // Nur der Name - das Wort "Stil" steht als CSS-Vorsatz davor, damit der Name betont bleibt
    if (stilEl) stilEl.textContent = d.stil || '';
    if (rateDone) rateDone.textContent = '';
    markStars(0);
  }
  function nextRate() { if (!ratePool.length) { showWaiting(); return; } rateIdx = (rateIdx + 1) % ratePool.length; showRate(); }
  function startRating() {
    if (!rateBox) return;
    rateCount = 0; rateIdx = 0;
    rateVersteckt = false; phaseZusatz = '';
    // Neuer Lauf: das Mail-Angebot erst wieder zeigen, wenn der Server die neue Auftragsnummer
    // geschickt hat - sonst stuende hier noch die Bestaetigung vom vorigen Design.
    if ($('warte-mail')) $('warte-mail').classList.add('hide');
    showWaiting(); // sofort ein Wartescreen, damit IMMER etwas erscheint
    fetchJson(API + '/showcase?mode=rate', undefined, 1).then(function (r) {
      if (!runActive) { rateBox.classList.add('hide'); return; } // Generierung schon fertig -> Overlay nicht mehr zeigen
      ratePool = ((r.j && r.j.designs) || []).filter(function (d) { return rated.indexOf(d.designId) < 0; });
      if (ratePool.length) showRate(); else showWaiting();
    }).catch(function () { if (runActive) showWaiting(); });
  }
  if (rateStars) {
    [].forEach.call(rateStars.querySelectorAll('button'), function (b) {
      b.addEventListener('mouseenter', function () { markStars(+b.getAttribute('data-s')); });
      b.addEventListener('click', function () {
        if (rateBusy) return; rateBusy = true;
        var id = rateBox.getAttribute('data-id'), stars = +b.getAttribute('data-s');
        markStars(stars); b.classList.add('hit'); setTimeout(function () { b.classList.remove('hit'); }, 420);
        chime(stars); burst();
        if (rated.indexOf(id) < 0) { rated.push(id); saveRated(); }
        fetchJson(API + '/rate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ designId: id, stars: stars }) }, 1)
          .then(function (rr) {
            rateBusy = false; rateCount++;
            var c = rr && rr.j && rr.j.count, a = rr && rr.j && rr.j.avg;
            // Live-Wert zeigen, damit man sieht, dass die Bewertung zählt
            if (rateDone) rateDone.textContent = c ? ('Danke! Dieses Design: ⭐ ' + a + ' · ' + c + (c === 1 ? ' Bewertung' : ' Bewertungen')) : ('Danke! Schon ' + rateCount + ' bewertet ✨');
            setTimeout(nextRate, 950);
          })
          .catch(function () { rateBusy = false; setTimeout(nextRate, 750); });
      });
    });
    rateStars.addEventListener('mouseleave', function () { markStars(0); });
  }
  if (rateSkip) rateSkip.addEventListener('click', nextRate);

  // ---- Beliebteste Designs (bestbewertete) ----
  function loadTop() {
    var box = $('top'), grid = $('top-grid'); if (!box || !grid) return;
    fetchJson(API + '/showcase?mode=top&limit=6', undefined, 1).then(function (r) {
      var ds = (r.j && r.j.designs) || [];
      if (!ds.length) { box.classList.add('hide'); return; }
      grid.innerHTML = ds.map(function (d) {
        var st = d.count ? ('★ ' + Number(d.avg).toFixed(1) + ' · ' + d.count) : '';
        if (d.stil) st = st ? (st + ' · ' + d.stil) : d.stil;
        return '<div class="top-card"><img src="' + esc(d.image) + '" loading="lazy" alt=""><div class="m"><b>' + esc(d.motto || '') + '</b><br>' + esc(st) + '</div></div>';
      }).join('');
      if (runActive) box.classList.remove('hide');
    }).catch(function (e) { if (window.console) console.warn('Beliebteste Designs:', e && e.message ? e.message : e); });
  }

  // Die Uhr auf dem Wartescreen - laeuft beim ersten Start und genauso nach dem Wiederaufnehmen
  function uhrSchlag() {
    var el = Date.now() - started;
    fill.style.width = Math.min(95, el / 900) + '%';
    say(phase + ' … ' + fmt(el) + phaseZusatz);
    var rp = $('rate-progress'); if (rp) rp.textContent = phase + ' · ' + fmt(el);
  }

  // ---- Der Takt, der nach dem Auftrag fragt ----
  // Frueher steckte das komplett im setInterval. Auf dem Handy ist das zu wenig: iOS haelt
  // Timer in einem Tab an, der nicht sichtbar ist, und wirft die Seite bei Speicherdruck ganz
  // weg. Genau das ist passiert - das Design war fertig, die Mail war raus, und die Seite
  // zeigte immer noch "Bild wird gezeichnet". Darum hat der Takt jetzt einen Namen: er laeuft
  // im Intervall UND sofort, sobald die Seite wieder sichtbar wird.
  function laufTakt() {
      // Frist überschritten: NICHT aufhören zu fragen. Der Auftrag läuft weiter, und wenn
      // er fertig wird, während die Seite offen ist, soll der Kunde sein Design auch sehen.
      // Vorher hat die Seite hier abgeschaltet – das Design kam an, aber nur ins Backend.
      if (!laufUeberzogen && Date.now() - started > laufBudget) {
        laufUeberzogen = true;
        bar.classList.add('hide');
        say('Das dauert heute ungewöhnlich lange. Dein Design wird weiter gezeichnet – lass die Seite offen, dann erscheint es hier. Du findest es in jedem Fall in deinem Konto.', true);
        // Wer die Seite doch zumachen will, soll jetzt erst recht die Mail bekommen können
        if ($('warte-mail') && !$('warte-mail').classList.contains('hide')) {
          $('warte-box').classList.remove('hide');
          $('warte-auf').classList.add('hide');
        }
      }
      // Irgendwann ist wirklich Schluss mit Fragen - sonst pollt eine offene Seite endlos.
      if (Date.now() - started > laufBudget + 15 * 60000) {
        stopRun();
        say('Dein Design wird noch gezeichnet, aber wir hören hier auf zu warten. Du findest es in deinem Konto, sobald es fertig ist.', true);
        return;
      }
      fetchJson(API + '/job/' + laufJob, undefined, 1).then(function (rr) {
        var s = rr.j || {};
        // Auftrag dem Dienst unbekannt (z. B. nach einer Aktualisierung): nicht 6 Minuten warten, sondern einmal automatisch neu starten
        if (rr.status === 404) {
          stopRun();
          if (retryBudget > 0) { retryBudget--; isAutoRetry = true; say('Der Dienst wurde gerade aktualisiert – wir starten dein Design automatisch neu …'); setTimeout(function () { go.disabled = false; go.click(); }, 2000); }
          else say('Der Dienst wurde gerade aktualisiert. Bitte noch einmal starten.', true);
          return;
        }
        if (s.status === 'running') phase = (current && current.research) ? 'Motto wird recherchiert, Bild wird gezeichnet' : 'Bild wird gezeichnet';
        if (s.status === 'done') {
          stopRun(); say('Fertig.');
          shown.preview = s.preview; shown.mockups = s.mockups || null; shown.artikel = s.artikel || null; shown.tab = startReiter(s);
          shown.back = s.back || null;
          shown.names = s.names || []; shown.people = s.people || []; shown.aufteilung = s.aufteilung || 'vorne'; shown.n = 0; shown.designId = s.designId; shown.sig = s.sig || null;
          shown.color = hellerStoff(s.textile) ? 'white' : 'black';
          kfWahl = ''; // neues Design, neue Entscheidung
          drawNames();
          drawResult();
          result.classList.remove('hide');
          // Fassung 24-26: Freestyle - dpi-Hinweis zum Artikel und der Foto-Knopf
          // 28. Sept., Markus (Screenshot "225 dpi - unter 300 ... meist vertretbar"): "Wir sagen
          // selber, dass wir keine gute Qualitaet koennen. Das passt da nicht hin." Der dpi-Hinweis
          // steht dem Kunden nicht mehr auf der Ergebnisseite. Er bleibt im Auftrag (artikel.warnung)
          // und im Backend unter der Karte - dort gehoert er hin, fuer uns vor dem Druck.
          fotoKnopf(s);
          // Fassung 31: gewerbliches Motto - "Braucht ihr das fuer die ganze Firma?" mit Sprung in den Firmenbereich
          if (current && current.firmenFrage && shown.designId) {
            $('firma-ja').href = '/firma?design=' + encodeURIComponent(shown.designId);
            $('firma-frage').classList.remove('hide');
          } else { $('firma-frage').classList.add('hide'); }
          // Fanclub: Hinweis + Nachweis-Upload einblenden (Druck erst nach Freigabe)
          if (current && current.requiresApproval) { $('fc-nr').textContent = shown.designId; $('fanclub-gate').classList.remove('hide'); $('fc-msg').textContent = '… oder lade den Nachweis direkt hier hoch.'; }
          else { $('fanclub-gate').classList.add('hide'); }
          drawTeilen(s.bewertung);
          refreshVoteCreate();
          fetch(API + '/me', { credentials: 'same-origin' }).then(function (x) { return x.json(); }).then(function (me) {
            if (me.accounts && !me.user) showGate('Design sichern', 'Melde dich mit deiner E-Mail an – ganz ohne Passwort. Dann findest du dieses und alle weiteren Designs jederzeit in deinem Konto wieder. Die ersten fünf Designs sind kostenfrei.');
          }).catch(function () { });
          result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else if (s.status === 'qa_failed') {
          stopRun();
          // Bei einem geschuetzten Zeichen haengt der richtige Rat davon ab, woher es kommt:
          // stand es in der Eingabe, hilft nur ein anderer Begriff. Hat Otto es selbst gemalt,
          // ist ein neuer Lauf genau das Richtige - jeder Lauf sieht anders aus.
          if (s.hint === 'verboten') {
            // Otto hat von sich aus etwas Verbotenes gemalt (kommt vor, wenn das Motto in die
            // Naehe von Geschichte oder Militaer geht). Kein Vorwurf an den Kunden - aber auch
            // kein stilles Weitermachen: der Versuch ist weg, ein neuer sieht anders aus.
            say('Dieser Entwurf enthielt ein Zeichen, das wir nicht drucken dürfen – er wurde verworfen. Bitte noch einmal starten, jeder Lauf sieht anders aus. Bleibt es dabei, nimm ein anderes Motiv.', true);
          } else if (s.hint === 'marke') {
            // Der Treffer kommt normalisiert (klein) zurueck - fuer den Kunden gross geschrieben
            var wort = s.marke ? '„' + String(s.marke).replace(/(^|\s)(\S)/g, function (_, a, c) { return a + c.toUpperCase(); }) + '“' : '';
            say(s.markeAusEingabe
              ? (wort ? wort + ' ist ein geschützter Name' : 'Einer eurer Begriffe ist geschützt') +
                ' und darf so nicht aufs Textil. Bitte nehmt einen anderen Begriff – zum Beispiel euren Ort, eure Farben oder einen eigenen Spruch. Mit demselben Wort wird auch der nächste Versuch gesperrt.'
              : 'Otto hat ' + (wort ? wort + ' ' : 'ein geschütztes Zeichen ') + 'ins Motiv gezeichnet – so drucken wir nicht. Bitte noch einmal starten, jeder Lauf sieht anders aus.', true);
            if (current && current.freestyle && s.markeAusEingabe) markeFrage(s.marke ? String(s.marke) : '', '');
          } else {
            say('Dieser Versuch ist nicht sauber geworden. Probier es noch einmal – jeder Lauf sieht anders aus.', true);
          }
        } else if (s.status === 'error') {
          stopRun();
          // Kurzer Aussetzer (Bilddienst nicht erreichbar): einmal automatisch neu starten.
          // Bei 'timeout' NICHT: eine Zeitüberschreitung heißt, dass lange gezeichnet wurde,
          // und ein zweiter Auftrag verdoppelt nur die Last. Genau daraus entstanden mehrere
          // fertige Designs im Backend, von denen der Kunde keins zu sehen bekam.
          if (s.hint !== 'refused' && s.hint !== 'timeout' && retryBudget > 0) { retryBudget--; isAutoRetry = true; say('Kurzer Aussetzer – wir versuchen es automatisch noch einmal …'); setTimeout(function () { go.disabled = false; go.click(); }, 1500); return; }
          say(s.hint === 'refused' ? 'Der Bilddienst hat dieses Motiv abgelehnt. Bitte Spruch oder Motiv leicht ändern und noch einmal starten.' : s.hint === 'unreachable' ? 'Unser Bilddienst ist gerade nicht erreichbar – das liegt nicht an dir. Bitte in ein paar Minuten noch einmal starten.' + (s.error && s.error.indexOf('Meldung:') >= 0 ? ' (' + s.error.slice(s.error.indexOf('Meldung:')) + ')' : '') : ((s.hint === 'korrektur' || s.hint === 'foto') && s.error) ? s.error : (s.hint === 'timeout' ? 'Das hat heute zu lange gedauert. Starte es bitte noch einmal – wir starten nichts von allein, damit nicht doppelt gezeichnet wird.' : 'Beim Zeichnen ist etwas schiefgegangen. Bitte noch einmal versuchen.'), true);
        }
      }).catch(function () { });
  }

  // Wartescreen wieder aufbauen und weiterfragen - nach einem Neuladen oder wenn die Seite
  // aus dem Speicher geflogen ist. Der Auftrag laeuft auf dem Server ohnehin weiter.
  // 21. Sept., 08:05, Markus: "bricht ab ohne Hinweis." Live nachgestellt (Neuladen
  // 40 s nach dem Start, wie Safari es im Hintergrund tut): der Auftrag lief weiter, Balken und
  // Status waren da - aber im LETZTEN Schritt der Abfolge, und die Seite stand auf Schritt 1.
  // Der Kunde sah "Dein Selfie" und nichts von seinem Auftrag. Deshalb: laeuft ein Auftrag,
  // springt die Abfolge auf den letzten Schritt, wo Balken und Status stehen.
  function zumWartescreen() {
    if (abfolge && abfolge.schritte && abfolge.schritte.length) abfolge.zeige(abfolge.schritte.length - 1, true, true, true);
  }
  function warteWeiter(jobId, startZeit) {
    started = startZeit;
    laufJob = jobId;
    laufBudget = 20 * 60000;   // maxMs kennen wir nach dem Neuladen nicht mehr - grosszuegig warten
    laufUeberzogen = false;
    runActive = true;
    zumWartescreen();
    app.classList.add('busy');
    go.disabled = true;
    go.textContent = 'Dein Design entsteht …';
    result.classList.add('hide');
    bar.classList.remove('hide');
    phase = 'Bild wird gezeichnet';
    clearInterval(tick); clearInterval(poll);
    uhrSchlag();
    tick = setInterval(uhrSchlag, 500);
    poll = setInterval(laufTakt, 3000);
    loadTop();
    laufTakt();
  }

  // Beim Aufmachen der Seite zuerst fragen: laeuft da noch ein Auftrag von vorhin?
  function laufAufnehmen() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(LAUF_KEY) || 'null'); } catch (e) { s = null; }
    if (!s || !s.jobId || !s.started) return;
    if (Date.now() - s.started > 45 * 60000) { laufVergessen(); return; }
    fetchJson(API + '/job/' + s.jobId, undefined, 1).then(function (rr) {
      var st = (rr.j && rr.j.status) || '';
      if (rr.status === 404 || !st) { laufVergessen(); return; }
      // Fertig: sofort zeigen, ohne den Umweg ueber den Wartescreen.
      // 2. Okt. (Partner-Test): ohne zumWartescreen() lag das fertige Ergebnis hinter Schritt 1 der Abfolge.
      if (st === 'done') { started = s.started; laufJob = s.jobId; runActive = true; zumWartescreen(); laufTakt(); return; }
      // Schiefgegangen: nach einem Neuladen nicht von allein neu starten - der Kunde entscheidet.
      if (st !== 'queued' && st !== 'running') { laufVergessen(); return; }
      warteWeiter(s.jobId, s.started);
    }).catch(function () { /* offline - beim naechsten Mal wieder */ });
  }

  // Zurueck auf der Seite? Sofort fragen, nicht erst beim naechsten Intervall. iOS haelt
  // Timer im Hintergrund an, und ohne das hier stand der Zaehler still, waehrend das
  // Design laengst fertig war.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    if (runActive && laufJob) laufTakt(); else laufAufnehmen();
    fassungPruefen();
  });
  window.addEventListener('pageshow', function (ev) {
    if (ev && ev.persisted && !runActive) laufAufnehmen();
    if (ev && ev.persisted) fassungPruefen();
  });
  // 27. Sept., Markus, kurz nach einem Deploy: Funktionen fehlten. Live nachgestellt: alles
  // da. Sein Reiter war seit VOR dem Deploy offen und lief mit dem alten Skript. Deshalb: wer auf
  // die Seite zurueckkommt, fragt den Server nach der Fassung. Ist sie neu und hier noch nichts
  // angefangen (kein Foto, kein Lauf, keine Karte), laedt die Seite sich selbst neu. Sonst nur
  // ein Hinweis mit Knopf - niemandem wird seine Eingabe unter den Fingern weggezogen.
  var fassungZuletzt = 0;
  function fassungEigene() {
    var sk = document.querySelector('script[src*="motto-seite.js?v="]');
    var m = sk && /[?&]v=([^&]+)/.exec(sk.getAttribute('src') || '');
    return m ? m[1] : '';
  }
  function fassungPruefen() {
    var eigene = fassungEigene(); if (!eigene) return;
    if (Date.now() - fassungZuletzt < 60000) return;
    fassungZuletzt = Date.now();
    fetchJson(API + '/fassung', { cache: 'no-store' }, 1).then(function (r) {
      if (!r.ok || !r.j || !r.j.v || r.j.v === eigene) return;
      var angefangen = !!(fotoSitzung || runActive || shown.designId || (fieldsBox && fieldsBox.dataset.touched === '1'));
      if (!angefangen) { location.reload(); return; }
      var h = $('neue-fassung'); if (!h) return;
      h.classList.remove('hide');
    });
  }
  if ($('neue-fassung-btn')) $('neue-fassung-btn').addEventListener('click', function () { location.reload(); });

  // Auto-Retry: pro manuellem Klick genau EIN automatischer Neustart bei vorübergehenden Aussetzern
  var retryBudget = 1, isAutoRetry = false;
  go.addEventListener('click', function () {
    if (!current || go.disabled) return;
    if ($('wunsch-foto')) $('wunsch-foto').remove();
    if (logoArbeit) { say(logoArbeit === 'nachzeichnen' ? 'Otto zeichnet dein Logo noch – gleich kannst du starten.' : logoArbeit === 'upload' ? 'Dein Bild wird noch hochgeladen.' : 'Bitte entscheide erst über dein Logo.', true); refresh(); return; }
    if (!isAutoRetry) retryBudget = 1;
    isAutoRetry = false;
    clearInterval(poll); clearInterval(tick);
    app.classList.add('busy');
    go.disabled = true;
    go.textContent = 'Dein Design entsteht …';
    result.classList.add('hide');
    bar.classList.remove('hide');
    runActive = true;
    startRating();
    started = Date.now();
    phase = 'Auftrag wird angenommen';
    tick = setInterval(function () {
      uhrSchlag();
    }, 500);

    fetchJson(API + '/generate', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ motto: current.slug, values: values(), names: namesOf(), aufteilung: aufteilungOf(), uploadId: uploadId, uploadId2: uploadId2, textile: textile, style: style, mood: mood, placement: placement, nameFont: nameFont, nameArt: nameArt, logoArt: logoArt, figuren: figuren, colors: ($('v_colors') ? $('v_colors').value.trim() : ''),
        artikelId: current.artikelFest || ($('v_artikel') ? $('v_artikel').value : '') || current.artikelLink || '', flaeche: $('v_flaeche') ? $('v_flaeche').value : '', fotoSitzung: fotoSitzung || '',
        breiteCm: $('v_breite') && $('f-druckmass') && !$('f-druckmass').classList.contains('hide') ? $('v_breite').value : '', hoeheCm: $('v_hoehe') && $('f-druckmass') && !$('f-druckmass').classList.contains('hide') ? $('v_hoehe').value : '',
        druckSeite: $('f-druckmass') && !$('f-druckmass').classList.contains('hide') && document.querySelector('#groesse-vorschlaege .s.on[data-seite="ruecken"]') ? 'ruecken' : '',
        korrekturVon: korrekturVon || '', aenderung: (korrekturVon && aenderung) || '' })
    }, 1).then(function (r) {
      var j = r.j || {};
      if (r.ok && j.jobId) { korrekturVon = null; aenderung = ''; if ($('aendern-text')) $('aendern-text').value = ''; }
      if (r.ok && j.jobId && j.bereinigt && j.bereinigt.length) {
        var parts = j.bereinigt.map(function (c) { return c.nachher ? ('„' + c.vorher + '" → „' + c.nachher + '"') : ('„' + c.vorher + '" weggelassen'); });
        $('cleanup').textContent = 'Kleiner Hinweis: Diese Zeichen können wir so nicht setzen, darum haben wir angepasst: ' + parts.join(' · ');
        $('cleanup').classList.remove('hide');
      } else if (r.ok) { $('cleanup').classList.add('hide'); }
      if (!r.ok || !j.jobId) {
        stopRun();
        var m = 'Das hat nicht geklappt. Bitte noch einmal versuchen.';
        if (j.error === 'anmelden') { weiterMerken(); gateWeiter = true; showGate('Bitte kurz anmelden', 'Dein erstes Design gab es ohne Anmeldung. Für die nächsten – die ersten fünf sind kostenfrei – meldest du dich einmal mit deiner E-Mail an, ganz ohne Passwort. Deine Eingaben bleiben erhalten, nach dem Anmelden geht es automatisch weiter.'); say('Bitte zuerst anmelden – siehe unten.', true); return; }
        if (j.error === 'bezahlen') { say('Deine kostenfreien Designs sind aufgebraucht.', true); location.href = '/konto'; return; }
        if (j.error === 'verboten') m = VERBOTEN_TEXT;
        else if (j.error === 'marke') { markeFrage(j.wort || j.eingabe || '', j.eingabe || ''); return; }
        else if (j.error === 'tageslimit') m = 'Für heute ist das Kontingent aufgebraucht. Morgen geht es weiter.';
        else if (j.error === 'ausgelastet') m = 'Gerade ist so viel los, dass die Wartezeit über eine Stunde wäre' + (j.wartenSek ? ' (ca. ' + Math.round(j.wartenSek / 60) + ' Min.)' : '') + '. Wir nehmen deinen Auftrag dann lieber gleich richtig an – bitte in ein paar Minuten noch einmal.';
        else if (j.error === 'feld fehlt') {
          m = 'Es fehlt noch: ' + (j.feld || 'ein Feld');
          // In der Abfolge: direkt zu dem Schritt, in dem das Feld steht - alles andere bleibt,
          // wie es war (Markus, 20. Sept.: "man muss ja von vorne anfangen - das killt jeden Prozess").
          if (abfolge && j.feld) {
            var fehlF = (current.fields || []).filter(function (f) { return f.label === j.feld || f.key === j.feld; })[0];
            if (fehlF) {
              for (var si = 0; si < abfolge.schritte.length; si++) {
                if ((abfolge.schritte[si].felder || []).indexOf(fehlF.key) >= 0) { abfolge.zeige(si); m = 'Es fehlt noch: ' + j.feld + ' – hier eintragen, dann geht es weiter.'; break; }
              }
            }
          }
        }
        else if (j.error === 'zeichen nicht erlaubt') m = 'In „' + (j.feld || 'einem Feld') + '" stehen Zeichen, die wir nicht drucken können.';
        else if (j.error === 'auswahl ungueltig') m = 'Bitte bei „' + (j.feld || 'der Auswahl') + '" etwas aus der Liste wählen.';
        else if (j.error === 'upload fehlt') m = 'Für dieses Motto brauchen wir noch dein Bild.';
        else if (j.error === 'logo wird nachgezeichnet') m = j.hinweis || 'Otto zeichnet dein Logo gerade noch nach. Bitte warte, bis du es bestätigen kannst.';
        else if (j.error === 'logo unbrauchbar') m = (j.quelle === 'firma' ? 'Das am Firmenkonto hinterlegte Logo ist so nicht druckbar: ' : 'Dieses Logo ist so nicht druckbar: ') + ((j.gruende || []).join(' ')) + (j.quelle === 'firma' ? ' Bitte im Firmenbereich ein neues Logo hochladen (PNG, SVG oder PDF, mindestens 700 Pixel breit) oder hier ein anderes Logo wählen.' : ' Bitte ein anderes Logo hochladen oder Otto nachzeichnen lassen.');
        else if (j.error === 'upload nicht gefunden') { m = 'Das Bild ist verloren gegangen. Bitte noch einmal hochladen.'; logoVergessen(); uploadId = null; thumb.classList.add('hide'); drop.classList.remove('hide'); }
        else if (j.error === 'artikel fehlt') m = 'Bitte wähle zuerst den Artikel, auf den es soll.';
        else if (j.error === 'flaeche fehlt') m = 'Bitte wähle die Fläche oder Variante des Artikels.';
        else if (j.error === 'groesse ungueltig') m = j.hinweis || 'Bitte Breite und Höhe in Zentimetern angeben (3 bis 45 cm).';
        else if (j.error === 'korrektur unbekannt') { m = 'Das Design für die Korrektur ist nicht mehr da. Bitte normal neu starten.'; korrekturVon = null; refresh(); }
        else if (j.error === 'foto fehlt') { m = j.hinweis || 'Bitte lade dein Foto hoch.'; fotoSitzung = null; refresh(); }
        else if (j.error === 'foto zu klein') m = j.hinweis || 'Das Foto reicht für diese Größe nicht aus.';
        else if (r.status >= 500) m = 'Der Dienst hat einen Fehler gemeldet. Bitte noch einmal versuchen.';
        say(m, true);
        return;
      }
      // Die Wahrheit sagen, statt zu beschwichtigen. Die Zahlen kommen vom Server aus
      // gemessenen Laufzeiten – wer „gleich fertig“ hört und 20 Minuten wartet, ist weg.
      var wartenMin = Math.round((+j.eta || 0) / 60);
      phase = (+j.position > 1)
        ? 'Du bist Nummer ' + j.position + ' in der Schlange' + (wartenMin >= 2 ? ' · ca. ' + wartenMin + ' Min.' : '')
        : 'Otto fängt gleich an';
      var jobId = j.jobId;
      wartemailAnbieten(jobId, j.mailAn, j.meineMail);
      // Ab ein paar Minuten Wartezeit gleich das Mail-Feld aufmachen: dann muss niemand
      // davor sitzen bleiben, und wir verlieren ihn nicht an die Wartezeit.
      if (wartenMin >= 3 && $('warte-mail') && !$('warte-mail').classList.contains('hide')) {
        $('warte-box').classList.remove('hide');
        $('warte-auf').classList.add('hide');
        $('warte-msg').textContent = 'Heute ist viel los – trag deine Mail ein, dann kannst du die Seite zumachen und wir schreiben dir, sobald dein Design fertig ist.';
      }
      // Wie lange wir warten, sagt der Server - er weiss, wie lange er sich Zeit nimmt.
      // Eine feste Grenze im Browser war der Grund, warum ein Design im Backend ankam,
      // der Kunde davor aber "dauert zu lange" zu sehen bekam. Eine Minute Zugabe,
      // damit die Seite nie VOR dem Server aufgibt.
      laufJob = jobId;
      laufBudget = (+j.maxMs > 0 ? +j.maxMs : 6 * 60000) + 60000;
      laufUeberzogen = false;
      laufMerken(jobId);
      poll = setInterval(laufTakt, 3000);
      loadTop();   // 1. Okt.: "Beliebteste Designs" nur, solange auf das eigene Design gewartet wird
    }).catch(function () {
      stopRun();
      say('Der Dienst ist nicht erreichbar. Bitte Verbindung prüfen und noch einmal versuchen.', true);
    });
  });

  refresh();
  // 1. Okt., Markus: "Die beliebten Designs zeigen wir nur noch in dem Moment, wo der Kunde auf
  // sein Design wartet - vorher verwirrt das total." Darum kein loadTop() beim Laden der Seite
  // mehr: es kommt mit dem Start des Laufs und geht mit stopRun() oder dem fertigen Design.
  laufAufnehmen();
})();
