// Der Knopf hinter den Mockup-Vorlagen: erzeugen, vermessen, ablegen.
//
// Warum das im Server laeuft und nicht anderswo: ein Bild ist schnell bestellt, aber die
// Druckflaeche muss im selben Augenblick gemessen und neben das Bild geschrieben werden. Liefe
// das getrennt, haetten wir wieder Bild hier und Zahl dort - und genau daran veralten solche
// Zahlen still.
//
// Ein Lauf macht IMMER nur eine Vorlage. Das ist Absicht: jede kostet eine Bildgenerierung,
// und beim Erzeugen kann das Modell danebenliegen (Platzhalter nicht gemalt, Teil angeschnitten).
// Dann soll genau diese eine Vorlage neu bestellt werden und nicht ein ganzer Stapel.
import fs from 'node:fs/promises';
import path from 'node:path';
import { VORLAGEN, vorlageBauen, kenntVorlage } from './vorlagen.js';
import { GARMENTS, COLORS, merkeBox, gelernteBox, mitgelieferteBox, templateReady, SZENEN_LABELS, istOriginalfoto, originalZurueckholen, mockupsVerwerfen } from './mockups.js';

export function mountVorlagen(app, deps) {
  const { STORE, adminGuard, erzeugeVorlagenBild, mitBildarbeit } = deps;
  const DIR = path.join(STORE, 'templates');

  // Der Schluessel, unter dem mockups.js die Vorlage sucht: <artikel>[-szene[-frau|-mann]]_<farbe>
  const schluessel = (artikel, ansicht, farbe) => (ansicht.startsWith('szene') ? artikel + '-' + ansicht : artikel) + '_' + farbe;
  // Welche Ansichten hat ein Artikel? Produkt und Situation immer; die getragenen Textilien
  // dazu die Situation als Frau und als Mann (vorlagen.js, getragen). 27. Sept., Markus.
  const ansichtenFuer = (artikel) => ['produkt', 'szene', 'szene-frau', 'szene-mann'].filter(a => typeof (VORLAGEN[artikel] || {})[a] === 'function');
  const personWort = (ansicht) => ansicht === 'szene-frau' ? ' · Frau' : ansicht === 'szene-mann' ? ' · Mann' : '';

  // Welche Farben braucht dieser Artikel wirklich? Ein Poster gibt es nicht in Schwarz und
  // Weiss - es ist Papier. Nur Textilien und die Teile mit echter Farbwahl brauchen beide.
  const farbenFuer = (artikel) => (['tee', 'polo', 'hoodie', 'zip', 'tasse', 'beutel'].includes(artikel) ? COLORS : ['white']);

  // Erwartetes Seitenverhaeltnis aus dem hinterlegten Startwert. Weicht das Gemessene um mehr
  // als die Haelfte ab, ist etwas faul - gemeldet, nicht abgelehnt: vielleicht sitzt es ja doch,
  // und ein Mensch sieht das Bild daneben.
  function pruefeVerhaeltnis(artikel, ansicht, box) {
    if (!box || !box.w || !box.h) return '';
    const g = GARMENTS[artikel];
    const soll = ansicht.startsWith('szene') ? ((g && g.szene && g.szene.box) || (g && g.box)) : (g && g.box);
    if (!soll || !soll.w || !soll.h) return '';
    const sollV = soll.w / soll.h, istV = box.w / box.h;
    const ab = istV / sollV;
    if (ab > 1.5) return 'viel breiter als erwartet';
    if (ab < 0.67) return 'viel höher als erwartet';
    return '';
  }

  async function stand() {
    const zeilen = [];
    for (const artikel of Object.keys(VORLAGEN)) {
      const g = GARMENTS[artikel] || {};
      for (const ansicht of ansichtenFuer(artikel)) {
        for (const farbe of farbenFuer(artikel)) {
          const k = schluessel(artikel, ansicht, farbe);
          let da = false, bytes = 0;
          try { const st = await fs.stat(path.join(DIR, k + '.png')); da = true; bytes = st.size; } catch (e) { /* fehlt */ }
          zeilen.push({
            artikel, ansicht, farbe, schluessel: k,
            label: g.label || artikel,
            situation: ansicht.startsWith('szene') ? ((g.szene && g.szene.label) || SZENEN_LABELS[artikel] || 'In Benutzung') + personWort(ansicht) : '',
            weg: VORLAGEN[artikel].weg,
            da, bytes,
            gemessen: gelernteBox(k) || mitgelieferteBox(k) || null,   // mitgeliefert (Repo) zaehlt als gemessen
            // Plausibilitaet: Stimmt das gemessene Seitenverhaeltnis ungefaehr mit dem
            // hinterlegten? Eine T-Shirt-Brust ist hochformatig (370 x 555). Kommt dort etwas
            // Querformatiges heraus, hat das Modell den Platzhalter woanders hingelegt - quer
            // ueber die Schultern, auf den Tisch, ueber das ganze Teil. Das sieht man dem
            // Daumennagel nicht an, der Zahl schon.
            stimmig: pruefeVerhaeltnis(artikel, ansicht, gelernteBox(k)),
            bild: da ? `/api/admin/vorlage-bild/${k}.png` : ''
          });
        }
      }
    }
    return zeilen;
  }

  // Der laufende Auftrag. Fassung 85b: Zuerst hielt die Route die Anfrage offen, bis das Bild
  // fertig war - ein bis zwei Minuten. Im Browser sah das aus, als passiere nichts, und
  // spaetestens der Proxy vor dem Server bricht so lange Anfragen ab. Beim Aufmacher-Knopf hatte
  // ich es richtig gemacht und hier falsch: der Lauf gehoert in den Hintergrund, die Anfrage
  // antwortet sofort, und der Stand wird abgefragt.
  // Fassung 85c: eine Warteschlange statt einer Sperre. Markus hat auf fast alle Knoepfe
  // gedrueckt - genau richtig, wenn man fuenfzig Vorlagen braucht. Eine harte Sperre ("es
  // laeuft schon eins") haette ihn gezwungen, fuenfzig Mal einzeln ein bis zwei Minuten zu
  // warten. Der Server nimmt die Wuensche jetzt entgegen und arbeitet sie nacheinander ab.
  // Nacheinander und nicht gleichzeitig: jedes Bild kostet Geld, und bei einem Fehler soll
  // erkennbar bleiben, welches ihn ausgeloest hat.
  const lauf = { laeuft: false, was: '', seit: 0, fertig: '', fehler: '', erledigt: 0, fehlgeschlagen: [] };
  const schlange = [];

  // ---- Backend: Stand ----
  app.get('/api/admin/vorlagen', adminGuard, async (req, res) => {
    const zeilen = await stand();
    res.json({
      zeilen,
      fehlen: zeilen.filter(z => !z.da).length,
      gesamt: zeilen.length,
      lauf: { ...lauf, sekunden: lauf.laeuft ? Math.round((Date.now() - lauf.seit) / 1000) : 0, warten: schlange.length }
    });
  });

  // Die Vorlage selbst ansehen - ohne das waere jede Pruefung ein Blindflug.
  app.get('/api/admin/vorlage-bild/:file', adminGuard, async (req, res) => {
    const k = String(req.params.file).replace(/\.png$/i, '').replace(/[^a-z0-9_-]/g, '');
    try {
      res.type('png').set('cache-control', 'no-store').send(await fs.readFile(path.join(DIR, k + '.png')));
    } catch (e) { res.status(404).end(); }
  });

  // ---- Backend: eine Vorlage erzeugen ----
  app.post('/api/admin/vorlagen/erzeugen', adminGuard, async (req, res) => {
    const b = req.body || {};
    const artikel = String(b.artikel || '').replace(/[^a-z]/g, '');
    const ansicht = String(b.ansicht || 'produkt');
    const farbe = String(b.farbe || 'white');
    if (!kenntVorlage(artikel)) return res.status(400).json({ error: 'unbekannter Artikel ' + artikel });
    if (!ansichtenFuer(artikel).includes(ansicht)) return res.status(400).json({ error: 'ansicht muss eine von ' + ansichtenFuer(artikel).join(', ') + ' sein' });
    if (!COLORS.includes(farbe)) return res.status(400).json({ error: 'Farbe muss ' + COLORS.join(' oder ') + ' sein' });
    if (typeof erzeugeVorlagenBild !== 'function') return res.status(501).json({ error: 'Auf diesem Server ist das Erzeugen nicht eingerichtet' });

    const k = schluessel(artikel, ansicht, farbe);
    // Fassung 88: Niemals ein echtes Herstellerfoto ueberschreiben. Beide Systeme legen ihre
    // Bilder unter demselben Namen ab - ein Klick hier hat am 18. September die echten
    // Produktfotos geloescht und die Kundenseite geleert.
    if (istOriginalfoto(k)) {
      return res.status(409).json({ error: 'Für "' + k + '" gibt es ein echtes Produktfoto. Das wird nicht durch ein erzeugtes Bild ersetzt. Die Situation (in Benutzung) kannst du erzeugen.' });
    }
    if (schlange.some(x => x.k === k) || (lauf.laeuft && lauf.was === k)) {
      return res.json({ ok: true, schon: k, warten: schlange.length });
    }
    schlange.push({ k, artikel, ansicht, farbe });
    abarbeiten();
    res.json({ ok: true, eingereiht: k, warten: schlange.length });
  });

  // Alles, was fehlt, auf einmal einreihen. Der eine Knopf, der die fuenfzig Vorlagen
  // wirklich fuellt - mit Rueckfrage im Backend, weil jedes Bild Geld kostet.
  app.post('/api/admin/vorlagen/alle', adminGuard, async (req, res) => {
    const zeilen = await stand();
    let n = 0;
    for (const z of zeilen) {
      if (z.da) continue;
      if (istOriginalfoto(z.schluessel)) continue;   // echtes Produktfoto - nie ersetzen
      if (schlange.some(x => x.k === z.schluessel) || (lauf.laeuft && lauf.was === z.schluessel)) continue;
      schlange.push({ k: z.schluessel, artikel: z.artikel, ansicht: z.ansicht, farbe: z.farbe });
      n++;
    }
    abarbeiten();
    res.json({ ok: true, eingereiht: n, warten: schlange.length });
  });

  // Die Schlange leeren - wenn jemand versehentlich alles angestoszen hat. Das laufende Bild
  // laeuft zu Ende; es abzubrechen wuerde nur bezahlte Arbeit wegwerfen.
  app.post('/api/admin/vorlagen/stopp', adminGuard, (req, res) => {
    const weg = schlange.length;
    schlange.length = 0;
    res.json({ ok: true, verworfen: weg, laeuftNoch: lauf.laeuft ? lauf.was : '' });
  });

  // Die Reparatur zum Fehler oben: alle Originalfotos zurueckholen, die ueberschrieben wurden.
  app.post('/api/admin/vorlagen/originale', adminGuard, async (req, res) => {
    const zeilen = await stand();
    const geholt = [], schief = [];
    for (const z of zeilen) {
      if (!istOriginalfoto(z.schluessel)) continue;
      // Nur die anfassen, die eine selbst gemessene Flaeche tragen - das ist das sichere
      // Kennzeichen dafuer, dass hier ein erzeugtes Bild ueber dem Foto liegt.
      if (!z.gemessen) continue;
      try { await originalZurueckholen(STORE, z.schluessel); geholt.push(z.schluessel); }
      catch (e) { schief.push(z.schluessel + ': ' + (e && e.message ? e.message : e)); }
    }
    // Nur die Mockups der betroffenen Artikel - nicht den ganzen Ordner. Ein Aufraeumen darf
    // nie mehr kaputtmachen als der Schaden, den es behebt.
    const betroffen = [...new Set(geholt.map((k) => k.split('_')[0].replace('-szene', '')))];
    const weg = await mockupsVerwerfen(STORE, betroffen);
    res.json({ ok: true, geholt, schief, mockupsGeloescht: weg });
  });

  let abarbeiterLaeuft = false;
  async function abarbeiten() {
    if (abarbeiterLaeuft) return;
    abarbeiterLaeuft = true;
    try {
      while (schlange.length) {
        const auftrag = schlange.shift();
        const { k, artikel, ansicht, farbe } = auftrag;
        lauf.laeuft = true; lauf.was = k; lauf.seit = Date.now(); lauf.fehler = '';
        try {
          // Die Bildarbeit danach (messen, Platzhalter entfernen, auf 1024 bringen) haelt ein
          // ganzes Bild im Speicher - sie gehoert in dieselbe Schlange wie alles andere.
          const ergebnis = await mitBildarbeit('Vorlage ' + k, () => vorlageBauen({ artikel, ansicht, farbe, erzeugeBild: erzeugeVorlagenBild }));
          await fs.mkdir(DIR, { recursive: true });
          // Erst die Flaeche merken, dann das Bild schreiben. Andersherum gaebe es einen
          // Moment, in dem die neue Vorlage schon da ist, aber noch mit der alten Flaeche
          // gerechnet wird - und in diesem Moment saesze jedes Motiv falsch.
          await merkeBox(STORE, k, ergebnis.box);
          await fs.writeFile(path.join(DIR, k + '.png'), ergebnis.png);
          // Fertige Mockups, die mit der alten Vorlage gebaut wurden, sind jetzt veraltet.
          try { await mockupsVerwerfen(STORE, [artikel]); } catch (e) { /* kein Mockup-Ordner - dann gibt es nichts zu loeschen */ }
          console.log('Vorlage erzeugt:', k, '· Flaeche', JSON.stringify(ergebnis.box), '·', Math.round((Date.now() - lauf.seit) / 1000) + ' s');
          lauf.fertig = k + ' · Fläche ' + ergebnis.box.w + '×' + ergebnis.box.h + ' px';
          lauf.erledigt++;
        } catch (e) {
          // Ein gescheiterter Lauf hinterlaeszt NICHTS. Eine halbe Vorlage - Bild ohne Flaeche
          // oder umgekehrt - waere schlimmer als gar keine. Der Grund muss aber sichtbar
          // werden, sonst sucht man ihn im Protokoll statt im Backend. Die Schlange laeuft
          // weiter: ein misslungenes Bild darf die anderen neunundvierzig nicht aufhalten.
          const grund = (e && e.message ? e.message : String(e)).slice(0, 200);
          lauf.fehler = k + ': ' + grund;
          lauf.fehlgeschlagen = [...lauf.fehlgeschlagen.filter(x => x.k !== k), { k, grund }].slice(-12);
          console.error('Vorlage', k, 'gescheitert:', grund);
        }
      }
    } finally {
      lauf.laeuft = false;
      abarbeiterLaeuft = false;
    }
  }

  return { stand, farbenFuer };
}
