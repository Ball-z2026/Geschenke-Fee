// Browser-Abnahme: die Seite so pruefen, wie ein Mensch sie benutzt - auf drei Geraeten.
//
// Markus, 18. Sept.: "Mach es doch einfach ordentlich, so dass es ueberall funktioniert.
// Laptop, iPhone, Android. Wir sollten alles testen, aber ich hab keinen Bock, die ganze
// Zeit irgendwas fuer dich zu testen."
//
// Recht hat er. Alles, was hier steht, habe ich vorher von ihm erbeten: "Tipp mal auf die
// Kachel", "Siehst du ein Bild?", "Steht da ein Hinweis?". Jetzt tut es ein echter Browser,
// bei jeder Abnahme, auf drei Bildschirmgroeszen. Was hier durchlaeuft, muss er nicht mehr
// anfassen. Was hier scheitert, kommt gar nicht erst zu ihm.
//
// Geprueft wird gegen einen frisch gestarteten Server mit Probe-Schluesseln und OHNE
// Bilddienst - also genau der Zustand, in dem NICHTS von auszen hilft. Bilder koennen dann
// fehlen (kein Vorzeige-Design auf dieser Platte), aber die Seite muss trotzdem stehen,
// lesbar sein und auf Tippen reagieren.
//
// Laeuft nur, wenn Playwright und ein Chromium da sind. Sonst wird das gesagt und der Rest
// der Abnahme laeuft weiter - eine Abnahme, die auf fremden Maschinen scheitert, weil ein
// Browser fehlt, wuerde bald niemand mehr ausfuehren.

import { spawn } from 'node:child_process';
import net from 'node:net';

const GERAETE = [
  { name: 'Laptop',  profil: 'Desktop Chrome' },
  { name: 'iPhone',  profil: 'iPhone 14' },
  { name: 'Android', profil: 'Pixel 7' }
];
const SEITEN = ['/', '/startseite-alt', '/so-gehts', '/event', '/m/abi', '/konto', '/a/probe/probe'];

async function playwrightLaden() {
  for (const k of ['playwright', '/opt/node22/lib/node_modules/playwright/index.mjs']) {
    try { return await import(k); } catch (e) { /* naechster Kandidat */ }
  }
  return null;
}

