/* Geschenke-Fee: Sternenstaub, Zauberbuehne, Welten-Zauber, Wunschkasten.
   Alles ohne Bibliothek. Bei "weniger Bewegung" bleibt alles still und lesbar. */
(function () {
  'use strict';
  var ruhig = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var feineMaus = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var FARBEN = ['#C9A24B', '#E2508A', '#F6B9D0', '#D9B66A', '#B5315F'];

  function zufall(a, b) { return a + Math.random() * (b - a); }

  /* Ein kleiner vierzackiger Funke */
  function funkePfad(ctx, x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x + r * .18, y - r * .18, x + r, y);
    ctx.quadraticCurveTo(x + r * .18, y + r * .18, x, y + r);
    ctx.quadraticCurveTo(x - r * .18, y + r * .18, x - r, y);
    ctx.quadraticCurveTo(x - r * .18, y - r * .18, x, y - r);
    ctx.closePath();
  }

  /* 1. Sternenstaub ueber der ganzen Seite (Markus: "der staendig auf der Seite runterfaellt") */
  function sternenstaub() {
    var c = document.getElementById('sternenstaub');
    if (!c || ruhig) return;
    var ctx = c.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2), w, h;
    var teile = [], spur = [], laeuft = true;
    var menge = window.innerWidth < 760 ? 34 : 64;
    function groesse() { w = window.innerWidth; h = window.innerHeight; c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    function neu(oben) {
      return { x: zufall(0, w), y: oben ? zufall(-40, -4) : zufall(0, h), r: Math.random() < .22 ? zufall(2.4, 4.2) : zufall(.7, 1.7),
        v: zufall(.12, .45), schw: zufall(0, Math.PI * 2), amp: zufall(.15, .5), f: FARBEN[(Math.random() * FARBEN.length) | 0], a: zufall(.35, .85), t: zufall(0, 6) };
    }
    groesse();
    for (var i = 0; i < menge; i++) teile.push(neu(false));
    window.addEventListener('resize', groesse);
    document.addEventListener('visibilitychange', function () { laeuft = !document.hidden; if (laeuft) requestAnimationFrame(schritt); });
    if (feineMaus) {
      var zuletzt = 0;
      window.addEventListener('pointermove', function (e) {
        var jetzt = performance.now();
        if (jetzt - zuletzt < 45) return;
        zuletzt = jetzt;
        spur.push({ x: e.clientX + zufall(-6, 6), y: e.clientY + zufall(-6, 6), r: zufall(1.6, 3.2), vx: zufall(-.3, .3), vy: zufall(.2, .9), f: FARBEN[(Math.random() * 3) | 0], leben: 1 });
        if (spur.length > 40) spur.shift();
      }, { passive: true });
    }
    function schritt() {
      if (!laeuft) return;
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < teile.length; i++) {
        var p = teile[i];
        p.t += .02; p.y += p.v; p.x += Math.sin(p.t + p.schw) * p.amp * .4;
        if (p.y > h + 10) teile[i] = neu(true);
        var glanz = p.r > 2 ? (.55 + .45 * Math.sin(p.t * 2.4 + p.schw)) : 1;
        ctx.globalAlpha = p.a * glanz;
        ctx.fillStyle = p.f;
        if (p.r > 2) funkePfad(ctx, p.x, p.y, p.r * 1.6); else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); }
        ctx.fill();
      }
      for (var j = spur.length - 1; j >= 0; j--) {
        var s = spur[j];
        s.x += s.vx; s.y += s.vy; s.leben -= .022;
        if (s.leben <= 0) { spur.splice(j, 1); continue; }
        ctx.globalAlpha = s.leben * .9; ctx.fillStyle = s.f;
        funkePfad(ctx, s.x, s.y, s.r * (0.6 + s.leben * .6)); ctx.fill();
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(schritt);
    }
    requestAnimationFrame(schritt);
  }

  /* Funkenflug von einem Punkt zu einem Ziel (Zauberstab -> Geschenk) */
  function funkenFlug(ebene, von, nach, dauer) {
    if (ruhig || !ebene) return;
    var stueck = 26;
    for (var i = 0; i < stueck; i++) {
      (function (i) {
        var f = document.createElement('span');
        var gr = zufall(6, 14);
        f.style.cssText = 'position:absolute;left:' + von.x + 'px;top:' + von.y + 'px;width:' + gr + 'px;height:' + gr + 'px;margin:-' + gr / 2 + 'px 0 0 -' + gr / 2 + 'px;pointer-events:none';
        f.innerHTML = '<svg viewBox="0 0 20 20" width="100%" height="100%"><path fill="' + FARBEN[i % FARBEN.length] + '" d="M10 0Q11.6 8.4 20 10Q11.6 11.6 10 20Q8.4 11.6 0 10Q8.4 8.4 10 0Z"/></svg>';
        ebene.appendChild(f);
        var dx = nach.x - von.x + zufall(-70, 70), dy = nach.y - von.y + zufall(-50, 50);
        var mx = dx * .45 + zufall(-60, 60), my = dy * .2 - zufall(20, 80);
        var a = f.animate([
          { transform: 'translate(0,0) scale(.4) rotate(0deg)', opacity: 0 },
          { transform: 'translate(' + mx + 'px,' + my + 'px) scale(1) rotate(90deg)', opacity: 1, offset: .35 },
          { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.3) rotate(200deg)', opacity: 0 }
        ], { duration: dauer + zufall(-250, 250), delay: i * 28, easing: 'cubic-bezier(.23,1,.32,1)', fill: 'forwards' });
        a.onfinish = function () { f.remove(); };
      })(i);
    }
  }

  /* 2. Zauberbuehne: Wunsch wird getippt, die Fee schwingt den Stab, das Geschenk erscheint */
  function buehne() {
    var b = document.querySelector('[data-buehne]');
    if (!b) return;
    var daten = JSON.parse(b.querySelector('script[type="application/json"]').textContent);
    var wunsch = b.querySelector('.wunsch-text'), wer = b.querySelector('.wunsch .wer');
    var bildBox = b.querySelector('.geschenk'), was = b.querySelector('.buehne-fuss .was');
    var fee = b.querySelector('.fee-figur'), ebene = b.querySelector('.funken-ebene');
    var knoepfe = Array.prototype.slice.call(b.querySelectorAll('.beispiele button'));
    var nr = 0, uhr = null, tipp = null, angehalten = false, sichtbar = true;

    function zeigen(i, sofort) {
      nr = i;
      var d = daten[i];
      knoepfe.forEach(function (k, j) { k.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
      wer.textContent = d.wer;
      was.innerHTML = d.was;
      clearInterval(tipp);
      var img = new Image();
      img.src = d.bild; img.alt = d.alt; img.width = 640; img.height = 480;
      if (sofort || ruhig) {
        wunsch.textContent = d.wunsch;
        bildBox.innerHTML = ''; bildBox.appendChild(img);
        return;
      }
      wunsch.textContent = '';
      var k = 0;
      tipp = setInterval(function () {
        k += 2;
        wunsch.textContent = d.wunsch.slice(0, k);
        if (k >= d.wunsch.length) {
          clearInterval(tipp);
          zaubern(img);
        }
      }, 34);
    }
    function zaubern(img) {
      fee.classList.remove('schwingt'); void fee.offsetWidth; fee.classList.add('schwingt');
      var rb = b.getBoundingClientRect(), st = fee.querySelector('.stern').getBoundingClientRect(), zi = bildBox.getBoundingClientRect(), re = ebene.getBoundingClientRect();
      funkenFlug(ebene, { x: st.left + st.width / 2 - re.left, y: st.top + st.height / 2 - re.top }, { x: zi.left + zi.width / 2 - re.left, y: zi.top + zi.height / 2 - re.top }, 1100);
      setTimeout(function () {
        img.className = 'neu';
        bildBox.innerHTML = ''; bildBox.appendChild(img);
        requestAnimationFrame(function () { requestAnimationFrame(function () { img.className = 'da'; }); });
      }, 650);
    }
    function weiter() {
      clearTimeout(uhr);
      if (ruhig || angehalten || !sichtbar) return;
      uhr = setTimeout(function () { zeigen((nr + 1) % daten.length); weiter(); }, 7600);
    }
    knoepfe.forEach(function (k, j) { k.addEventListener('click', function () { zeigen(j); weiter(); }); });
    b.addEventListener('mouseenter', function () { if (feineMaus) { angehalten = true; clearTimeout(uhr); } });
    b.addEventListener('mouseleave', function () { if (feineMaus) { angehalten = false; weiter(); } });
    b.addEventListener('focusin', function () { angehalten = true; clearTimeout(uhr); });
    b.addEventListener('focusout', function () { angehalten = false; weiter(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { sichtbar = e[0].isIntersecting; if (sichtbar) weiter(); else clearTimeout(uhr); }, { threshold: .2 }).observe(b);
    }
    zeigen(0, false);
    weiter();
  }

  /* 3. Einblenden beim Scrollen (einmal): Weltentore und die Funkenspur */
  function einblenden() {
    var ziele = document.querySelectorAll('.tore, .ablauf');
    document.querySelectorAll('.spur .zeichnen').forEach(function (p) { try { p.style.setProperty('--laenge', Math.ceil(p.getTotalLength()) + 'px'); } catch (e) {} });
    if (ruhig || !('IntersectionObserver' in window)) { ziele.forEach(function (z) { z.classList.add('sichtbar'); }); return; }
    var io = new IntersectionObserver(function (eintraege) {
      eintraege.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('sichtbar'); io.unobserve(e.target); } });
    }, { threshold: .15 });
    ziele.forEach(function (z) { io.observe(z); });
  }

  /* 4. Weltentore: beim Antippen ein kleiner Funkenregen aus dem Bogen */
  function tore() {
    if (ruhig) return;
    document.querySelectorAll('.tor').forEach(function (t) {
      t.addEventListener('pointerenter', function (e) {
        if (e.pointerType !== 'mouse') return;
        var bild = t.querySelector('.tor-bild'), r = bild.getBoundingClientRect();
        var ebene = document.querySelector('.funken-seite');
        if (!ebene) { ebene = document.createElement('div'); ebene.className = 'funken-seite'; ebene.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:45'; document.body.appendChild(ebene); }
        funkenFlug(ebene, { x: r.left + r.width / 2, y: r.top + 10 }, { x: r.left + r.width / 2, y: r.top + r.height * .55 }, 900);
      });
    });
  }

  /* 5. Wunschkasten mit Mikrofon (Spracherkennung im Browser, Deutsch) */
  function wunschkasten() {
    document.querySelectorAll('[data-wunsch]').forEach(function (form) {
      var feld = form.querySelector('textarea'), antwort = form.querySelector('.antwort'), mikro = form.querySelector('[data-mikro]');
      var Erkennung = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (mikro && !Erkennung) mikro.hidden = true;
      if (mikro && Erkennung) {
        var er = null, an = false, grund = '';
        mikro.addEventListener('click', function () {
          if (an) { er.stop(); return; }
          er = new Erkennung(); er.lang = 'de-DE'; er.interimResults = true; er.continuous = true;
          grund = feld.value ? feld.value.replace(/\s+$/, '') + ' ' : '';
          er.onresult = function (ev) {
            var t = '';
            for (var i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript;
            feld.value = grund + t;
          };
          er.onend = function () { an = false; mikro.classList.remove('hoert'); mikro.querySelector('span').textContent = 'Einsprechen'; };
          er.onerror = function () { antwort.textContent = 'Das Mikrofon ist gerade nicht erreichbar. Tipp deinen Wunsch einfach ein.'; };
          try { er.start(); } catch (fehler) { antwort.textContent = 'Das Mikrofon ist gerade nicht erreichbar. Tipp deinen Wunsch einfach ein.'; return; }
          an = true; mikro.classList.add('hoert'); mikro.querySelector('span').textContent = 'Fertig';
        });
      }
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!feld.value.trim()) { antwort.textContent = 'Erzähl der Fee zuerst, für wen das Geschenk ist.'; feld.focus(); return; }
        antwort.textContent = 'Danke! Das ist eine Vorschau der Seite. Sobald der Shop angeschlossen ist, entsteht hier aus deinem Wunsch dein Motiv.';
        var knopf = form.querySelector('[type="submit"]'), r = knopf.getBoundingClientRect();
        var ebene = document.querySelector('.funken-seite');
        if (!ebene) { ebene = document.createElement('div'); ebene.className = 'funken-seite'; ebene.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:45'; document.body.appendChild(ebene); }
        funkenFlug(ebene, { x: r.left + r.width / 2, y: r.top + r.height / 2 }, { x: r.left + r.width / 2, y: r.top - 120 }, 1000);
      });
    });
  }

  /* 6. Menue auf dem Handy */
  function menue() {
    var k = document.querySelector('.menue-knopf'), m = document.getElementById('menue');
    if (!k || !m) return;
    k.addEventListener('click', function () {
      var offen = k.getAttribute('aria-expanded') === 'true';
      k.setAttribute('aria-expanded', String(!offen)); m.hidden = offen;
    });
    m.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { k.setAttribute('aria-expanded', 'false'); m.hidden = true; }); });
  }

  /* 7. Der Zauber jeder Feenwelt (laeuft nur ueber dem Bild der Welt) */
  var FORMEN = {
    herz: function (ctx, x, y, r) { ctx.beginPath(); ctx.moveTo(x, y + r * .7); ctx.bezierCurveTo(x - r * 1.4, y - r * .2, x - r * .6, y - r * 1.2, x, y - r * .45); ctx.bezierCurveTo(x + r * .6, y - r * 1.2, x + r * 1.4, y - r * .2, x, y + r * .7); ctx.closePath(); },
    blatt: function (ctx, x, y, r, w) { ctx.save(); ctx.translate(x, y); ctx.rotate(w); ctx.beginPath(); ctx.ellipse(0, 0, r, r * .5, 0, 0, Math.PI * 2); ctx.restore(); },
    punkt: function (ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); },
    flocke: function (ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); },
    stern: function (ctx, x, y, r) { funkePfad(ctx, x, y, r); },
    konfetti: function (ctx, x, y, r, w) { ctx.save(); ctx.translate(x, y); ctx.rotate(w); ctx.beginPath(); ctx.rect(-r, -r * .45, r * 2, r * .9); ctx.restore(); },
    pfote: function (ctx, x, y, r) { ctx.beginPath(); ctx.ellipse(x, y + r * .35, r * .55, r * .45, 0, 0, Math.PI * 2); [[-.55, -.25], [-.2, -.6], [.2, -.6], [.55, -.25]].forEach(function (p) { ctx.moveTo(x + p[0] * r + r * .2, y + p[1] * r); ctx.ellipse(x + p[0] * r, y + p[1] * r, r * .2, r * .25, 0, 0, Math.PI * 2); }); }
  };
  var ZAUBER = {
    schnee:   { form: 'flocke', farben: ['#FFFFFF', '#FFFFFF', '#FDEAF2'], menge: 70, r: [1.2, 3.4], v: [.3, .9], richtung: 1, extra: 'stern' },
    sterne:   { form: 'stern', farben: ['#D9B66A', '#C9A24B', '#FFFFFF'], menge: 26, r: [2.5, 5.5], v: [.12, .35], richtung: 1, glanz: true },
    herzen:   { form: 'herz', farben: ['#E2508A', '#F6B9D0', '#B5315F'], menge: 18, r: [4, 9], v: [.25, .6], richtung: -1, extra: 'blatt' },
    blueten:  { form: 'blatt', farben: ['#F6B9D0', '#FFFFFF', '#E2508A'], menge: 30, r: [3, 6.5], v: [.3, .7], richtung: 1, dreht: true },
    konfetti: { form: 'konfetti', farben: ['#E2508A', '#F6B9D0', '#C9A24B', '#B5315F', '#9CC3A0'], menge: 46, r: [2.5, 5], v: [.5, 1.2], richtung: 1, dreht: true },
    blaetter: { form: 'blatt', farben: ['#9CB59A', '#F6B9D0', '#E2508A', '#C9A24B'], menge: 22, r: [4, 7], v: [.3, .65], richtung: 1, dreht: true, extra: 'gluehen' },
    pfoten:   { form: 'herz', farben: ['#F6B9D0', '#E2508A'], menge: 10, r: [4, 7], v: [.2, .45], richtung: -1, pfoten: true }
  };
  function weltZauber() {
    var d = document.querySelector('[data-zauber]');
    if (!d || ruhig) return;
    var art = ZAUBER[d.getAttribute('data-zauber')]; if (!art) return;
    var c = document.createElement('canvas'); d.appendChild(c);
    var ctx = c.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 2), w, h, teile = [], tapsen = [], laeuft = true, t0 = performance.now();
    function groesse() { var r = d.getBoundingClientRect(); w = r.width; h = r.height; c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    function neu(start) {
      var r = zufall(art.r[0], art.r[1]);
      return { x: zufall(0, w), y: start ? zufall(0, h) : (art.richtung > 0 ? -12 : h + 12), r: r, v: zufall(art.v[0], art.v[1]), w: zufall(0, 6), dw: zufall(-.03, .03), t: zufall(0, 6), f: art.farben[(Math.random() * art.farben.length) | 0], a: zufall(.55, .95) };
    }
    groesse(); window.addEventListener('resize', groesse);
    for (var i = 0; i < art.menge; i++) teile.push(neu(true));
    document.addEventListener('visibilitychange', function () { laeuft = !document.hidden; if (laeuft) requestAnimationFrame(schritt); });
    function schritt(jetzt) {
      if (!laeuft) return;
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < teile.length; i++) {
        var p = teile[i];
        p.t += .016; p.y += p.v * art.richtung; p.x += Math.sin(p.t * 1.3 + p.w) * .35; p.w += p.dw;
        if ((art.richtung > 0 && p.y > h + 14) || (art.richtung < 0 && p.y < -14)) teile[i] = neu(false);
        var a = p.a;
        if (art.glanz) a *= .45 + .55 * Math.sin(p.t * 3 + p.w);
        if (art.richtung < 0) a *= Math.min(1, p.y / (h * .35));
        ctx.globalAlpha = Math.max(0, a); ctx.fillStyle = p.f;
        FORMEN[art.form](ctx, p.x, p.y, p.r, art.dreht ? p.w : 0); ctx.fill();
        if (p.f === '#FFFFFF' || p.f === '#FDEAF2') { ctx.globalAlpha = Math.max(0, a * .5); ctx.strokeStyle = '#F6B9D0'; ctx.lineWidth = .6; ctx.stroke(); }
      }
      if (art.pfoten) {
        /* Eine Spur kleiner Pfoten laeuft ueber den weissen Grund unten im Bild */
        var takt = ((jetzt - t0) / 520) | 0;
        if (!tapsen.length || tapsen[tapsen.length - 1].n !== takt) {
          var n = takt % 16, x = w * (.1 + n * .05), y = h * (.86 - Math.sin(n * .5) * .025) + (n % 2 ? -h * .018 : h * .018);
          tapsen.push({ n: takt, x: x, y: y, leben: 1 });
        }
        for (var j = tapsen.length - 1; j >= 0; j--) {
          var s = tapsen[j]; s.leben -= .0045;
          if (s.leben <= 0) { tapsen.splice(j, 1); continue; }
          ctx.globalAlpha = Math.min(1, s.leben * 1.6) * .75; ctx.fillStyle = '#C08A5B';
          FORMEN.pfote(ctx, s.x, s.y, Math.max(7, w * .018)); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(schritt);
    }
    requestAnimationFrame(schritt);
  }

  sternenstaub();
  buehne();
  einblenden();
  tore();
  wunschkasten();
  menue();
  weltZauber();
})();
