// Otto im Gespraech (6. Okt., Markus): "bei dem Freisprechen oder natuerlich auch bei dem Eintippen irgendwo ein Dialog, so dass
// Motto Otto in der Sprechblase Dinge abfragt. Wenn das Mikrofon eingestellt ist, dann selbstverstaendlich, dass es an bleibt ...
// Moeglichst, dass der Kunde per Sprachbefehl bis zur Bestellung alles durchgehen kann." Und: "Otto soll sprechen ... bekommt dann
// meine Stimme" - feste Saetze, von Markus eingesprochen (otto-stimme/<schluessel>.mp3, Liste in otto-stimme/saetze.json).
//
// Aufbau: eine Schicht UEBER der Seite. Sie fragt den aktuellen Schritt ab (MoAbfolge ueber window.MoSeite), hoert zu, erledigt
// schnelle Befehle selbst (weiter, zurueck, los, nochmal, stopp) und schickt alles andere mit dem, was gerade sichtbar ist (Felder,
// Kacheln, Knoepfe), an /api/mo/gespraech. Zurueck kommen Aktionen (Feld fuellen, Kachel/Knopf antippen, weiter), die hier
// ausgefuehrt werden. Dadurch gilt das Gespraech fuer jedes Motto, ohne jeden Schritt einzeln zu programmieren.
// Grenzen (Browser und Gesetz): Foto-Auswahl und Kamera oeffnen nur nach einem echten Tipp - Otto zeigt dafuer einen grossen
// Knopf. Bezahlt wird bei Shopify mit eigenem Tipp (Button-Loesung) - Otto bringt den Kunden bis zur Kasse.
(function () {
  if (window.MoGespraech) return;
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  var MERK = 'mo_gespraech';
  var saetze = {}, stand = {};
  try { fetch('/otto-stimme/saetze.json').then(function (r) { return r.json(); }).then(function (j) { saetze = (j && j.saetze) || {}; stand = (j && j.stand) || {}; frageNeu(); }).catch(function () { }); } catch (e) { /* ohne Saetze */ }

  // ---------- Oberflaeche: Otto unten, mit Sprechblase ----------
  var css = '#og{position:fixed;left:12px;right:12px;bottom:12px;z-index:60;max-width:760px;margin:0 auto;display:none;grid-template-columns:56px 1fr;gap:10px;align-items:start;font:inherit}' +
    '#og.an{display:grid}#og img{width:56px;height:56px;border-radius:50%;border:2.5px solid #000;box-shadow:3px 3px 0 #000;background:#E1E2E3;object-fit:cover}' +
    '#og .blase{position:relative;background:#fff;color:#000;border:2.5px solid #000;border-radius:18px;box-shadow:4px 4px 0 #000;padding:10px 12px;display:grid;gap:6px}' +
    '#og .frage{font-weight:800;font-size:17px;line-height:1.25}#og .hoert{font-size:14px;color:#4A4136;min-height:1.2em}' +
    '#og .knoepfe{display:flex;flex-wrap:wrap;gap:6px}#og .knoepfe button{font:inherit;font-weight:700;font-size:14px;border:2px solid #000;border-radius:999px;background:#fff;color:#000;padding:6px 12px;cursor:pointer}' +
    '#og .knoepfe button.mik.an{background:#E9166A;color:#fff}#og .knoepfe button.gross{background:#77C500;font-size:16px;padding:10px 16px;box-shadow:3px 3px 0 #000}' +
    '#og-start{position:fixed;right:14px;bottom:14px;z-index:59;font:inherit;font-weight:800;border:2.5px solid #000;border-radius:999px;background:#77C500;color:#000;padding:10px 16px;box-shadow:4px 4px 0 #000;cursor:pointer}' +
    'body.og-an{padding-bottom:170px}body.og-an #og-start{display:none}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  var box = document.createElement('div'); box.id = 'og'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Gespräch mit Otto');
  box.innerHTML = '<img src="/api/mo/otto/nimmt-auf.png" alt="Otto"><div class="blase"><div class="frage" id="og-frage" aria-live="polite"></div>' +
    '<div class="hoert" id="og-hoert"></div><div class="knoepfe" id="og-knoepfe">' +
    '<button type="button" class="mik" id="og-mik">🎤 Mikro</button><button type="button" id="og-weiter">Weiter</button><button type="button" id="og-zurueck">Zurück</button><button type="button" id="og-aus">Beenden</button></div></div>';
  var start = document.createElement('button'); start.type = 'button'; start.id = 'og-start'; start.textContent = '🎤 Mit Otto sprechen';
  function einbauen() { document.body.appendChild(box); document.body.appendChild(start); }
  if (document.body) einbauen(); else document.addEventListener('DOMContentLoaded', einbauen);
  var $ = function (id) { return document.getElementById(id); };

  // ---------- Zustand ----------
  var aktiv = false, hoerenSoll = false, rec = null, sprichtGerade = false, puffer = '', stille = null, letzteFrage = '', beschaeftigt = false;
  function seite() { return window.MoSeite || null; }
  function sichtbar(el) { return !!el && el.offsetParent !== null && !el.closest('#og'); }

  // ---------- Otto spricht: feste Saetze in Markus' Stimme ----------
  var audio = null;
  function sprich(schluessel, text) {
    $('og-frage').textContent = text || saetze[schluessel] || '';
    if (!schluessel) return;
    try { if (audio) audio.pause(); } catch (e) { /* egal */ }
    // ohne Aufnahme nur die Blase; mit Aufnahme immer die neueste (?v= = Stand, /admin/stimme nimmt neu auf)
    if (!stand[schluessel]) { sprichtGerade = false; return; }
    audio = new Audio('/otto-stimme/' + schluessel + '.mp3?v=' + stand[schluessel]);
    sprichtGerade = true; if (rec) try { rec.stop(); } catch (e) { /* egal */ }
    var fertig = function () { sprichtGerade = false; if (hoerenSoll && !rec) hoeren(); };
    audio.onended = fertig; audio.onerror = fertig;
    var p = audio.play(); if (p && p.catch) p.catch(fertig);
  }

  // ---------- Was gerade dran ist ----------
  // Der Otto-Weg (abgesegnet 6. Okt.): vor dem Stil fragt Otto, ob er aussuchen soll ("such du aus" -> weiter mit seinem Vorschlag,
  // "selbst" -> Stil-Kacheln und "Dann such dir einen aus").
  var stilSelbst = false;
  function nichtTextil() {
    var a = '';
    try { a = ($('v_artikel') && $('v_artikel').value) || new URLSearchParams(location.search).get('artikel') || ''; } catch (e) { a = ''; }
    return !!a && !/^(tshirt|hoodie|shopper|polo|zip|sweat|longsleeve|tank|cap|kinder)/.test(a);
  }
  function lage() {
    var s = seite(), res = $('result');
    if (s && s.laeuft()) return { schluessel: 'warten', id: 'warten' };
    if (res && !res.classList.contains('hide') && sichtbar(res)) {
      var kf = $('kf-form');
      // Kaufen: bei Textil Groesse und Menge, bei allem anderen (Kissen, Strandtuch ...) nur die Menge
      return kf && !kf.classList.contains('hide') ? (nichtTextil() ? { schluessel: 'menge', id: 'menge' } : { schluessel: 'kaufen', id: 'kaufen' }) : { schluessel: 'fertig', id: 'fertig' };
    }
    var ab = s && s.abfolge && s.abfolge();
    if (!ab || !ab.schritte) return { schluessel: 'start', id: 'start' };
    var sch = ab.schritte[ab.aktiv()] || {};
    var k = sch.zusammenfassung ? 'zusammenfassung'
      : sch.id === 'artikel' ? 'artikel'
      : /^feld_motiv\b/.test(sch.id) ? 'wunsch'
      : /logo|foto/.test(sch.id) || (sch.felder || []).some(function (f) { return /foto/.test(f); }) ? 'foto'
      : /^stil/.test(sch.id) ? (stilSelbst ? 'stil' : 'stil_frage') : /^textil/.test(sch.id) ? 'textil' : /^groesse/.test(sch.id) ? 'groesse'
      : /^optional|^fein|^weiteres/.test(sch.id) ? 'optional'
      : (sch.felder || []).some(function (f) { return /namen|team|crew/.test(f); }) ? 'namen' : 'feld';
    return { schluessel: k, id: sch.id || k, titel: sch.titel || '' };
  }
  function frageNeu(erzwingen) {
    if (!aktiv) return;
    var l = lage();
    if (!erzwingen && l.id === letzteFrage) return;
    letzteFrage = l.id;
    // Die Sprechblase nennt den Schritt so, wie er auf der Seite heisst; gesprochen wird Markus' fester Satz dazu.
    sprich(l.schluessel, l.titel && l.schluessel !== 'zusammenfassung' ? l.titel : '');
  }
  setInterval(function () { if (aktiv && !beschaeftigt) frageNeu(); }, 700);

  // ---------- Zuhoeren: an, bis Beenden oder Stopp ----------
  function hoeren() {
    if (!SR || !hoerenSoll || sprichtGerade || rec) return;
    var r = new SR(); r.lang = 'de-DE'; r.interimResults = true; r.continuous = true;
    r.onresult = function (ev) {
      var zw = '';
      for (var i = ev.resultIndex; i < ev.results.length; i++) { var t = ev.results[i][0].transcript; if (ev.results[i].isFinal) puffer += t + ' '; else zw += t; }
      $('og-hoert').textContent = (puffer + zw).trim();
      clearTimeout(stille);
      // Nach einer kurzen Pause gilt der Satz als fertig
      stille = setTimeout(function () { var s = puffer.trim(); puffer = ''; if (s) verarbeiten(s); }, 1300);
    };
    r.onerror = function (ev) { if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') { hoerenSoll = false; mikZeigen(); $('og-hoert').textContent = 'Bitte das Mikrofon erlauben – oder tipp einfach auf der Seite weiter.'; } };
    r.onend = function () { rec = null; if (hoerenSoll && !sprichtGerade) setTimeout(hoeren, 150); };
    rec = r;
    try { r.start(); } catch (e) { rec = null; }
  }
  function mikZeigen() { $('og-mik').classList.toggle('an', hoerenSoll); $('og-mik').textContent = hoerenSoll ? '🎤 Ich höre zu' : '🎤 Mikro an'; }

  // ---------- Schnelle Befehle ohne KI ----------
  function weiterTippen() {
    var s = seite(), ab = s && s.abfolge && s.abfolge();
    var l = lage();
    if (l.schluessel === 'zusammenfassung') { var go = $('go'); if (go && !go.disabled) { go.click(); return true; } }
    if (ab && ab.weiter) { ab.weiter(); return true; }
    return false;
  }
  function verarbeiten(text) {
    $('og-hoert').textContent = '„' + text + '“';
    var t = text.toLowerCase().replace(/[.!?,]/g, '').trim();
    var s = seite(), ab = s && s.abfolge && s.abfolge();
    if (/^(stopp|stop|pause|ruhe|sei still|sei mal still|ende|aufhören)$/.test(t)) { aus(true); return; }
    if (/^(weiter|weiter bitte|nächster schritt|nächste|ok weiter|okay weiter|passt weiter)$/.test(t)) { weiterTippen(); return; }
    if (/^(zurück|einen schritt zurück|geh zurück)$/.test(t)) { if (ab && ab.zurueck) ab.zurueck(); return; }
    if (/^(nochmal die frage|wie bitte|was|frag nochmal|wiederholen)$/.test(t)) { frageNeu(true); return; }
    if (lage().schluessel === 'stil_frage') {
      if (/\b(du|such du|mach du|egal|aussuchen|deine wahl|überrasch mich)\b/.test(t) && !/\b(selbst|selber|ich)\b/.test(t)) { sprich('ok'); weiterTippen(); return; }
      if (/\b(selbst|selber|ich)\b/.test(t)) { stilSelbst = true; letzteFrage = ''; frageNeu(true); return; }
    }
    if (lage().schluessel === 'zusammenfassung' && /^(los|leg los|ja los|starten?|bauen|mach|mach mal|ja)$/.test(t)) { weiterTippen(); return; }
    // Geschuetzter Name: Otto hat lieb gefragt, ob er es im aehnlichen Stil machen soll - "ja" / "nein" beantworten das
    var mf = window.MoWunschFrage || window.MoMarkeFrage;
    if (mf && /^(ja|ja gerne|ja bitte|gerne|okay|ok|mach das|machen wir|ja mach)$/.test(t)) { sprich('ok'); mf.ja(); return; }
    if (mf && /^(nein|nee|nö|nein danke|lieber nicht|ne)$/.test(t)) { mf.nein(); return; }
    // Startseite: das Gesagte ist der Wunsch - in Ottos Wunschfeld und ab damit (das Gespraech laeuft auf der naechsten Seite weiter)
    var wt = $('wunsch-text'), wl = $('wunsch-los');
    if (wt && wl && !s) { wt.value = text; wt.dispatchEvent(new Event('input', { bubbles: true })); sprich('ok'); setTimeout(function () { wl.click(); }, 400); return; }
    fragen(text);
  }

  // ---------- Alles andere: die Seite beschreiben, die Text-KI sagt, was zu tun ist ----------
  var LABEL_MAX = 70;
  function beschriftung(el) {
    var t = '';
    if (el.id) { var lb = document.querySelector('label[for="' + el.id + '"]'); if (lb) t = lb.textContent; }
    if (!t && el.closest('label')) t = el.closest('label').textContent;
    if (!t) t = el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('title') || el.textContent || el.value || '';
    return String(t).replace(/\s+/g, ' ').trim().slice(0, LABEL_MAX);
  }
  function brauchtTipp(el) {
    if (el.tagName === 'LABEL') { var f = el.htmlFor && document.getElementById(el.htmlFor); if ((f && f.type === 'file') || el.querySelector('input[type="file"]')) return true; }
    return (el.tagName === 'INPUT' && el.type === 'file') || /^(drop|file|v_foto|foto-waehlen)$/.test(el.id || '') || /foto wählen|bild auswählen|kamera/i.test(el.textContent || '');
  }
  function sammeln() {
    var wurzel = $('app') || document.body, n = 0, liste = [];
    var els = wurzel.querySelectorAll('input, textarea, select, button, a.knopf, [role="button"], #drop, label');
    for (var i = 0; i < els.length && liste.length < 70; i++) {
      var el = els[i];
      if (!sichtbar(el) || el.disabled) continue;
      if (el.tagName === 'LABEL' && !brauchtTipp(el)) continue;   // Labels nur, wenn sie ein Datei-Feld oeffnen (Foto waehlen)
      if (el.tagName === 'INPUT' && /^(hidden|submit)$/.test(el.type)) continue;
      var id = 'o' + (++n); el.setAttribute('data-og', id);
      var e = { id: id, art: el.tagName === 'SELECT' ? 'auswahl' : el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && /^(text|email|number|search|tel|url)$/.test(el.type)) ? 'feld' : el.tagName === 'INPUT' && el.type === 'checkbox' ? 'haken' : 'knopf', text: beschriftung(el) };
      if (e.art === 'feld') e.wert = String(el.value || '').slice(0, 300);
      if (e.art === 'auswahl') { e.wert = el.value; e.optionen = [].slice.call(el.options, 0, 40).map(function (o) { return o.textContent.trim().slice(0, 40); }); }
      if (e.art === 'haken') e.wert = !!el.checked;
      if (e.art === 'knopf' && (el.classList.contains('on') || el.getAttribute('aria-pressed') === 'true')) e.gewaehlt = true;
      if (brauchtTipp(el)) e.tipp = true;
      liste.push(e);
    }
    var l = lage();
    return { schritt: l.id, frage: $('og-frage').textContent, motto: (seite() && seite().motto() && seite().motto().name) || '', elemente: liste };
  }
  function fragen(text) {
    beschaeftigt = true; $('og-hoert').textContent = '„' + text + '“ – Otto überlegt …';
    fetch('/api/mo/gespraech', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ aussage: text, seite: sammeln() }) })
      .then(function (r) { return r.json(); })
      .then(function (j) { beschaeftigt = false; ausfuehren((j && j.aktionen) || [], j && j.sag); })
      .catch(function () { beschaeftigt = false; sprich('nicht_verstanden'); });
  }
  function setzen(el, wert) {
    if (el.tagName === 'SELECT') {
      var w = String(wert).toLowerCase(), opt = [].filter.call(el.options, function (o) { return o.value.toLowerCase() === w || o.textContent.trim().toLowerCase() === w; })[0]
        || [].filter.call(el.options, function (o) { return o.textContent.toLowerCase().indexOf(w) >= 0; })[0];
      if (opt) el.value = opt.value;
    } else if (el.type === 'checkbox') el.checked = !!wert;
    else el.value = String(wert);
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function ausfuehren(aktionen, sag) {
    var getan = 0, tippNoetig = null;
    aktionen.forEach(function (a) {
      if (!a) return;
      if (a.art === 'weiter') { setTimeout(weiterTippen, 250 * (getan + 1)); getan++; return; }
      if (a.art === 'zurueck') { var ab = seite() && seite().abfolge(); if (ab) ab.zurueck(); getan++; return; }
      var el = document.querySelector('[data-og="' + String(a.ziel || '').replace(/[^a-z0-9]/g, '') + '"]');
      if (!el) return;
      if (a.art === 'setzen') { setzen(el, a.wert); getan++; }
      else if (a.art === 'klick') { if (brauchtTipp(el)) tippNoetig = el; else { el.click(); getan++; } }
    });
    if (tippNoetig) { tippKnopf(tippNoetig); return; }
    if (sag) $('og-frage').textContent = String(sag).slice(0, 200);
    if (!getan) sprich('nicht_verstanden', sag || '');
    else if (!sag) sprich('ok');
  }
  // Foto-Auswahl und Kamera oeffnet der Browser nur nach einem echten Tipp - darum ein grosser Knopf in Ottos Blase.
  function tippKnopf(el) {
    sprich('foto_waehlen');
    var alt = $('og-tipp'); if (alt) alt.remove();
    var b = document.createElement('button'); b.type = 'button'; b.id = 'og-tipp'; b.className = 'gross'; b.textContent = '📷 Foto wählen';
    b.addEventListener('click', function () { b.remove(); el.click(); });
    $('og-knoepfe').insertBefore(b, $('og-knoepfe').firstChild);
  }

  // ---------- An / aus ----------
  function an(mitMikro) {
    aktiv = true; letzteFrage = ''; document.body.classList.add('og-an'); box.classList.add('an');
    try { sessionStorage.setItem(MERK, '1'); } catch (e) { /* egal */ }
    if (mitMikro && SR) { hoerenSoll = true; mikZeigen(); }
    frageNeu(true);
    if (hoerenSoll) hoeren();
  }
  function aus(nurStill) {
    hoerenSoll = false; mikZeigen(); if (rec) try { rec.stop(); } catch (e) { /* egal */ }
    if (nurStill) { sprich('pause'); return; }
    aktiv = false; document.body.classList.remove('og-an'); box.classList.remove('an');
    try { sessionStorage.removeItem(MERK); } catch (e) { /* egal */ }
    try { if (audio) audio.pause(); } catch (e) { /* egal */ }
  }
  function knoepfeVerdrahten() {
    start.addEventListener('click', function () { an(true); });
    // 7. Okt., Markus: "Das mit dem Einsprechen nur beim Einstieg oben." Der schwebende Knopf unten ist weg; das Gespraech
    // laeuft auf einer Seite nur weiter, wenn es oben auf der Startseite (bzw. bei Otto) per Mikro begonnen wurde.
    start.style.display = 'none';
    // Startseite: dort spricht Otto schon aus seiner eigenen Blase ("Sag Otto einfach, was du willst"). Kein zweiter Otto unten -
    // wer dort das Mikro benutzt, ist ab dann im Gespraech; es geht auf der naechsten Seite in Ottos Blase unten weiter.
    if ($('wunsch-text')) {
      start.style.display = 'none';
      var hm = $('wunsch-mik');
      if (hm) hm.addEventListener('click', function () { try { sessionStorage.setItem(MERK, '1'); } catch (e) { /* egal */ } });
      return;
    }
    $('og-mik').addEventListener('click', function () { if (hoerenSoll) { hoerenSoll = false; mikZeigen(); if (rec) try { rec.stop(); } catch (e) { /* egal */ } } else { hoerenSoll = true; mikZeigen(); hoeren(); } });
    $('og-weiter').addEventListener('click', weiterTippen);
    $('og-zurueck').addEventListener('click', function () { var ab = seite() && seite().abfolge(); if (ab) ab.zurueck(); });
    $('og-aus').addEventListener('click', function () { aus(false); });
    if (!SR) $('og-mik').textContent = '🎤 (Browser kann nicht zuhören)';
    // Kam der Kunde mitten im Gespraech hierher (Wunsch von der Startseite eingesprochen), geht es weiter -
    // ob das Mikrofon ohne Tipp wieder angeht, entscheidet der Browser; sonst reicht ein Tipp aufs Mikro.
    var weiterLaufen = false; try { weiterLaufen = sessionStorage.getItem(MERK) === '1' || /[?&]gespraech=1/.test(location.search); } catch (e) { weiterLaufen = false; }
    if (weiterLaufen) setTimeout(function () { an(true); }, 600);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', knoepfeVerdrahten); else knoepfeVerdrahten();

  // Otto sagt einen festen Satz - nur, wenn das Gespraech an ist (z. B. die Frage bei einem geschuetzten Namen)
  function sag(schluessel) { if (aktiv) sprich(schluessel); }
  window.MoGespraech = { an: an, aus: aus, verarbeiten: verarbeiten, sammeln: sammeln, lage: lage, ausfuehren: ausfuehren, sag: sag };
})();