async function freierPort() {
  return new Promise((res) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
}

async function serverStarten(port) {
  const kind = spawn(process.execPath, ['server.js'], {
    env: { ...process.env, PORT: String(port), BALLZ_MCP_URL: 'http://127.0.0.1:1/mcp', ADMIN_TOKEN: 'probe', MASTER_TOKEN: 'probe', PUBLIC_BASE_URL: 'http://127.0.0.1:' + port, ABNAHME: '1' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let log = '';
  kind.stdout.on('data', d => { log += d; });
  kind.stderr.on('data', d => { log += d; });
  const start = Date.now();
  while (Date.now() - start < 40000) {
    try { const r = await fetch('http://127.0.0.1:' + port + '/', { signal: AbortSignal.timeout(2000) }); if (r.ok) return { kind, log: () => log }; } catch (e) { /* noch nicht */ }
    await new Promise(r => setTimeout(r, 500));
  }
  kind.kill('SIGKILL');
  throw new Error('Server kam nicht hoch:\n' + log.slice(-800));
}

// Was auf JEDER Seite und JEDEM Geraet gelten muss.
async function seitePruefen(page, url, geraet, pruefe) {
  const fehler = [];
  const onErr = e => fehler.push(e.message);
  page.on('pageerror', onErr);
  // 'load' statt 'networkidle': Kacheln laden lazy nach, der Server baut im Hintergrund weiter -
  // "kein Netzverkehr fuer 500 ms" trat mit offenem Netz nie ein, und die Pruefung lief in den
  // Timeout. Nach 'load' kurz setzen lassen, dann messen.
  let antwort = null;
  try { antwort = await page.goto(url, { waitUntil: 'load', timeout: 45000 }); }
  catch (e) { pruefe(`${geraet} ${url}: laedt`, false, String(e && e.message || e).slice(0, 120)); return null; }
  await page.waitForTimeout(1200);
  const status = antwort ? antwort.status() : 0;
  const mass = await page.evaluate(() => ({
    breit: document.documentElement.scrollWidth, fenster: window.innerWidth,
    viewport: !!document.querySelector('meta[name="viewport"]'),
    titel: document.title,
    // Ein Knopf, den ein Daumen trifft, ist mindestens 40 px hoch. Kleinere sind auf dem
    // Handy Glueckssache - und genau das nervt.
    // Beschriftungen INNERHALB eines groszen Links (die "Entwerfen"-Pille in der Kachel)
    // zaehlen nicht: getippt wird die ganze Kachel, nicht die Pille.
    kleineKnoepfe: Array.from(document.querySelectorAll('button, a.btn, .btn, a.mc'))
      .filter(b => b.offsetParent !== null && !(b.parentElement && b.parentElement.closest('a.mc')))
      .map(b => b.getBoundingClientRect())
      .filter(r => r.width > 0 && r.height > 0 && r.height < 32).length
  }));
  page.off('pageerror', onErr);
  const wo = `${geraet} ${url}`;
  pruefe(`${wo}: antwortet`, status === 200, 'HTTP ' + status);
  pruefe(`${wo}: keine Skriptfehler`, fehler.length === 0, fehler.slice(0, 2).join(' | '));
  pruefe(`${wo}: kein seitliches Scrollen`, mass.breit <= mass.fenster + 1, `${mass.breit} px Inhalt in ${mass.fenster} px Fenster`);
  pruefe(`${wo}: viewport-Meta fuer Handys`, mass.viewport);
  if (geraet !== 'Laptop') pruefe(`${wo}: Knoepfe daumentauglich`, mass.kleineKnoepfe === 0, mass.kleineKnoepfe ? mass.kleineKnoepfe + ' Knoepfe unter 32 px hoch' : '');
  return mass;
}

export async function pruefeBrowser({ pruefe, hinweis, abschnitt }) {
  abschnitt(7, 'Browser: Laptop, iPhone, Android');
  const pw = await playwrightLaden();
  if (!pw) { hinweis('Playwright nicht gefunden - Browser-Abnahme uebersprungen (auf dieser Maschine nicht pruefbar)'); return; }
  const port = await freierPort();
  let srv;
  try { srv = await serverStarten(port); }
  catch (e) { pruefe('Server startet fuer die Browser-Abnahme', false, String(e.message).slice(0, 300)); return; }
  let browser = null;
  try {
    const startOpts = {};
    if (process.env.PLAYWRIGHT_BROWSERS_PATH) startOpts.executablePath = process.env.PLAYWRIGHT_BROWSERS_PATH + '/chromium';
    try { browser = await pw.chromium.launch(startOpts); }
    catch (e) { browser = await pw.chromium.launch(); }
    const base = 'http://127.0.0.1:' + port;
    for (const g of GERAETE) {
      // Standort: der Browser "steht" am Eiffelturm und hat die Erlaubnis schon gegeben - so laesst
      // sich pruefen, ob der Knopf "Standort erlauben" ueberhaupt etwas ausloest (20. Sept.).
      const ctx = await browser.newContext({ ...pw.devices[g.profil], geolocation: { latitude: 48.8584, longitude: 2.2945 }, permissions: ['geolocation'] });
      const touch = !!pw.devices[g.profil].hasTouch;
      const page = await ctx.newPage();
      for (const s of SEITEN) await seitePruefen(page, base + s, g.name, pruefe);

      // 1. Okt., Markus: "sobald die Leute weitergehen, sehen die naechsten Seiten ueberhaupt nicht mehr
      // so schoen aus". Die Mottoseite traegt jetzt die Logo-Farben aus marke.css und denselben Kopf.
      {
        await page.goto(base + '/m/abschlussfahrt', { waitUntil: 'load', timeout: 45000 });
        await page.waitForTimeout(900);
        const mf = await page.evaluate(() => {
          const cs = (el) => el ? getComputedStyle(el) : null;
          const kam = document.querySelector('label.foto-waehlen');
          const weiter = [...document.querySelectorAll('.ab-weiter')].find(x => x.offsetParent !== null);
          return { grund: cs(document.body).backgroundColor, kopf: !!document.querySelector('header.mo-kopf a.mo-konto[href="/konto"]'),
            nav: [].map.call(document.querySelectorAll('.mo-nav a'), a => a.getAttribute('href')).join(' '),
            knopf: weiter ? cs(weiter).backgroundColor : '', kamSvg: !!(kam && kam.querySelector('svg')), emoji: /[\u{1F300}-\u{1FAFF}]/u.test(kam ? kam.textContent : ''),
            titel: cs(document.querySelector('.hero h2')).fontFamily };
        });
        // 1. Okt., Markus: "Die beliebten Designs zeigen wir nur noch in dem Moment, wo der Kunde auf
        // sein Design wartet - vorher verwirrt das total."
        const topVorher = await page.evaluate(() => { const t = document.getElementById('top'); return !t || t.classList.contains('hide') || t.offsetParent === null; });
        pruefe(`${g.name}: Mottoseite - "Beliebteste Designs" ist vor dem Start versteckt`, topVorher);
        // 1. Okt.: Eingaben unter 16 px lassen das iPhone hineinzoomen (Markus: Seite seitlich verschoben).
        const klein = await page.evaluate(() => [...document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=range]),select,textarea')]
          .filter(e => parseFloat(getComputedStyle(e).fontSize) < 16).map(e => e.id || e.className));
        pruefe(`${g.name}: Mottoseite - kein Eingabefeld unter 16 px (sonst zoomt das iPhone hinein)`, klein.length === 0, klein.slice(0, 6).join(' '));
        pruefe(`${g.name}: Mottoseite in den Logo-Farben - Papiergrund, Kopf wie die Startseite, gruener Knopf mit SVG statt Emoji, Anton im Titel`,
          mf.grund === 'rgb(246, 237, 221)' && mf.kopf && mf.nav === '/mottos /so-gehts /firma /partner /event' && mf.knopf === 'rgb(119, 197, 0)' && mf.kamSvg && !mf.emoji && /Anton/.test(mf.titel), JSON.stringify(mf));
        // 1./2. Okt., Markus: "Am Anfang soll man ein Foto hochladen ... Wenn ich da kein Foto hochlade,
        // brauche ich nicht die Frage, wie die Menschen aussehen sollen." Abschlussfahrt als Beispiel
        // der 13 Gruppen-Mottos: Schritt 1 ist das Foto, ohne Foto keine Figurenfrage, mit Foto schon.
        {
          await page.goto(base + '/m/abschlussfahrt', { waitUntil: 'load', timeout: 45000 });
          await page.waitForTimeout(900);
          const lage = () => page.evaluate(() => {
            const an = [...document.querySelectorAll('#abfolge section[data-schritt]')].find(x => x.offsetParent !== null);
            return { schritt: an ? an.getAttribute('data-schritt') : '', knopf: an && an.querySelector('.ab-weiter') ? an.querySelector('.ab-weiter').textContent : '',
              figurenZu: document.getElementById('f-figuren').classList.contains('hide'), zaehler: (document.getElementById('ab-zaehler') || {}).textContent || '',
              waehlen: !!document.querySelector('label.foto-waehlen[for="v_foto"]') };
          });
          const vor = await lage();
          await page.setInputFiles('#v_foto', [{ name: 'gruppe.jpg', mimeType: 'image/jpeg', buffer: await (await import('sharp')).default({ create: { width: 900, height: 700, channels: 3, background: { r: 150, g: 140, b: 120 } } }).jpeg().toBuffer() }]);
          await page.waitForFunction(() => !document.getElementById('f-figuren').classList.contains('hide'), null, { timeout: 15000 }).catch(() => {});
          const nach = await lage();
          const n = (z) => +((z.match(/von (\d+)/) || [])[1] || 0);
          pruefe(`${g.name}: Gruppen-Motto - Schritt 1 "Habt ihr ein Foto von euch?" mit Knopf, "Ohne Foto weiter", ohne Foto keine Figurenfrage, mit Foto ein Schritt mehr`,
            vor.schritt === 'feld_foto' && vor.waehlen && vor.knopf === 'Ohne Foto weiter' && vor.figurenZu && !nach.figurenZu && n(nach.zaehler) === n(vor.zaehler) + 1 && nach.knopf === 'Weiter',
            JSON.stringify({ vor, nach }));
        }
        // 3. Okt., Markus (Hochzeit ohne Foto): "lässt er mich unten nicht weitermachen". Das freiwillige
        // Foto (ohneGeht) darf den Start nie sperren - Pflichtfelder ausgefuellt, kein Foto: Otto starten geht.
        {
          await page.goto(base + '/m/hochzeit', { waitUntil: 'load', timeout: 45000 });
          await page.waitForTimeout(900);
          const hz = await page.evaluate(() => {
            const i = document.getElementById('v_paar'); if (i) { i.value = 'Clara & Ben'; i.dispatchEvent(new Event('input', { bubbles: true })); }
            const go = document.getElementById('go'); return { feld: !!i, text: go ? go.textContent : '', gesperrt: go ? go.disabled : true };
          });
          pruefe(`${g.name}: Hochzeit ohne Foto - nach den Pflichtfeldern ist "Otto starten" frei, das Foto sperrt nicht`, hz.feld && !hz.gesperrt && !/Foto/.test(hz.text), JSON.stringify(hz));
          // 3. Okt., Markus: "wenn jemand keinen Namen ausgewaehlt hat, dann muss man ja auch nicht mehr
          // angeben, wo die Namen hin sollen". Ohne Namen: kein Wohin, kein Wie, keine Namensschrift.
          const nm = await page.evaluate(async () => {
            const zu = () => ['f_aufteilung', 'f-nameart', 'f-font'].map(id => { const e = document.getElementById(id); return e ? e.classList.contains('hide') : null; });
            const n = document.querySelector('#nl_namen .nl-name');
            const setz = (w) => { n.value = w; n.dispatchEvent(new Event('input', { bubbles: true })); };
            const ohne = zu(); setz('Oma Inge'); await new Promise(r => setTimeout(r, 200));
            const mit = zu(); setz(''); await new Promise(r => setTimeout(r, 200));
            return { ohne, mit, wieder: zu() };
          });
          pruefe(`${g.name}: Hochzeit - ohne Namen keine Frage, wo und wie die Namen hin sollen; mit Namen sind sie da`,
            nm.ohne.every(x => x === true) && nm.mit.every(x => x === false) && nm.wieder.every(x => x === true), JSON.stringify(nm));
        }
        // 3. Okt., Markus: "Die naechste Seite funktioniert nicht wieder ... das muss immer weiter gedrueckt
        // werden." Der ganze Weg wie ein Kunde: Kachel antippen, Vorschlag antippen, tippen + Eingabetaste,
        // Haken setzen - nie "Weiter" (ausser auf der Foto-Seite, die ihren eigenen Knopf hat). Jede Seite
        // muss danach von selbst aufgehen, bis "Alles klar?". Hochzeit mit Namen (Schrift, Namensart,
        // Farbstimmung kommen), Freestyle (Groesse mit offenen Massfeldern, langes Textfeld).
        // 4. Okt., Markus (Meister-Shirt mit Namen): "einmal vorne klein mit Namen und hinten gross - das ist
        // ueberhaupt nicht erklaert und auch nicht anzutippen" und "Andere Sportart - welche?" als unnoetige Seite.
        {
          await page.goto(base + '/m/meister-shirt', { waitUntil: 'load', timeout: 45000 });
          await page.waitForTimeout(900);
          const ms = await page.evaluate(async () => {
            const seiten = () => [...document.querySelectorAll('.ab-schritt')].map(s => s.querySelector('.ab-titel').textContent);
            const vor = seiten();
            const nl = document.querySelector('.nl-name'); nl.value = 'Lena'; nl.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise(r => setTimeout(r, 250));
            const kacheln = [...document.querySelectorAll('#aufteilung-wahl [data-au]')];
            const brust = document.querySelector('#aufteilung-wahl [data-au="brust-kader"]');
            if (brust) brust.click();
            await new Promise(r => setTimeout(r, 100));
            const sel = document.getElementById('v_aufteilung');
            const sp = document.getElementById('v_sportart'); const fr = document.getElementById('f_sportart_frei');
            const freiOhne = fr ? fr.classList.contains('hide') : null;
            sp.value = 'Andere Sportart'; sp.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 150));
            return { andereSeite: vor.some(t => /Andere Sportart/.test(t)), vorneHinten: vor.indexOf('Vorne und hinten – wie soll das Shirt aussehen?'), groesse: vor.indexOf('Wie groß soll das Design werden?'),
              kacheln: kacheln.length, bilder: kacheln.filter(k => k.querySelector('svg.auf-bild')).length, wert: sel && sel.value, an: brust && brust.classList.contains('on'),
              liste: (kacheln[1] || {}).textContent || '', freiOhne, freiMit: fr ? !fr.classList.contains('hide') : null, freiBeiSportart: !!(fr && sp.closest('.ab-schritt') === fr.closest('.ab-schritt')) };
          });
          pruefe(`${g.name}: Meister-Shirt - eigene Seite "Vorne und hinten" vor der Groesse mit drei Kacheln samt Zeichnung, "vorne klein, hinten gross" antippbar, Kaderliste; "Andere Sportart" keine eigene Seite, nur bei Bedarf auf der Sportart-Seite`,
            !ms.andereSeite && ms.vorneHinten >= 0 && ms.vorneHinten === ms.groesse - 1 && ms.kacheln === 3 && ms.bilder === 3 && ms.wert === 'brust-kader' && ms.an && /Kaderliste/.test(ms.liste)
              && ms.freiOhne === true && ms.freiMit === true && ms.freiBeiSportart, JSON.stringify(ms));
        }
        for (const slug of ['hochzeit', 'freestyle']) {
          await page.goto(base + '/m/' + slug, { waitUntil: 'load', timeout: 45000 });
          await page.waitForTimeout(900);
          const titel = () => page.evaluate(() => { const s = [...document.querySelectorAll('.ab-schritt')].find(x => x.offsetHeight); return s ? s.querySelector('.ab-titel').textContent : ''; });
          const stehen = [], seiten = [];
          const enterHinweis = [];
          for (let i = 0; i < 30; i++) {
            const t = await titel();
            if (!t || /Alles klar/.test(t)) break;
            seiten.push(t);
            // 4. Okt., Markus: "es soll doch erklaert werden, dass man mit Enter auch direkt weiterkommt"
            enterHinweis.push(await page.evaluate(() => { const s = [...document.querySelectorAll('.ab-schritt')].find(x => x.offsetHeight); const tipp = [...s.querySelectorAll('input[type=text],input[type=number],input[type=date],textarea')].some(e => e.offsetHeight); const h = s.querySelector('.ab-enter'); return !tipp || (!!h && !h.classList.contains('hide') && /Eingabetaste/.test(h.textContent)); }));
            const art = await page.evaluate(() => {
              const s = [...document.querySelectorAll('.ab-schritt')].find(x => x.offsetHeight), zu = e => !!(e.offsetWidth || e.offsetHeight);
              if ([...s.querySelectorAll('.drop, input[type=file]')].some(zu)) return 'foto';
              const g = [...s.querySelectorAll('.styles, .sugg.groessen')].filter(zu).pop();
              if (g) { const k = [...g.querySelectorAll('button')].filter(zu).find(x => !x.classList.contains('on') && !x.hasAttribute('data-eigen') && !/Mehr/.test(x.textContent)); if (k) { k.setAttribute('data-abnahme-tipp', '1'); return 'kachel'; } }
              const v = [...s.querySelectorAll('#f-suggest .s')].find(zu); if (v) { v.setAttribute('data-abnahme-tipp', '1'); return 'kachel'; }
              const nl = s.querySelector('.nl-name'); if (nl && zu(nl)) return 'namen';
              if ([...s.querySelectorAll('input[type=text],input[type=number],input[type=date],textarea')].some(zu)) return 'text';
              if ([...s.querySelectorAll('select')].some(zu)) return 'liste';
              if ([...s.querySelectorAll('input[type=checkbox]')].some(zu)) return 'haken';
              return 'nichts';
            });
            if (art === 'foto') { await page.locator('.ab-schritt:visible .ab-weiter').click(); await page.waitForTimeout(500); continue; }
            if (art === 'kachel') await page.locator('[data-abnahme-tipp]').first().click();
            else if (art === 'namen') {
              // 4. Okt.: die Eingabetaste springt in der Namensliste zum naechsten Namen, in der leeren Zeile weiter.
              const h = page.locator('.ab-schritt:visible .nl-name').first(); await h.fill('Oma Inge'); await h.press('Enter'); await page.waitForTimeout(250);
              const naechster = await page.evaluate(() => [...document.querySelectorAll('.nl-name')].indexOf(document.activeElement));
              if (naechster !== 1) stehen.push('Namensliste: Eingabetaste nicht zum naechsten Namen (' + naechster + ')');
              await page.keyboard.press('Enter');
            }
            else if (art === 'text') { const h = page.locator('.ab-schritt:visible :is(input[type=text],input[type=number],input[type=date],textarea):visible').first(); await h.fill(/date/.test(await h.getAttribute('type') || '') ? '2026-10-03' : 'Probe 12'); await h.press('Enter'); }
            else if (art === 'liste') await page.locator('.ab-schritt:visible select:visible').first().selectOption({ index: 1 });
            else if (art === 'haken') await page.locator('.ab-schritt:visible input[type=checkbox]:visible').first().check();
            await page.evaluate(() => document.querySelectorAll('[data-abnahme-tipp]').forEach(x => x.removeAttribute('data-abnahme-tipp')));
            await page.waitForTimeout(800);
            if (await titel() === t) { stehen.push(t + ' (' + art + ')'); await page.locator('.ab-schritt:visible .ab-weiter').click(); await page.waitForTimeout(500); }
          }
          const ende = await titel();
          pruefe(`${g.name}: ${slug} - jede Seite geht nach Tipp, Vorschlag, Eingabetaste oder Haken von selbst weiter, ohne "Weiter", bis "Alles klar?"`,
            /Alles klar/.test(ende) && !stehen.length && seiten.length >= (slug === 'freestyle' ? 2 : 5) && enterHinweis.every(Boolean), JSON.stringify({ stehen, seiten: seiten.length, ende, ohneHinweis: enterHinweis.filter(x => !x).length }));
        }
        // 19. Okt., Markus (Freestyle): "noch dazu ein Foto hochzuladen oder eine Datei, so dass diese geaendert werden
        // kann". Der Foto-Schritt steht vor dem Wunsch (seit 19. Okt. abends), ist freiwillig ("Ohne Foto weiter"), nimmt JPG und SVG an und
        // sagt bei einer PDF ehrlich, warum nicht. Was die Seite zeigt, prueft nur ein Browser.
        {
          await page.goto(base + '/m/freestyle?artikel=kissen', { waitUntil: 'load', timeout: 45000 });
          await page.waitForTimeout(900);
          const titel = () => page.evaluate(() => { const s = [...document.querySelectorAll('.ab-schritt')].find(x => x.offsetHeight); return s ? s.querySelector('.ab-titel').textContent : ''; });
          const weiter = async () => { await page.locator('.ab-schritt:visible .ab-weiter').click(); await page.waitForTimeout(700); };
          const knopf = () => page.locator('.ab-schritt:visible .ab-weiter').innerText();
          const status = () => page.evaluate(() => (document.getElementById('foto-status') || {}).textContent || '');
          await weiter();
          // 19. Okt. abends, Markus: erst das Foto, dann sagen, was daran anders werden soll.
          const f = { titel: await titel(), vorher: await knopf(), waehlen: await page.locator('.ab-schritt:visible label.foto-waehlen').innerText().catch(() => '') };
          const sharp = (await import('sharp')).default;
          await page.setInputFiles('#v_foto', [{ name: 'datei.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF') }]);
          await page.waitForTimeout(1500);
          f.pdf = await status(); f.pdfKnopf = await knopf();
          await page.setInputFiles('#v_foto', [{ name: 'logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#e0673a"/></svg>') }]);
          await page.waitForTimeout(2500);
          f.svg = await status(); f.svgKnopf = await knopf();
          await page.setInputFiles('#v_foto', [{ name: 'hund.jpg', mimeType: 'image/jpeg', buffer: await sharp({ create: { width: 900, height: 700, channels: 3, background: { r: 120, g: 160, b: 210 } } }).jpeg().toBuffer() }]);
          await page.waitForTimeout(2500);
          f.jpg = await status(); f.jpgKnopf = await knopf();
          await weiter();
          f.wunschTitel = await titel();
          await page.locator('.ab-schritt:visible textarea:visible').fill('Mach meinen Hund zum Astronauten');
          await weiter();
          f.ende = await titel();
          f.zusammenfassung = await page.evaluate(() => { const s = [...document.querySelectorAll('.ab-schritt')].find(x => x.offsetHeight); return s ? s.textContent.replace(/\s+/g, ' ') : ''; });
          // 19. Okt., Markus: "nur Teilstuecke aendern" - die Zeile steht unter dem Ergebnis; ohne fertiges Design sagt der Knopf, warum nichts passiert.
          f.aendern = await page.evaluate(() => { const r = document.getElementById('aendern-row'); const inp = document.getElementById('aendern-text'), btn = document.getElementById('aendern-btn'); return { da: !!(r && inp && btn), imErgebnis: !!(r && r.closest('#result')), knopf: btn ? btn.textContent : '' }; });
          await page.evaluate(() => document.getElementById('aendern-btn').click());
          await page.waitForTimeout(300);
          f.aendernOhne = await page.evaluate(() => document.getElementById('status').textContent);
          pruefe(`${g.name}: Freestyle - vor dem Wunsch fragt ein eigener Schritt nach Foto oder Datei ("Ohne Foto weiter"); PDF wird ehrlich abgelehnt, SVG und JPG angenommen, danach fragt der Wunsch-Schritt "an deinem Foto aendern" und die Zusammenfassung sagt "Foto ist da"; unter dem Ergebnis die Zeile "Nur das ändern", die ohne fertiges Design ehrlich antwortet`,
            /Foto oder eine Datei/.test(f.titel) && f.vorher === 'Ohne Foto weiter' && /Foto oder Datei/.test(f.waehlen) && /PDF/.test(f.pdf) && f.pdfKnopf === 'Ohne Foto weiter'
              && /reicht/.test(f.svg) && f.svgKnopf === 'Weiter' && /reicht/.test(f.jpg) && f.jpgKnopf === 'Weiter' && /an deinem Foto/.test(f.wunschTitel) && /Alles klar/.test(f.ende) && /Foto ist da/.test(f.zusammenfassung)
              && f.aendern.da && f.aendern.imErgebnis && f.aendern.knopf === 'Nur das ändern' && /kein fertiges Design/.test(f.aendernOhne),
            JSON.stringify(f).slice(0, 700));
        }
      }
      // 1. Okt., Markus: "uebernehmen" - unter / steht die neue Startseite (home-neu.html). Die
      // Pruefungen der alten Fassung darunter laufen gegen /startseite-alt weiter, solange es sie gibt.
      {
        const roh = await fetch(base + '/').then(r => r.text()).catch(() => '');
        const ras = (roh.match(/<ul class="raster" id="raster">([\s\S]*?)<\/ul>/) || [])[1] || '';
        const htmlKacheln = (ras.match(/<a class="motto/g) || []).length;
        pruefe(`${g.name}: neue Startseite - fuer Google: kein noindex, canonical, strukturierte Daten, Motto-Kacheln schon im HTML (Freestyle zuletzt)`,
          !/name="robots"/.test(roh) && /<link rel="canonical" href="http[^"]*\/">/.test(roh) && /"@type":"Organization"/.test(roh) && !/__[A-Z_]+__/.test(roh)
          && htmlKacheln >= 20 && (ras.match(/href="\/m\/[a-z0-9-]+"/g) || []).pop() === 'href="/m/freestyle"',
          JSON.stringify({ noindex: /name="robots"/.test(roh), platzhalter: (roh.match(/__[A-Z_]+__/) || [])[0] || null, htmlKacheln }));
        await page.goto(base + '/', { waitUntil: 'load', timeout: 45000 });
        await page.waitForTimeout(900);
        const ns = await page.evaluate(() => {
          const sichtbar = el => !!el && el.offsetParent !== null;
          const held = document.querySelector('section.held');
          const los = held ? held.querySelector('a.knopf') : null, zweit = held ? held.querySelector('a.zweit') : null;
          const einzel = [].map.call(document.querySelectorAll('#chips-einzel a'), a => a.getAttribute('href'));
          const navOk = ['/so-gehts', '/firma', '/event', '/konto'].every(h => [].some.call(document.querySelectorAll('a[href="' + h + '"]'), a => sichtbar(a) && a.closest('header')));
          return { h1: (document.querySelector('h1') || {}).textContent || '',
            los: los ? los.getAttribute('href') : '', losSichtbar: sichtbar(los), zweit: zweit ? zweit.getAttribute('href') : '',
            ziele: !!document.getElementById('gruppe') && !!document.getElementById('artikel'),
            keinePostkarte: !document.querySelector('a[href*="gruesse-aus"], a[href*="gutschein"], #pk-bild, #pk-los') && !/Postkarte|Gutschein/.test(document.body.innerText), navOk,
            gruppe: document.querySelectorAll('#chips-gruppe a').length, einzelErst: einzel[0] || '', einzel: einzel.length,
            abstimmen: sichtbar(document.getElementById('abstimmen')) && document.querySelectorAll('#k-mottos a').length > 0,
            kacheln: document.querySelectorAll('#raster > li').length, titel: (document.getElementById('mottos-h') || {}).textContent || '' };
        });
        pruefe(`${g.name}: neue Startseite - Einstieg "Selfie rein ... raus." mit Knopf zu den Shirts und Weg zu Kissen & Co., keine Postkarte und kein Gutschein, Kopf mit So geht's/Firmen/Event/Konto`,
          /Selfie rein/.test(ns.h1) && ns.los === '#gruppe' && ns.losSichtbar && ns.zweit === '#artikel' && ns.ziele && ns.keinePostkarte && ns.navOk, JSON.stringify(ns));
        // 4. Okt., Markus: "wenn die Menschen das auf dem Handy aufmachen, denken sie erst mal nur, dass es
        // nur Postkarten gibt." Laufband unter dem Kopf (Bilder geladen, antippbar, zweite Haelfte nicht
        // im Tab-Weg) und das wechselnde Wort; "Shirt, Tasse & Co." nicht unter den Mottos.
        // 12. Okt.: Postkarte und Gutschein sind nicht mehr Teil von Motto Otto.
        {
          const lb = await page.evaluate(async () => {
            const band = document.querySelector('nav.laufband');
            const echt = band ? [...band.querySelectorAll('ul.lb-liste:not([aria-hidden]) a')] : [];
            const kopie = band ? [...band.querySelectorAll('ul.lb-liste[aria-hidden] a')] : [];
            const bilder = band ? [...band.querySelectorAll('ul.lb-liste:not([aria-hidden]) img')] : [];
            const oben = band ? band.getBoundingClientRect().top : 9999;
            const w = document.getElementById('wort'); const vor = w ? w.textContent : '';
            await new Promise(r => setTimeout(r, 2600));
            return { links: echt.length, ziele: echt.map(a => a.getAttribute('href')), kaputt: bilder.filter(i => !i.complete || !i.naturalWidth).length, bilder: bilder.length,
              kopieOhneTab: kopie.length === echt.length && kopie.every(a => a.tabIndex === -1), oben: Math.round(oben),
              wortVor: vor, wortNach: w ? w.textContent : '', partner: [...document.querySelectorAll('#raster a.motto')].map(a => a.getAttribute('href')).filter(h => /^\/m\/(haus|gutschein|gruesse-aus)$/.test(h)) };
          });
          pruefe(`${g.name}: neue Startseite - Laufband unter dem Kopf (Shirts, Hoodies, Kissen ... mit Bildern, keine Postkarte), Wort in der Ueberschrift wechselt, keine Partner-Mottos in den Kacheln`,
            lb.links >= 8 && lb.bilder >= 6 && lb.kaputt === 0 && lb.kopieOhneTab && lb.oben < 260 && !lb.ziele.some(z => /gruesse-aus|postkarte/.test(z)) && lb.ziele.includes('#gruppe') && lb.ziele.includes('#artikel')
            && lb.wortVor === 'T-Shirt' && lb.wortNach !== 'T-Shirt' && !lb.partner.length, JSON.stringify(lb));
          const api = await fetch(base + '/api/mo/mottos').then(r => r.json()).catch(() => ({ mottos: [] }));
          const sm = await fetch(base + '/sitemap.xml').then(r => r.text()).catch(() => '');
          const weg = { gruesse: await fetch(base + '/m/gruesse-aus', { redirect: 'manual' }).then(r => r.status), gutschein: await fetch(base + '/m/gutschein', { redirect: 'manual' }).then(r => r.status) };
          pruefe(`${g.name}: Shirt, Tasse & Co. steht in keiner Motto-Liste (API, Sitemap) und geht weiter; Postkarte und Gutschein gibt es nicht mehr (keine 200, kein 500)`,
            !api.mottos.some(m => ['haus', 'gutschein', 'gruesse-aus'].includes(m.slug)) && api.mottos.length > 20 && !/\/m\/(haus|gutschein|gruesse-aus)</.test(sm)
            && [weg.gruesse, weg.gutschein].every(s => s !== 200 && s < 500) && (await fetch(base + '/m/haus').then(r => r.status)) === 200,
            JSON.stringify({ api: api.mottos.length, weg }));
        }
        pruefe(`${g.name}: neue Startseite - zwei Tueren (Gruppe / Geschenk, Geburtstag vorn), Abstimmung fuer Gruppen, Kacheln nicht doppelt`,
          ns.gruppe >= 4 && ns.einzelErst === '/m/geburtstag' && ns.einzel >= 3 && ns.abstimmen && ns.kacheln === htmlKacheln && new RegExp('Alle ' + (htmlKacheln - 1) + ' Mottos').test(ns.titel), JSON.stringify(ns));
        // 2. Okt.: Menue in EINER Zeile (vorher stand "Event" allein), Filter ueber den Mottos, Freigabe-Hinweis am Fanclub
        const nf = await page.evaluate(() => {
          const tops = [...new Set([].map.call(document.querySelectorAll('.kopf .nav a'), a => Math.round(a.getBoundingClientRect().top)))];
          const zaehl = () => [].filter.call(document.querySelectorAll('#raster > li'), li => !li.hidden).length;
          const alle = zaehl(); document.querySelector('.filter button[data-filter="gruppe"]').click(); const gruppe = zaehl();
          document.querySelector('.filter button[data-filter="einzeln"]').click(); const einzeln = zaehl();
          document.querySelector('.filter button[data-filter=""]').click();
          return { zeilen: tops.length, alle, gruppe, einzeln, wieder: zaehl(), fan: !!document.querySelector('a[href="/m/fanclub"] .frei-hinweis') };
        });
        pruefe(`${g.name}: neue Startseite - Menue in einer Zeile, Filter Gruppe/Geschenk teilt alle Kacheln, Fanclub zeigt die Freigabe`,
          nf.zeilen === 1 && nf.gruppe > 0 && nf.einzeln > 0 && nf.gruppe + nf.einzeln === nf.alle && nf.wieder === nf.alle && nf.fan, JSON.stringify(nf));
        // Ein Tipp auf eine Motto-Kachel oeffnet das Motto
        const erste = await page.$('#raster a.motto');
        const ziel = erste ? await erste.getAttribute('href') : '';
        if (erste) {
          await erste.scrollIntoViewIfNeeded(); await page.waitForTimeout(400);
          const bx = await erste.boundingBox();
          if (bx) await (touch ? page.touchscreen.tap(bx.x + bx.width / 2, bx.y + bx.height / 2) : page.mouse.click(bx.x + bx.width / 2, bx.y + bx.height / 2));
          await page.waitForURL('**' + ziel, { timeout: 15000 }).catch(() => {});
        }
        pruefe(`${g.name}: neue Startseite - EIN Tipp auf eine Motto-Kachel oeffnet das Motto`, !!ziel && page.url().endsWith(ziel), page.url() + ' (Ziel ' + ziel + ')');
        await page.goto(base + '/', { waitUntil: 'load', timeout: 45000 });
        await page.waitForFunction(() => Array.from(document.querySelectorAll('#raster img')).every(i => i.complete), null, { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(800);
        const kap = await page.evaluate(() => Array.from(document.querySelectorAll('#raster img')).filter(i => i.complete && i.naturalWidth === 0).length);
        pruefe(`${g.name}: neue Startseite - keine kaputten Bildsymbole in den Motto-Kacheln`, kap === 0, kap + ' kaputt');
        const vs = await fetch(base + '/vorschau-start', { redirect: 'manual' }).catch(() => null);
        const vb = await fetch(base + '/startseite/postkarten/grossbuchstaben.webp').catch(() => null);   // 12. Okt.: die Postkarten-Bilder sind weg
        const alt = await fetch(base + '/startseite-alt').then(async r => ({ s: r.status, robots: r.headers.get('x-robots-tag'), meta: /name="robots" content="noindex"/.test(await r.text()) })).catch(() => ({}));
        pruefe(`${g.name}: /vorschau-start leitet auf / (301), keine Postkarten-Bilder mehr unter /startseite/postkarten, alte Fassung unter /startseite-alt mit noindex`,
          !!vs && vs.status === 301 && /\/$/.test(vs.headers.get('location') || '') && !!vb && vb.status === 404 && alt.s === 200 && alt.robots === 'noindex' && alt.meta,
          JSON.stringify({ vorschau: vs && vs.status, ort: vs && vs.headers.get('location'), bild: vb && vb.status, alt }));
        // 1. Okt., Markus: "ein Fleckchen, wo wir rotierende Bilder auf der gleichen Stelle haben. Mit
        // wirklich schoenen Designs." Die Liste ist von Hand (startseite/schaufenster.json); der Server
        // setzt nur ein, was fertig auf der Platte liegt. Ohne Bilder ist der Abschnitt zu - mit Bildern
        // wechselt er von selbst (ausser bei reduzierter Bewegung), und ein Tipp fuehrt aufs Motto.
        {
          let liste = [];
          try { liste = JSON.parse(await (await import('fs/promises')).readFile('startseite/schaufenster.json', 'utf8')).designs || []; } catch (e) { liste = []; }
          // 3. Okt.: ein Eintrag ist eine Nummer ODER ein Design im Repo ({ vorzeige, stil }).
          const ids = liste.map(d => d.id || (d.vorzeige + '/' + d.stil));
          pruefe(`${g.name}: Schaufenster - Liste von Hand mit mindestens 8 verschiedenen Designs`, ids.length >= 8 && new Set(ids).size === ids.length && ids.every(i => /^MO-[A-Z0-9]+-\d{8}-[A-Z0-9]{4}$/.test(i) || /^[a-z0-9-]+\/[a-z]+$/.test(i)), ids.length + ' Eintraege');
          await page.goto(base + '/', { waitUntil: 'load', timeout: 45000 });
          const sf0 = await page.evaluate(() => { const s = document.getElementById('schaufenster'); return { da: !!s, zu: !!s && s.hidden, bilder: document.querySelectorAll('#sf-liste > li').length }; });
          if (!sf0.da || sf0.zu || !sf0.bilder) {
            pruefe(`${g.name}: Schaufenster - ohne fertige Bilder bleibt der Abschnitt zu (kein leerer Rahmen)`, sf0.da && sf0.zu && sf0.bilder === 0, JSON.stringify(sf0));
          } else {
            await page.locator('#sf-liste').scrollIntoViewIfNeeded();
            await page.waitForTimeout(1200);
            const vor = await page.evaluate(() => ({ an: document.querySelectorAll('.sf-bild.an').length, alt: (document.querySelector('.sf-bild.an img') || {}).alt || '',
              geladen: (() => { const i = document.querySelector('.sf-bild.an img'); return !!i && i.complete && i.naturalWidth > 0; })(),
              ziel: (document.querySelector('.sf-bild.an a') || { getAttribute: () => '' }).getAttribute('href') || '',
              still: matchMedia('(prefers-reduced-motion: reduce)').matches, breit: document.documentElement.scrollWidth <= document.documentElement.clientWidth }));
            await page.waitForTimeout(4700);
            const nach2 = await page.evaluate(() => (document.querySelector('.sf-bild.an img') || {}).alt || '');
            pruefe(`${g.name}: Schaufenster - genau ein Design zu sehen, geladen, fuehrt aufs Motto, wechselt von selbst, kein seitliches Scrollen`,
              vor.an === 1 && vor.geladen && /^\/m\/[a-z0-9-]+\?/.test(vor.ziel) && /^Design /.test(vor.alt) && vor.breit && (vor.still || (nach2 && nach2 !== vor.alt)), JSON.stringify({ ...vor, nach: nach2 }));
            if (!vor.still) {
            await page.click('#sf-halt');
            const angehalten = await page.evaluate(() => (document.querySelector('.sf-bild.an img') || {}).alt || '');
            await page.waitForTimeout(4700);
            const stehtNoch = await page.evaluate(() => (document.querySelector('.sf-bild.an img') || {}).alt || '');
            await page.click('#sf-weiter');
            const weiter = await page.evaluate(() => (document.querySelector('.sf-bild.an img') || {}).alt || '');
            pruefe(`${g.name}: Schaufenster - Anhalten haelt an, Weiter blaettert von Hand`, angehalten === stehtNoch && weiter !== stehtNoch, JSON.stringify({ angehalten, stehtNoch, weiter }));
            }
          }
        }
      }

      // Die Kachel: das Erste, was jeder Besucher antippt. Sie muss ein Link sein und
      // tatsaechlich auf die Mottoseite fuehren - mit oder ohne Bild.
      await page.goto(base + '/startseite-alt', { waitUntil: 'load', timeout: 45000 });
      // 12. Okt.: Postkarte und Gutschein sind nicht mehr Teil von Motto Otto. Der Aufmacher traegt nur
      // noch das Saison-Motto, VOR dem Kopf, sichtbar, mit echtem Bild; nirgends ein Weg zur Postkarte.
      const hl = await page.evaluate(() => {
        const sichtbar = el => !!el && el.offsetParent !== null;
        const h = document.querySelector('.aufmacher');
        const hero = document.querySelector('.hero');
        const sa = document.querySelector('a.au-k.au-saison[href^="/m/"]');
        const bilder = h ? [].filter.call(h.querySelectorAll('img'), i => i.complete && i.naturalWidth > 0).length : 0;
        return { da: sichtbar(h), vorKopf: !!(h && hero && h.getBoundingClientRect().top < hero.getBoundingClientRect().top),
          saison: sichtbar(sa), saisonZiel: sa ? sa.getAttribute('href') : null, bilder,
          postkarte: !!document.querySelector('a[href="/postkarte"], a[href*="gruesse-aus"], a[href*="gutschein"], .au-pk') };
      });
      pruefe(`${g.name}: Startseite - das Saison-Motto steht als Aufmacher ueber dem Kopf (sichtbar, echtes Bild), nirgends ein Weg zu Postkarte oder Gutschein`, hl.da && hl.vorKopf && hl.saison && hl.bilder >= 1 && !hl.postkarte, JSON.stringify(hl));
      {
        const r = await fetch(base + '/postkarte', { redirect: 'manual' }).then(x => x.status).catch(() => 0);
        pruefe(`${g.name}: /postkarte gibt es nicht mehr (404, kein 500)`, r === 404, String(r));
      }
      const kacheln = await page.$$('a.mc[href^="/m/"]');
      pruefe(`${g.name}: Startseite hat Anlass-Kacheln`, kacheln.length >= 10, kacheln.length + ' Kacheln');

      // 20. Sept., Markus: Knoepfe "So geht's", "Firmen", "Event" oben auf jedem Geraet; der Ablauf,
      // die Preise und "Gut zu wissen" sind von der Startseite runter und stehen unter /so-gehts.
      const kopf = await page.evaluate(() => {
        const sichtbar = el => !!el && el.offsetParent !== null;
        const nav = [].map.call(document.querySelectorAll('.mo-kopf a'), a => ({ text: a.textContent.trim(), href: a.getAttribute('href'), sichtbar: sichtbar(a) }));
        return { nav, ablauf: sichtbar(document.getElementById('so-gehts')), preise: sichtbar(document.getElementById('preise')), vertrauen: sichtbar(document.querySelector('.vertrauen')), kacheln: sichtbar(document.getElementById('groups')), hoehe: document.documentElement.scrollHeight };
      });
      const hat = (h) => kopf.nav.some(a => a.href === h && a.sichtbar);
      pruefe(`${g.name}: Startseite - Knoepfe "So geht's", "Firmen", "Event", "Konto" oben sichtbar`, hat('/so-gehts') && hat('/firma') && hat('/event') && hat('/konto'), JSON.stringify(kopf.nav));
      pruefe(`${g.name}: Startseite - ohne Ablauf, Preise und "Gut zu wissen", die Kacheln sind da`, !kopf.ablauf && !kopf.preise && !kopf.vertrauen && kopf.kacheln, JSON.stringify({ ablauf: kopf.ablauf, preise: kopf.preise, vertrauen: kopf.vertrauen, kacheln: kopf.kacheln, hoehe: kopf.hoehe }));
      if (kacheln.length) {
        const ziel = await kacheln[0].getAttribute('href');
        await kacheln[0].scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);   // Bild-Lazyload und Scroll-Animation ausklingen lassen
        // Ein Tipp, wie ein Daumen ihn macht. Kommt keine Navigation, ein zweiter - das ist genau
        // die iOS-Falle (erster Tipp = Hover), und sie muss hier auffallen, nicht beim Kunden.
        const seitenFehler = [];
        const merker = (e) => seitenFehler.push(e.message);
        page.on('pageerror', merker);
        // Was liegt unter der Mitte der Kachel? Ein Kopfbalken oder ein Overlay davor wuerde den
        // Klick schlucken - und genau das soll dann im Bericht stehen, nicht "hat nicht geklappt".
        const unterMaus = await page.evaluate((h) => {
          const a = document.querySelector('a.mc[href="' + h + '"]'); if (!a) return 'Kachel fehlt';
          const r = a.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return e ? (e.closest('a.mc') === a ? 'die Kachel selbst' : e.tagName.toLowerCase() + '.' + String(e.className).trim().split(/\s+/)[0]) : 'nichts (ausserhalb des Fensters?)';
        }, ziel);
        let tipps = 0, navigiert = false;
        // Geklickt wird wie ein Mensch: an der Bildschirmstelle, an der die Kachel liegt - mit dem
        // Finger (tap) oder der Maus (mouse.click). elementHandle.click() lieferte am Laptop
        // reproduzierbar keinen Klick, obwohl ein Mausklick an derselben Stelle navigierte
        // (19. Sept., mit Navigations-Mitschnitt gemessen: "Navigationsanfragen: keine").
        // Erst klicken, wenn die Kachel stillsteht: die Bloecke blenden beim Scrollen ein
        // (.rein -> Bewegung), und ein Klick in eine laufende Bewegung ist kein Nutzerklick.
        let box = null, vorherBox = null;
        for (let s = 0; s < 12; s++) {
          box = await kacheln[0].boundingBox();
          if (box && vorherBox && Math.abs(box.y - vorherBox.y) < 0.5 && Math.abs(box.x - vorherBox.x) < 0.5) break;
          vorherBox = box; await page.waitForTimeout(250);
        }
        const mitte = box ? [box.x + box.width / 2, box.y + box.height / 2] : null;
        const verlauf = [];
        for (; tipps < 2 && !navigiert && mitte; tipps++) {
          const t0 = Date.now();
          try { await (touch ? page.touchscreen.tap(mitte[0], mitte[1]) : page.mouse.click(mitte[0], mitte[1])); }
          catch (e) { /* Seite hat schon gewechselt - genau das wollten wir */ }
          for (let w = 0; w < 30 && !navigiert; w++) {
            await page.waitForTimeout(500);
            navigiert = page.url().endsWith(ziel);
            if (w % 4 === 3 && !navigiert) verlauf.push(Math.round((Date.now() - t0) / 1000) + 's:' + page.url().replace(/^https?:\/\/[^/]+/, ''));
          }
        }
        await page.waitForLoadState('load', { timeout: 20000 }).catch(() => {});
        page.off('pageerror', merker);
        pruefe(`${g.name}: EIN Tipp auf eine Kachel oeffnet das Motto`, navigiert && tipps === 1,
          page.url() + (tipps > 1 ? ' · erst nach ' + tipps + ' Tipps · Verlauf nach dem 1. Tipp: ' + verlauf.join(' ') : '') + ' · unter der Maus: ' + unterMaus + (seitenFehler.length ? ' · Skriptfehler: ' + seitenFehler[0].slice(0, 80) : ''));
      }
      // Die beiden neuen Seiten hinter den Knoepfen oben (nach dem Kachel-Tipp, weil der die
      // Startseite verlaesst und die Kachel-Griffe danach nicht mehr gelten).
      await page.goto(base + '/so-gehts', { waitUntil: 'load', timeout: 45000 });
      const sg = await page.evaluate(() => {
        const sichtbar = el => !!el && el.offsetParent !== null;
        return { titel: (document.querySelector('.seitentitel') || {}).textContent || '', ablauf: sichtbar(document.getElementById('so-gehts')), preise: sichtbar(document.getElementById('preise')), vertrauen: sichtbar(document.querySelector('.vertrauen')), hero: sichtbar(document.querySelector('.hero')), kacheln: sichtbar(document.getElementById('groups')), zurueck: !!document.querySelector('a.zurueck[href="/"]') };
      });
      pruefe(`${g.name}: /so-gehts - Ablauf, Preise und "Gut zu wissen", ohne Kopf und Kacheln, mit Weg zurueck`, /geht/.test(sg.titel) && sg.ablauf && sg.preise && sg.vertrauen && !sg.hero && !sg.kacheln && sg.zurueck, JSON.stringify(sg));
      // 22. Sept., Markus: "oben noch einen Reiter, mit allen Mottos, wo dann einfach nur alle
      // Mottos aufgehen, schoen uebersichtlich." Reiter "Alle Mottos" fuehrt auf /mottos: nur die
      // Kacheln in ihren Gruppen, kein Kopf, kein Band, kein Ablauf, keine Preise.
      await page.goto(base + '/mottos', { waitUntil: 'load', timeout: 45000 });
      const am = await page.evaluate(() => {
        const sichtbar = el => !!el && el.offsetParent !== null;
        const sichtbareTitel = [...document.querySelectorAll('.seitentitel')].filter(sichtbar).map(e => e.textContent.trim());
        return { titel: sichtbareTitel.join(' | '), doc: document.title, reiter: !!document.querySelector('.mo-kopf a[href="/mottos"]'), kacheln: sichtbar(document.getElementById('groups')), anzahl: [...document.querySelectorAll('a.mc[href^="/m/"]')].filter(sichtbar).length, gruppen: [...document.querySelectorAll('#groups .grp h3')].filter(sichtbar).length, hero: sichtbar(document.querySelector('.hero')), band: sichtbar(document.getElementById('werkbank')), ablauf: sichtbar(document.getElementById('so-gehts')), preise: sichtbar(document.getElementById('preise')), highlight: sichtbar(document.getElementById('postkarte')), zurueck: !!document.querySelector('a.zurueck[href="/"]') };
      });
      pruefe(`${g.name}: /mottos (Reiter "Alle Mottos") - nur die Kacheln aller Mottos in ihren Gruppen, ohne Kopf, Band, Ablauf und Preise`, /Mottos/.test(am.titel) && /Alle Mottos/.test(am.doc) && am.reiter && am.kacheln && am.anzahl >= 20 && am.gruppen >= 3 && !am.hero && !am.band && !am.ablauf && !am.preise && !am.highlight && am.zurueck, JSON.stringify(am));
      await page.goto(base + '/event', { waitUntil: 'load', timeout: 45000 });
      const ev = await page.evaluate(() => ({ h1: (document.querySelector('h1') || {}).textContent || '', mail: !!document.querySelector('a[href^="mailto:otto@motto-otto.de"]'), zurueck: !!document.querySelector('a[href="/"]') }));
      pruefe(`${g.name}: /event - Erklaerung mit Kontakt und Weg zurueck`, /Event/.test(ev.h1) && ev.mail && ev.zurueck, JSON.stringify(ev));
      // 19. Sept., Markus: "Wenn da jemand drauf klickt, muss er genau auf dieses Produkt kommen."
      // Die Kachel-Adresse traegt Stil, Farbe und Teil - die Mottoseite muss sie auch umsetzen.
      await page.goto(base + '/m/abi?stil=aquarell&textil=hell&teil=kissen', { waitUntil: 'load', timeout: 45000 });
      await page.waitForTimeout(1500);
      const vorbelegt = await page.evaluate(() => ({
        stil: (document.querySelector('#styles button.on') || {}).dataset ? document.querySelector('#styles button.on').dataset.s : '',
        textil: (document.querySelector('#textiles button.on') || {}).dataset ? document.querySelector('#textiles button.on').dataset.x : ''
      }));
      pruefe(`${g.name}: Kachel-Adresse belegt den Stil vor`, vorbelegt.stil === 'aquarell', 'gewaehlt: ' + (vorbelegt.stil || '(nichts)'));
      // 26. Sept.: Es gibt wieder alle vier Kacheln, die Adresse wird also unveraendert
      // uebernommen - hell bleibt hell. Die Gegenprobe steht gleich darunter, sonst wuerde
      // eine Kachel, die immer anspringt, unbemerkt durchgehen.
      pruefe(`${g.name}: Kachel-Adresse belegt die Textilfarbe vor`, vorbelegt.textil === 'hell', 'gewaehlt: ' + (vorbelegt.textil || '(nichts)'));
      await page.goto(base + '/m/abi?stil=aquarell&textil=dunkel', { waitUntil: 'load', timeout: 45000 });
      await page.waitForTimeout(1200);
      const dunkelVor = await page.evaluate(() => {
        const b = document.querySelector('#textiles button.on');
        return b ? b.dataset.x : '';
      });
      pruefe(`${g.name}: Kachel-Adresse mit dunklem Textil waehlt die dunkle Kachel`, dunkelVor === 'dunkel', 'gewaehlt: ' + (dunkelVor || '(nichts)'));
      // 20. Sept., Markus: "Das muessten wir bei allen Themen, bei jedem Motto, ueberall genauso
      // machen." Abi ohne eigenen Eintrag: die Standard-Abfolge - erst das Motto mit Vorschlaegen,
      // alles andere zu; ohne Motto kein Weiter; mit Motto bis zur Zusammenfassung mit Start-Knopf.
      const abiLage = () => page.evaluate(() => {
        const on = document.querySelector('.ab-schritt.on');
        const sichtbar = id => { const el = document.getElementById(id); return !!el && el.offsetParent !== null; };
        return { schritte: [].map.call(document.querySelectorAll('.ab-schritt'), s => s.getAttribute('data-schritt')), aktiv: on ? on.getAttribute('data-schritt') : '', titel: on ? on.querySelector('.ab-titel').textContent : '',
          motto: sichtbar('v_motto'), vorschlaege: sichtbar('f-suggest'), namen: sichtbar('nl_namen'), stil: sichtbar('styles'), textil: sichtbar('textiles'), go: sichtbar('go') ? (document.getElementById('go').disabled ? 'aus' : document.getElementById('go').textContent) : '',
          fehlt: on && on.querySelector('.ab-fehlt') ? on.querySelector('.ab-fehlt').textContent : '', stileSichtbar: [].filter.call(document.querySelectorAll('#styles button[data-s]'), b => !b.classList.contains('hide')).length };
      });
      let al = await abiLage();
      pruefe(`${g.name}: Abi - Standard-Abfolge: Motto mit Vorschlaegen zuerst, Namen, Textil und Stil noch zu`, al.schritte.join(',') === 'feld_motto,feld_namen,optional,optional-schule,optional-ort,optional-jahr,optional-rueckseite,optional-extra,textil,stil,aufteilung,groesse,fein,fein-farben,fein-schrift,fein-namen,los' && al.aktiv === 'feld_motto' && al.titel === 'Abi-Motto' && al.motto && al.vorschlaege && !al.namen && !al.stil && !al.textil, JSON.stringify({ schritte: al.schritte, aktiv: al.aktiv, motto: al.motto, vorschlaege: al.vorschlaege, namen: al.namen, stil: al.stil }));
      await page.click('.ab-schritt.on .ab-weiter'); await page.waitForTimeout(200); al = await abiLage();
      pruefe(`${g.name}: Abi - ohne Motto kein Weiter`, al.aktiv === 'feld_motto' && /Abi-Motto/.test(al.fehlt), al.fehlt);
      await page.fill('#v_motto', 'ABIkalypse'); await page.waitForTimeout(150);
      // 21. Sept., 08:20, Markus: "jeder Schritt anwaehlbar, dann auf Weiter, und eine Erklaerung,
      // wenn optional ist, dass es auch leer bleiben kann." Was gewaehlt ist, steht sofort da;
      // der freiwillige Schritt sagt es und laesst ohne Angabe weiter.
      const gewaehlt = await page.evaluate(() => (document.querySelector('.ab-schritt.on .ab-gewaehlt') || {}).textContent || '');
      pruefe(`${g.name}: Abi - was getippt ist, steht sofort als "Gewaehlt" unter dem Schritt`, /ABIkalypse/.test(gewaehlt), gewaehlt);
      let freiwillig = null, neueSeite = null;
      // 3. Okt.: eine Seite je Frage - es sind mehr, aber jede ist klein.
      for (let i = 0; i < 20; i++) {
        al = await abiLage(); if (al.aktiv === 'los') break;
        if (al.aktiv === 'optional') freiwillig = await page.evaluate(() => { const on = document.querySelector('.ab-schritt.on'); const op = on.querySelector('.ab-optional'); return { hinweis: op && op.offsetParent !== null ? op.textContent : '', knopf: on.querySelector('.ab-weiter').textContent }; });
        if (al.aktiv === 'optional-ort') neueSeite = await page.evaluate(() => { const on = document.querySelector('.ab-schritt.on'); const a = document.activeElement; return { y: Math.round(scrollY), fokus: a ? a.id : '', taste: a ? a.getAttribute('enterkeyhint') : '', fragen: [...on.querySelectorAll('.ab-inhalt input:not([type=hidden]), .ab-inhalt textarea')].filter(e => e.offsetParent).length }; });
        await page.click('.ab-schritt.on .ab-weiter'); await page.waitForTimeout(200);
      }
      // 3. Okt., Markus: "eingetippt, naechste Seite geht auf". Jede Seite eine Frage, oben, der Cursor schon im Feld.
      pruefe(`${g.name}: Abi - nach Weiter ist die naechste Seite eine einzige Frage, oben, Cursor im Feld, Taste "Weiter"`,
        !!neueSeite && neueSeite.y === 0 && neueSeite.fokus === 'v_ort' && neueSeite.taste === 'next' && neueSeite.fragen === 1, JSON.stringify(neueSeite));
      pruefe(`${g.name}: Abi - der freiwillige Schritt sagt, dass er leer bleiben darf, der Knopf heisst "Ohne Angabe weiter"`, !!freiwillig && /leer bleiben/.test(freiwillig.hinweis) && /Ohne Angabe weiter/.test(freiwillig.knopf), JSON.stringify(freiwillig));
      al = await abiLage();
      pruefe(`${g.name}: Abi - mit Motto bis zur Zusammenfassung, "Otto starten" frei, vier Stile sichtbar`, al.aktiv === 'los' && /Otto starten/.test(al.go) && al.stileSichtbar === 4, JSON.stringify({ aktiv: al.aktiv, go: al.go, stile: al.stileSichtbar, fehlt: al.fehlt }));
      await page.goto(base + '/m/freestyle?artikel=kissen', { waitUntil: 'load', timeout: 45000 });
      let artikelWert = '';
      for (let i = 0; i < 20 && artikelWert !== 'kissen'; i++) { await page.waitForTimeout(300); artikelWert = await page.evaluate(() => (document.querySelector('#v_artikel') || {}).value || ''); }
      pruefe(`${g.name}: Format-Kachel waehlt den Artikel bei Otto Freestyle vor`, artikelWert === 'kissen', 'gewaehlt: ' + (artikelWert || '(nichts)'));
      const fl = await page.evaluate(() => { const on = document.querySelector('.ab-schritt.on'); const s = id => { const el = document.getElementById(id); return !!el && el.offsetParent !== null; }; return { aktiv: on ? on.getAttribute('data-schritt') : '', artikel: s('v_artikel'), motiv: s('v_motiv') }; });
      pruefe(`${g.name}: Freestyle - Standard-Abfolge beginnt mit "Worauf soll es?", das Motiv kommt danach`, fl.aktiv === 'artikel' && fl.artikel && !fl.motiv, JSON.stringify(fl));
      // Ohne Artikel geht es nicht weiter - der Kissen-Wunsch aus der Kachel ist schon gesetzt, also weiter zum Motiv
      await page.click('.ab-schritt.on .ab-weiter'); await page.waitForTimeout(250);
      const fl2 = await page.evaluate(() => { const on = document.querySelector('.ab-schritt.on'); return { aktiv: on ? on.getAttribute('data-schritt') : '', fehlt: on && on.querySelector('.ab-fehlt') ? on.querySelector('.ab-fehlt').textContent : '' }; });
      // 19. Okt. abends, Markus: erst das Foto, dann der Wunsch - nach dem Artikel kommt der freiwillige Foto-Schritt.
      pruefe(`${g.name}: Freestyle - mit gewaehltem Artikel geht es weiter (zum freiwilligen Foto-Schritt, danach das Motiv)`, fl2.aktiv === 'feld_foto' && !fl2.fehlt, JSON.stringify(fl2));
      // 21. Sept., Markus: Stil-Kacheln als Schrift im eigenen Stil (stile/kacheln), "Wie vorgesehen" weg, Robotic dabei
      const stk = await page.evaluate(() => {
        const b = [].slice.call(document.querySelectorAll('#styles button[data-s]'));
        return { keys: b.map(x => x.dataset.s), kacheln: b.filter(x => x.querySelector('img') && /\/api\/mo\/stil-kachel\//.test(x.querySelector('img').getAttribute('src'))).length };
      });
      pruefe(`${g.name}: Freestyle - Stil-Kacheln als Schrift im Stil, ohne "Wie vorgesehen", mit Robotic`, !stk.keys.includes('standard') && stk.keys.includes('robotic') && stk.keys.includes('neon') && stk.kacheln === stk.keys.length, JSON.stringify(stk));
      const kachelAntwort = await page.evaluate(async () => { const r = await fetch('/api/mo/stil-kachel/neon.jpg'); return { status: r.status, typ: r.headers.get('content-type') }; });
      pruefe(`${g.name}: Stil-Kachel Neon wird ausgeliefert`, kachelAntwort.status === 200 && /image\/jpeg/.test(kachelAntwort.typ), JSON.stringify(kachelAntwort));
      // 21. Sept., 08:15, Markus: "die Kacheln fuer die Mottos keine Textilien, sondern einfach das
      // Motto cool in die Kachel bringen." Auf der Startseite zeigt jede Anlass-Kachel die Schrift-Kachel.
      await page.goto(base + '/startseite-alt', { waitUntil: 'load', timeout: 45000 });
      const mkk = await page.evaluate(async () => {
        const imgs = [].slice.call(document.querySelectorAll('.mc img'));
        const r = await fetch('/api/mo/motto-kachel/abi.jpg');
        return { n: imgs.length, kacheln: imgs.filter(i => /\/api\/mo\/motto-kachel\//.test(i.getAttribute('src'))).length, status: r.status, typ: r.headers.get('content-type') };
      });
      pruefe(`${g.name}: Startseite - jede Anlass-Kachel zeigt den Mottonamen als Schrift-Kachel, kein Textil`, mkk.n >= 20 && mkk.kacheln === mkk.n && mkk.status === 200 && /image\/jpeg/.test(mkk.typ), JSON.stringify(mkk));
      // 20. Sept., Markus mit Screenshot vom Baby-Motto: "Bei Geburt?" - in der Abfolge standen
      // "Eingearbeitet/Original" und "Zweites Logo (Co-Branding)". Das Foto als Vorlage ist kein
      // Logo: der Schritt heisst wie der Upload, Logo-Art und zweites Logo bleiben zu.
      await page.goto(base + '/m/geburt-baby', { waitUntil: 'load', timeout: 45000 });
      await page.waitForTimeout(600);
      const gb = await page.evaluate(() => {
        const s = id => { const el = document.getElementById(id); return !!el && el.offsetParent !== null; };
        const logo = document.querySelector('.ab-schritt[data-schritt="logo"]');
        return { schritt: !!logo, titel: logo ? logo.querySelector('.ab-titel').textContent : '', logoart: s('f-logoart'), upload2: s('f-upload2'),
          logoartZu: !!document.getElementById('f-logoart') && document.getElementById('f-logoart').classList.contains('hide'),
          upload2Zu: !!document.getElementById('f-upload2') && document.getElementById('f-upload2').classList.contains('hide') };
      });
      pruefe(`${g.name}: Geburt/Baby - Foto-Schritt heisst nach dem Upload, Logo-Art und zweites Logo bleiben zu`, gb.schritt && /Foto/.test(gb.titel) && !/Logo/.test(gb.titel) && gb.logoartZu && gb.upload2Zu && !gb.logoart && !gb.upload2, JSON.stringify(gb));
      // 2. Okt., Markus: "noch ein Feld dazu packen mit freier Groessenauswahl, ganz wichtig". Eigener
      // Schritt mit Kacheln; der Kasten heisst f-druckmass, weil f_groesse beim Baby das Feld "Groesse"
      // ist (vorher zwei gleiche Kennungen - die Seite fand immer das Babyfeld).
      const gr = await page.evaluate(() => {
        const k = t => [].find.call(document.querySelectorAll('#groesse-vorschlaege .s'), b => b.textContent.indexOf(t) === 0);
        const on = () => [].map.call(document.querySelectorAll('#groesse-vorschlaege .s.on b'), b => b.textContent.replace(' ✓', ''));
        const em = () => getComputedStyle(document.getElementById('eigenmass')).display;
        const r = { schritt: !!document.querySelector('.ab-schritt[data-schritt="groesse"]'), kaesten: document.querySelectorAll('#f-druckmass').length, babyFeld: document.querySelectorAll('#f_groesse').length, kacheln: document.querySelectorAll('#groesse-vorschlaege .s').length, anfang: on().join(), eigenZu: em() };
        k('Streifen').click(); r.streifen = document.getElementById('v_breite').value + 'x' + document.getElementById('v_hoehe').value + ' ' + on().join();
        k('Eigene').click(); r.eigen = on().join() + ' ' + em();
        k('Standard').click(); r.standard = (document.getElementById('v_breite').value || '-') + ' ' + on().join() + ' ' + em();
        return r;
      });
      pruefe(`${g.name}: Groesse - eigener Schritt mit sieben Kacheln, Streifen setzt 25 x 10, "Eigene Groesse" oeffnet Breite x Hoehe, Babyfeld getrennt`,
        gr.schritt && gr.kaesten === 1 && gr.babyFeld === 1 && gr.kacheln === 7 && gr.anfang === 'Standard' && gr.eigenZu === 'none'
          && gr.streifen === '25x10 Streifen' && gr.eigen === 'Eigene Größe flex' && gr.standard === '- Standard none', JSON.stringify(gr));

      await page.goto(base + '/startseite-alt', { waitUntil: 'load', timeout: 45000 });
      await page.waitForTimeout(800);
      // Die Reihe "Fuer jeden Artikel ein eigenes Design" zeigt entweder echte Designs (a.sk, mit
      // Stil/Farbe/Teil in der Adresse) oder - solange keine vier fertig sind - die Formate
      // (a.fk, mit Artikel in der Adresse). In beiden Faellen muss JEDE Kachel ein Link mit Ziel sein.
      const reihe = await page.evaluate(() => ({
        worauf: !!document.getElementById('worauf'),
        sk: document.querySelectorAll('#worauf a.sk').length, skZiel: document.querySelectorAll('#worauf a.sk[href*="?stil="][href*="&teil="]').length,
        fk: document.querySelectorAll('#worauf a.fk').length, fkZiel: document.querySelectorAll('#worauf a.fk[href^="/m/freestyle?artikel="]').length,
        stumm: document.querySelectorAll('#worauf .sk:not(a), #worauf .fk:not(a)').length
      }));
      if (!reihe.worauf) hinweis(`${g.name}: Reihe "Fuer jeden Artikel" nicht auf der Seite (keine Designs, keine Formate)`);
      else pruefe(`${g.name}: jede Kachel der Reihe ist ein Link mit genauem Ziel`, reihe.stumm === 0 && reihe.sk === reihe.skZiel && reihe.fk === reihe.fkZiel && (reihe.sk + reihe.fk) >= 3,
        `${reihe.sk} Design-Kacheln (${reihe.skZiel} mit Ziel) · ${reihe.fk} Format-Kacheln (${reihe.fkZiel} mit Ziel) · ${reihe.stumm} ohne Link`);
      // 6. Okt., Markus (Kissen gewaehlt, dann "Fuer welches Textil?" und "Brust klein"): "Was sollen denn diese
      // schwachsinnigen Fragen?" - und: bei jedem Artikel die Moeglichkeit, einfach nur einzusprechen.
      await page.goto(base + '/m/familie?artikel=kissen', { waitUntil: 'load', timeout: 45000 });
      await page.waitForSelector('#art-einsprechen', { timeout: 8000 }).catch(() => {});
      const ki = await page.evaluate(() => {
        const zu = id => { const e = document.getElementById(id); return !e || e.classList.contains('hide'); };
        const a = document.getElementById('art-einsprechen-los');
        return { kasten: !!document.getElementById('art-einsprechen'), link: a ? a.getAttribute('href') : '', textilZu: zu('f-textile'), groesseZu: zu('f-druckmass') };
      });
      pruefe(`${g.name}: Kissen aus der Galerie - keine Textil- und keine Groessenfrage, Kasten "Einfach einsprechen" fuehrt zu Freestyle mit Kissen`, ki.kasten && ki.link === '/m/freestyle?artikel=kissen' && ki.textilZu && ki.groesseZu, JSON.stringify(ki));
      await page.goto(base + '/m/familie?artikel=tshirt', { waitUntil: 'load', timeout: 45000 });
      await page.waitForTimeout(1200);
      const ts = await page.evaluate(() => ({ kasten: !!document.getElementById('art-einsprechen'), groesse: !!document.getElementById('f-druckmass') && !document.getElementById('f-druckmass').classList.contains('hide') }));
      pruefe(`${g.name}: T-Shirt-Link - Groessenfrage bleibt, kein Artikel-Kasten`, !ts.kasten && ts.groesse, JSON.stringify(ts));
      // 6. Okt., Markus: "Dialog, so dass Otto in der Sprechblase Dinge abfragt ... per Sprachbefehl bis zur Bestellung".
      // Gespraech an: Otto unten mit Sprechblase, fragt den Schritt ab; "zurueck"/"weiter" steuern die Abfolge; ein Foto-Wunsch
      // ergibt den grossen Knopf "Foto waehlen" (Browser oeffnen Dateien nur nach einem Tipp).
      // 7. Okt., Markus: "Das mit dem Einsprechen nur beim Einstieg oben" - kein schwebender Knopf mehr; das Gespraech laeuft hier
      // weiter, wenn es oben begonnen wurde (Sitzung mo_gespraech bzw. ?gespraech=1).
      await page.goto(base + '/m/familie?gespraech=1', { waitUntil: 'load', timeout: 45000 });
      await page.waitForTimeout(1800);
      const knopfWeg = await page.evaluate(() => { const k = document.getElementById('og-start'); return !k || getComputedStyle(k).display === 'none'; });
      pruefe(`${g.name}: kein schwebender "Mit Otto sprechen"-Knopf auf der Mottoseite`, knopfWeg);
      const og = await page.evaluate(async () => {
        const G = window.MoGespraech; if (!G) return { da: false };
        const vorher = G.lage(), frage = (document.getElementById('og-frage') || {}).textContent || '';
        const els = G.sammeln().elemente, foto = els.find(e => e.tipp);
        if (foto) G.ausfuehren([{ art: 'klick', ziel: foto.id }]);
        const tipp = !!document.getElementById('og-tipp');
        G.verarbeiten('weiter'); await new Promise(r => setTimeout(r, 900));
        const nachWeiter = G.lage();
        G.verarbeiten('zurück'); await new Promise(r => setTimeout(r, 900));
        return { da: true, sichtbar: !!document.querySelector('#og.an'), vorher: vorher.schluessel, frage, tipp, nachWeiter: nachWeiter.id, zurueck: G.lage().id };
      });
      pruefe(`${g.name}: Gespraech mit Otto - Blase fragt den Schritt ab, Foto ergibt den Tipp-Knopf, "weiter" und "zurück" steuern die Abfolge`,
        og.da && og.sichtbar && og.vorher === 'foto' && /Foto/.test(og.frage) && og.tipp && og.nachWeiter !== 'feld_foto' && og.zurueck === 'feld_foto', JSON.stringify(og));
      await page.evaluate(() => { try { sessionStorage.removeItem('mo_gespraech'); window.MoGespraech.aus(); } catch (e) { /* egal */ } });
      // 12. Okt.: Postkarte und Gutschein sind nicht mehr Teil von Motto Otto. Was die Postkarten-Abfolge
      // fuer jede Mottoseite mitgeprueft hat (Zurueck-Knopf des Browsers, neue Fassung der Seite), laeuft
      // jetzt auf einem Gruppen-Motto.
      {
        await page.goto(base + '/m/abschlussfahrt', { waitUntil: 'load', timeout: 45000 });
        await page.waitForTimeout(900);
        const schritt = () => page.evaluate(() => { const on = document.querySelector('.ab-schritt.on'); return on ? on.getAttribute('data-schritt') : ''; });
        const erster = await schritt();
        await page.click('.ab-schritt.on .ab-weiter'); await page.waitForTimeout(400);
        const zweiter = await schritt();
        await page.evaluate(() => history.back()); await page.waitForTimeout(500);
        const zurueck = await schritt();
        pruefe(`${g.name}: Abfolge - der Zurueck-Knopf des Browsers geht einen Schritt zurueck, nicht aus der Seite`,
          !!erster && !!zweiter && zweiter !== erster && zurueck === erster && /\/m\/abschlussfahrt/.test(page.url()), JSON.stringify({ erster, zweiter, zurueck, url: page.url() }));
        // 27. Sept., Markus, kurz nach einem Deploy: sein Reiter lief noch mit dem Skript von VOR dem Deploy.
        // Die Seite fragt beim Zurueckkommen nach der Fassung: ist schon ein Foto angenommen, nur der Hinweis
        // mit Knopf; auf einer frischen Seite laedt sie sich selbst neu.
        const fassungAntwort = await fetch(base + '/api/mo/fassung');
        const fassung = await fassungAntwort.json().catch(() => ({}));
        const eigene = await page.evaluate(() => { const sk = document.querySelector('script[src*="motto-seite.js?v="]'); const m = sk && /[?&]v=([^&]+)/.exec(sk.getAttribute('src')); return m ? m[1] : ''; });
        const seiteKopf = await fetch(base + '/m/abschlussfahrt', { method: 'GET' });
        pruefe(`${g.name}: /api/mo/fassung nennt die Fassung der Seite (ohne Speicher), und die Mottoseite selbst fragt immer beim Server nach`,
          fassung.v && fassung.v === eigene && /no-store/.test(fassungAntwort.headers.get('cache-control') || '') && /no-cache/.test(seiteKopf.headers.get('cache-control') || ''),
          JSON.stringify({ v: fassung.v, eigene, kopf: fassungAntwort.headers.get('cache-control'), seite: seiteKopf.headers.get('cache-control') }));
        await page.setInputFiles('#v_foto', [{ name: 'gruppe.jpg', mimeType: 'image/jpeg', buffer: await (await import('sharp')).default({ create: { width: 900, height: 700, channels: 3, background: { r: 120, g: 160, b: 210 } } }).jpeg().toBuffer() }]);
        await page.waitForFunction(() => !document.getElementById('f-figuren').classList.contains('hide'), null, { timeout: 15000 }).catch(() => {});
        await page.route('**/api/mo/fassung', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ v: 'anders' }) }));
        await page.evaluate(() => { window.__moMarke = 1; document.dispatchEvent(new Event('visibilitychange')); });
        await page.waitForTimeout(700);
        const hinweis = await page.evaluate(() => ({ marke: !!window.__moMarke, hinweis: !!document.getElementById('neue-fassung') && document.getElementById('neue-fassung').offsetParent !== null, knopf: !!document.getElementById('neue-fassung-btn') }));
        pruefe(`${g.name}: neue Fassung, aber ein Foto ist schon da - kein Neuladen, nur der Hinweis "Seite neu laden"`, hinweis.marke && hinweis.hinweis && hinweis.knopf, JSON.stringify(hinweis));
        await page.goto(base + '/m/abschlussfahrt', { waitUntil: 'load', timeout: 45000 });
        await page.evaluate(() => { window.__moMarke = 1; document.dispatchEvent(new Event('visibilitychange')); });
        await page.waitForFunction(() => !window.__moMarke, null, { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(300);
        const neu = await page.evaluate(() => ({ marke: !!window.__moMarke, ersterOffen: !!document.querySelector('.ab-schritt.on[data-schritt="feld_foto"]') }));
        pruefe(`${g.name}: neue Fassung auf einer frischen Seite - sie laedt sich selbst neu und steht wieder am Anfang`, !neu.marke && neu.ersterOffen, JSON.stringify(neu));
        await page.unroute('**/api/mo/fassung');
      }
      // 26. Sept., Markus: "Wenn jemand ein Foto hochlaedt, sollten wir schon erkennen koennen, dass
      // auch ein Mensch da drauf ist oder ein Tier." Hier laeuft der Pruefserver OHNE Sehmodell -
      // und genau das ist die wichtigere Haelfte der Regel: ohne Modell wird nichts abgelehnt.
      // Die Entscheidung selbst (mit Antwort des Modells) prueft Abschnitt 9 ohne Netz.
      if (g.name === 'Laptop') {
        const graues = await (async () => {
          const sharp = (await import('sharp')).default;
          const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900"><rect width="1200" height="900" fill="#dddddd"/><text x="60" y="200" font-size="64" fill="#333">Rechnung 2026-0815</text></svg>';
          return (await sharp(Buffer.from(svg)).png().toBuffer()).toString('base64');
        })();
        const r = await fetch(base + '/api/mo/foto', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ dataUrl: 'data:image/png;base64,' + graues, slug: 'abschlussfahrt' })
        });
        const j = await r.json().catch(() => ({}));
        pruefe(`${g.name}: Foto-Upload - ohne Sehmodell wird KEIN Foto abgelehnt (der Kunde bleibt nie ohne Grund stehen)`,
          r.status === 200 && !!j.fotoSitzung, 'HTTP ' + r.status + ' ' + JSON.stringify(j).slice(0, 120));
      }
      // 12. Okt.: die Wappen-Erklaerung gehoerte zur Postkarte und ist mit ihr gegangen.
      if (g.name === 'Laptop') {
        const w = { seite: await fetch(base + '/wappen').then(r => r.status), api: await fetch(base + '/api/mo/wappen', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).then(r => r.status) };
        pruefe(`${g.name}: /wappen und /api/mo/wappen gibt es nicht mehr (404)`, w.seite === 404 && w.api === 404, JSON.stringify(w));
      }
      // 19. Sept.: Falsche Adresse -> eine Seite mit Weg zurueck, kein nacktes "Cannot GET".
      const r404 = await page.goto(base + '/diese-seite-gibt-es-nicht', { waitUntil: 'load', timeout: 45000 });
      const zurueck = await page.evaluate(() => !!document.querySelector('a[href="/"]') && /nicht/i.test(document.body.textContent));
      pruefe(`${g.name}: falsche Adresse zeigt eine 404-Seite mit Weg zur Startseite`, r404 && r404.status() === 404 && zurueck, 'HTTP ' + (r404 ? r404.status() : 0));

      // 19. Sept.: Pfeile an der Reihe - mit Maus ja (wenn sie ueberlaeuft), auf Touch nein (dort wischt man).
      await page.goto(base + '/startseite-alt', { waitUntil: 'load', timeout: 45000 });
      await page.waitForTimeout(800);
      const pf = await page.evaluate(() => { const band = document.querySelector('.sk-band, .fk-band'); return { band: !!band, laeuftUeber: band ? band.scrollWidth > band.clientWidth + 8 : false, pfeile: document.querySelectorAll('.band-nav button').length }; });
      if (pf.band) {
        if (g.name === 'Laptop') {
          pruefe(`${g.name}: Reihe hat Pfeile, wenn sie ueberlaeuft`, !pf.laeuftUeber || pf.pfeile === 2, (pf.laeuftUeber ? 'laeuft ueber' : 'passt') + ' · ' + pf.pfeile + ' Pfeile');
          // Und einmal ERZWUNGEN: schmales Fenster mit Maus (kleiner Laptop) - dann muss die Reihe
          // ueberlaufen und die Pfeile muessen da sein und blaettern.
          await page.setViewportSize({ width: 640, height: 800 });
          await page.reload({ waitUntil: 'load', timeout: 45000 }); await page.waitForTimeout(800);
          const eng = await page.evaluate(() => { const band = document.querySelector('.sk-band, .fk-band'); return { ueber: band ? band.scrollWidth > band.clientWidth + 8 : false, pfeile: document.querySelectorAll('.band-nav button').length }; });
          let geblaettert = false;
          if (eng.pfeile === 2) {
            await page.click('.band-nav button:last-child'); await page.waitForTimeout(700);
            geblaettert = await page.evaluate(() => document.querySelector('.sk-band, .fk-band').scrollLeft > 50);
          }
          pruefe(`${g.name} (schmal, 640 px): Reihe laeuft ueber, hat zwei Pfeile, und der Pfeil blaettert`, eng.ueber && eng.pfeile === 2 && geblaettert, JSON.stringify(eng) + (geblaettert ? ' · geblaettert' : ''));
          await page.setViewportSize({ width: 1280, height: 720 });
        } else pruefe(`${g.name}: keine Pfeile auf Touch (dort wischt man)`, pf.pfeile === 0, pf.pfeile + ' Pfeile');
      }
      // Ohne Bild bleibt der Buchstabe stehen - aber NIE das kaputte Bildsymbol des Browsers.
      await page.goto(base + '/startseite-alt', { waitUntil: 'load', timeout: 45000 });
      // 19. Sept., 12:00, GitHub-Lauf 7: hier stand am Laptop "1 Bilder haengen als kaputtes
      // Symbol" - und im naechsten Lauf nicht mehr. Die Kachelbilder laden verzoegert
      // (loading="lazy"), und ein Bild, das gerade gescheitert ist, gilt fuer den Browser schon
      // als "complete" mit Breite 0, BEVOR sein error-Ereignis (und damit das onerror, das es
      // wegraeumt) ausgeliefert ist. Dazwischen liegen Millisekunden, und genau da hat die
      // Messung hineingegriffen. Deshalb: erst warten, bis alle Bilder entschieden sind, dem
      // Wegraeumen einen Moment lassen, dann zaehlen - und nur melden, was auch bei einer
      // zweiten Sicht noch da haengt.
      const kaputteZaehlen = () => page.evaluate(() => Array.from(document.querySelectorAll('a.mc img')).filter(i => i.complete && i.naturalWidth === 0).length);
      await page.waitForFunction(() => Array.from(document.querySelectorAll('a.mc img')).every(i => i.complete), null, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(500);
      let kaputt = await kaputteZaehlen();
      if (kaputt) { await page.waitForTimeout(1500); kaputt = await kaputteZaehlen(); }
      pruefe(`${g.name}: keine kaputten Bildsymbole auf der Startseite`, kaputt === 0, kaputt ? kaputt + ' Bilder haengen als kaputtes Symbol im Dokument' : 'fehlende Bilder raeumen sich selbst weg');
      await ctx.close();
    }
  } catch (e) {
    pruefe('Browser-Abnahme laeuft durch', false, String(e && e.message || e).slice(0, 300));
  } finally {
    if (browser) await browser.close().catch(() => {});
    srv.kind.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 500));
    srv.kind.kill('SIGKILL');
  }
}
