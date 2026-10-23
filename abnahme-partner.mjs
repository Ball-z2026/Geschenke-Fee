// Abnahme Abschnitt 9: Partner, Tor, Lizenz und was die frueheren Postkarten-Pruefungen an
// Gemeinsamem mitgeprueft haben (Abfolge, Angebotsreihe, Mockups, Vorlagen, Kissen, Fotoinhalt,
// Stufe 1, Figuren, Logo-Holen, Hausfarben, platzhalterFelder, Sicherung). Seit 12. Okt. 2026 sind
// Postkarte und Gutschein nicht mehr Teil von Motto Otto - ihre Pruefungen sind mit ihnen gegangen.

import fs from 'node:fs/promises';
import './abfolge.js';
import { ARTIKEL, artikelLeinwand, verkaufsfaehig, artikelAuswahl, druckBlock, pruefeArtikel } from './artikel.js';
import { buildPrompt, sanitizeMotto, publicView, STYLES, wahlFlaeche, stufeFuer, BILD_STUFEN, seedStruktur } from './mottos.js';
import { markenStore } from './marken.js';
import { flaggeFuer } from './mockups.js';
import { dominantColors } from './images.js';

export async function pruefePartner({ pruefe, abschnitt }) {
  abschnitt(9, 'Partner, Tor, Lizenz und Gemeinsames');

  // 6. Okt., Markus: "Kissen ... vollflaechig, es sei denn einfach nur Sprueche, wo der Rest bleibt weiss." Die Postkarte bleibt randlos.
  // 6. Okt., Markus: "Wir nehmen 40 x 40, das ist der Standard" - die erste Kissenflaeche ist die, die ohne Wahl genommen wird.
  pruefe('Kissen: Standard ist 40 x 40 (erste Flaeche, ohne Wahl genommen)', Object.keys(ARTIKEL.kissen.flaechen || {})[0] === '40x40', Object.keys(ARTIKEL.kissen.flaechen || {}).join(', '));
  { const kb = druckBlock('kissen', Object.keys(ARTIKEL.kissen.flaechen || {})[0] || '');
    pruefe('Kissen: randlos, aber reine Schrift darf auf Weiss stehen (nie helle Schrift)', /FULL BLEED/.test(kb) && /ONLY EXCEPTION: if the order is pure lettering/.test(kb) && /Never white or very pale lettering/.test(kb), kb.slice(-300)); }


  const { angebotReihe, GARMENTS: TEILE } = await import('./mockups.js');
  const alleTeile = Object.keys(TEILE);
  const r3 = angebotReihe({ teile: alleTeile, artikel: null, eigeneAnsicht: '', bereit: new Set(['tee', 'hoodie']) });
  pruefe('ohne Artikel (Shirt-Motto): alle Teile mit Vorlage, keins ohne', r3.join(',') === 'tee,hoodie', r3.join(','));
  const r4 = angebotReihe({ teile: alleTeile, artikel: { motivart: 'vollflaechig', netto: [40, 40] }, eigeneAnsicht: 'kissen', bereit: new Set(['tee', 'kissen', 'poster']) });
  pruefe('bestelltes Kissen steht vorn, ein Teil ohne Vorlage kommt nie in die Reihe', r4[0] === 'kissen' && !r4.includes('acrylbild') && r4.every(g => ['tee', 'kissen', 'poster'].includes(g)), r4.join(','));
  const r5 = angebotReihe({ teile: alleTeile, artikel: { motivart: 'vollflaechig', netto: [7, 10] }, eigeneAnsicht: '', bereit: new Set(['tee', 'hoodie']) });
  pruefe('faellt alles durchs Groessen-Raster, bleiben die Teile mit Vorlage (nie leer, nie ohne Vorlage)', r5.join(',') === 'tee,hoodie', r5.join(','));
  // abfolge.js ohne Browser: planen, fehlt, zusammenfassung sind reine Rechnung
  const AB = globalThis.MoAbfolge;
  // Standard-Abfolge (Markus, 20. Sept.: "bei allen Themen, bei jedem Motto, ueberall genauso"):
  // Mottos ohne eigenen Eintrag bekommen ihre Schritte aus den Feldern und Kaesten der Seite.
  const abiM = publicView(JSON.parse(await fs.readFile('storage/mottos/abi.json', 'utf8')));
  const abiOffen = new Set(['f-suggest', 'f-textile', 'f-style', 'f-mood', 'f-colors', 'f-druckmass', 'f-font', 'f-nameart'].concat(abiM.fields.filter(f => !f.versteckt).map(f => 'f_' + f.key)));
  const pa = AB.planen(abiM, id => abiOffen.has(id));
  // 23. Sept.: "rueckseite" ist neu im Schritt "Freiwilliges" - der Wunsch, alle Namen auf die
  // Rueckseite zu setzen. Er steht dort und nicht beim Namensfeld, weil die Abfolge nach
  // Feldart gruppiert: das Namensfeld ist persoenlich und bekommt einen eigenen Schritt,
  // ein Ankreuzfeld gehoert zu den freiwilligen Angaben.
  pruefe('Standard-Abfolge Abi: Motto (mit Vorschlaegen), Namen, Freiwilliges (mit Rueckseiten-Wunsch), Textil, Stil, Groesse (eigener Schritt seit 2. Okt.), Feinheiten, Zusammenfassung',
    pa.map(s => s.id).join(',') === 'feld_motto,feld_namen,optional,optional-ort,optional-jahr,optional-rueckseite,textil,stil,groesse,fein,fein-farben,fein-schrift,fein-namen,los' && pa[0].bereiche[0] === 'vorschlaege' && pa[0].titel === 'Abi-Motto' && pa.slice(2, 6).map(s => s.felder.join('+')).join(',') === 'schule,ort,jahr,rueckseite' && pa[8].bereiche.join(',') === 'groesse' && pa.slice(9, 13).map(s => s.bereiche.join('+')).join(',') === 'stimmung,farben,schrift,namen', pa.map(s => s.id).join(','));
  // 5. Okt. abends, Markus: "Wir muessen Freestyle viel, viel einfacher machen ... Die Leute sollen einfach nur einsprechen".
  // Freestyle wie der Server ihn anlegt (FS_REV 4: einfach, alles ausser dem Wunsch versteckt); die Seite versteckt bei
  // einfach Groesse, Textil, Stil, Farben, Figuren - offen sind nur der Artikel und der Wunsch.
  const fsDatei = JSON.parse(await fs.readFile('freestyle/motto-freestyle.json', 'utf8'));
  fsDatei.fields = fsDatei.fields.filter(f => f.key !== 'wofuer');
  const fsM = publicView(sanitizeMotto({ ...fsDatei, slug: 'freestyle', noExtra: true, upload: { mode: 'off', label: 'Foto', hint: '', place: 'mitte', widthPct: 40 } }));
  const fsOffen = new Set(['f_artikel'].concat(fsM.fields.filter(f => !f.versteckt).map(f => 'f_' + f.key)));
  const pf = AB.planen(fsM, id => fsOffen.has(id));
  const fsSeite = await fs.readFile('motto-seite.js', 'utf8'), serv = await fs.readFile('server.js', 'utf8');
  // 19. Okt., Markus: dazu der freiwillige Foto-Schritt ("Hast du ein Foto oder eine Datei dazu?") direkt nach dem Wunsch.
  pruefe('Standard-Abfolge Freestyle (einfach): "Worauf soll es?", "Foto oder Datei?" (freiwillig), "Was soll drauf?" (mit Einsprechen; mit Foto: "an deinem Foto aendern"), "Alles klar?" - Groesse, Textil, Stil, Farben fragt die Seite nicht, die Bruecke im Server fuellt sie',
    fsM.einfach === true && pf.map(s => s.id).join(',') === 'artikel,feld_foto,feld_motiv,los' && pf[0].bereiche.join(',') === 'artikel' && fsM.fields.filter(f => !f.versteckt).map(f => f.key).join() === 'foto,motiv' && /an deinem Foto/.test((fsM.fields.find(f => f.key === 'motiv').mitFoto || {}).label || '')
      && fsM.fields.find(f => f.key === 'foto').ohneGeht === true
      && fsM.fields.find(f => f.key === 'motiv').hint.length > 140
      && /if \(current\.einfach\) \['f-style', 'f-textile'/.test(fsSeite) && /class="feld-mic"/.test(fsSeite)
      && /motto\.einfach && body\.values/.test(serv) && /async function freestyleBruecke/.test(serv) && /body\.breiteCm = 28; body\.hoeheCm = 20;/.test(serv), pf.map(s => s.id).join(','));
  {
    // 5. Okt. abends, Markus (Hoodie mit "Ruecken 30 x 35", die Vorschau zeigte es vorn): Rueckenfotos von Shirt und Hoodie
    // (Stanley/Stella-Packshot von hinten), die Kachel traegt die Seite, der Auftrag merkt sie, die Vorschau nimmt das Foto von hinten.
    const MK = await import('./mockups.js'), fsSync = await import('node:fs');
    const da = ['tee-ruecken', 'hoodie-ruecken'].every(k => MK.MITGELIEFERT[k] && ['white', 'black'].every(f => fsSync.existsSync('vorlagen-original/' + MK.MITGELIEFERT[k].dateien[f])));
    pruefe('Rueckendruck: Fotos von hinten fuer Shirt und Hoodie, Kachel "Rücken" schickt druckSeite, Auftrag merkt artikel.seite, Vorschau nimmt das Rueckenfoto (ohne Szene)',
      da && /data-seite="ruecken"/.test(fsSeite) && /druckSeite: \$\('f-druckmass'\)/.test(fsSeite)
        && /seite: frei && body\.druckSeite === 'ruecken'/.test(serv) && /nurGroesse: true, seite: body\.druckSeite === 'ruecken'/.test(serv)
        && /const hinten = !side && !!\(artJ && artJ\.seite === 'ruecken'\)/.test(serv) && /rueckenFoto: hinten/.test(serv)
        && /const rueckenKey = rueckenLinie \|\| \(opts\.rueckenFoto/.test(fsSync.readFileSync('mockups.js', 'utf8')), String(da));
  }
  {
    // 6. Okt., Markus: "Mal was von Roly, mal was von Stanley/Stella und das auch dazuschreiben" - "der Kunde muss bei jedem
    // Design die Auswahl haben, welches Textil er sich danach aussucht".
    const MK = await import('./mockups.js'), fsSync = await import('node:fs');
    const roly = ['roly-tee', 'roly-polo', 'roly-hoodie', 'roly-tee-ruecken', 'roly-hoodie-ruecken'];
    const da = roly.every(k => MK.MITGELIEFERT[k] && ['white', 'black'].every(f => fsSync.existsSync('vorlagen-original/' + MK.MITGELIEFERT[k].dateien[f])));
    const home = fsSync.readFileSync('home-neu.html', 'utf8');
    pruefe('Linien gemischt: Roly-Vorlagen (vorn und hinten), Ottos Starter zeigt Roly, Band reihum B&C/Stanley/Stella/Roly mit Hersteller, Modell und Stufe darunter, Tipp waehlt die Stufe vor',
      da && MK.LINIEN.roly === 'Roly' && ['roly-tee', 'roly-polo', 'roly-hoodie'].every(k => MK.MITGELIEFERT[k].linie === 'roly')
        && /kfStufe === 'starter' \? '&linie=roly'/.test(fsSeite) && !/von Roly dürfen wir keine bedruckten Fotos zeigen/.test(fsSeite) && /get\('stufe'\)/.test(fsSeite)
        && /const BAND_LINIEN = \['bc', 'ss', 'roly'\]/.test(serv) && /x\.linieName = lb\.text/.test(serv) && /const linieG = gewaehlt\[1\] \|\| farbe/.test(serv) && /p\.set\('stufe', x\.stufe\)/.test(serv)
        && /d\.linieName/.test(home), String(da));
  }
  {
    // 6. Okt., Markus: Weiss auf Weiss (Meister-Shirt, Rand 19) und "Die Ansichten ... muessen genau das sein, was der Kunde ausgewaehlt hat".
    const B6 = await import('./brett.js'), fsSync = await import('node:fs');
    const konto = fsSync.readFileSync('konto.html', 'utf8');
    pruefe('Weiss auf Weiss: Rand-Grenze 10 (Meister-Shirt mit 19 faellt raus); Konto zeigt Teil und Farbe aus dem Auftrag, nicht fest Schwarz',
      B6.RAND_GRENZE === 10 && !B6.zeigbar({ v: B6.MESS_STAND, werte: { weiss: 1 }, fein: { weiss: 9 }, rand: { weiss: 19 }, biss: {}, rahmen: 0, palette: { weiss: 9, schwarz: 67, bunt: 19 } }, 'weiss')
        && /farbe = istHell\(jk\.textile/.test(serv) && /mockup\/\$\{id\}\/\$\{teil\}\/\$\{farbe\}\.jpg/.test(serv) && !/mockup\/\$\{id\}\/tee\/black\.jpg/.test(serv)
        && /var stand = \{ teil: d\.teil \|\| 'tee', farbe: d\.farbe \|\| 'black' \}/.test(konto));
  }
  {
    // 6. Okt., Markus: Freistellen verboten (43), Kundendateien nie ueberschreiben, Band nur mit seiner Freigabe (44).
    const IM = await import('./images.js'), fsSync = await import('node:fs'), sharpM = (await import('sharp')).default;
    const deckend = await sharpM({ create: { width: 64, height: 64, channels: 3, background: { r: 20, g: 20, b: 20 } } }).png().toBuffer();
    const durchsichtig = await sharpM({ create: { width: 64, height: 64, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: await sharpM({ create: { width: 32, height: 32, channels: 4, background: { r: 200, g: 30, b: 30, alpha: 1 } } }).png().toBuffer(), left: 16, top: 16 }]).png().toBuffer();
    let wirft = false; try { await IM.motivFreistellen(deckend, 'alpha'); } catch (e) { wirft = /Freistellen ist verboten/.test(e.message); }
    let wirftOhne = false; try { await IM.motivFreistellen(deckend); } catch (e) { wirftOhne = true; }
    // auch der fruehere Chroma-Testmodus schneidet nicht mehr aus: Gruen ohne Alphakanal ist ein Fehler
    const gruen = await sharpM({ create: { width: 64, height: 64, channels: 3, background: { r: 0, g: 255, b: 0 } } }).png().toBuffer();
    let wirftChroma = false; try { await IM.motivFreistellen(gruen, 'chroma'); } catch (e) { wirftChroma = true; }
    const M0 = await import('./mottos.js'); M0.setGrundModus('chroma'); const nurAlpha = M0.GRUND_MODUS === 'alpha';
    const alphaOk = (await IM.motivFreistellen(durchsichtig, 'alpha')).weg === 'alpha';
    const vz = fsSync.readFileSync('vorzeige.js', 'utf8'), seite = fsSync.readFileSync('band-freigabe.html', 'utf8');
    pruefe('Freistellen verboten: ohne Alphakanal ein Fehler statt Ausschneiden (auch ohne Angabe), transparent geht durch; Stilbeispiel-Import nur transparent und mit freier Nummer',
      wirft && wirftOhne && wirftChroma && nurAlpha && alphaOk && /erwarte: 'alpha'/.test(vz) && /const belegt = await Promise\.any/.test(vz) && /motivFreistellen\(png, 'alpha'\);   \/\/ 6\. Okt\.: nur Alphakanal/.test(serv), JSON.stringify({ wirft, wirftOhne, wirftChroma, nurAlpha, alphaOk }));
    pruefe('Kundendateien: kein automatisches Nachschaerfen beim Start, Auslagern ersetzt keine vorhandene Drive-Kopie, Feinjustierung sichert das Original',
      !/if \(!process\.env\.ABNAHME\) druckkantenNachschaerfen\(\)/.test(serv) && /if \(drin\) \{ uebersprungen\.push\(\{ datei: f, grund: grund \+ ' - NICHT ueberschrieben, wartet auf Markus' \}\); continue; \}/.test(serv)
        && /_PRINT_MASTER\.original\.png/.test(serv));
    pruefe('Band nur mit Markus\' Freigabe: Band und Bewertung filtern auf bandFrei, Vorauswahl und Ja/Nein ueber /admin/band',
      /e\.bandFrei === true \|\| \(String\(req\.query\.kandidaten/.test(serv) && /app\.get\('\/admin\/band'/.test(serv) && /app\.post\('\/api\/admin\/band-freigabe'/.test(serv) && /app\.post\('\/api\/admin\/band-vorschlag'/.test(serv)
        && /Ja, ins Band/.test(seite) && /x-admin-token/.test(seite));
  }
  // 20. Sept., Markus (Screenshot Baby-Motto): "Bei Geburt?" - der Foto-Upload hiess "Euer Logo".
  const babyM = sanitizeMotto({ slug: 'b', name: 'B', prompt: 'Sweet nursery print, portrait, isolated on a plain empty background. Headline reads exactly "{spruch}".', fields: [{ key: 'spruch', label: 'Spruch', type: 'text', required: true }], upload: { mode: 'reference', label: 'Eigenes Foto (optional): Baby, Kuscheltier …', hint: 'Lade optional ein Foto hoch.' } });
  const babyPlan = AB.standardAbfolge(babyM, id => ['f_spruch', 'f-upload', 'f-style', 'f-textile'].includes(id));
  const babyLogo = babyPlan.find(x => x.id === 'logo');
  pruefe('Standard-Abfolge: ein Foto als Vorlage heisst nach dem Upload, nicht "Euer Logo"; freiwillig, also mit Weiter', !!babyLogo && /Eigenes Foto/.test(babyLogo.titel) && !/optional/.test(babyLogo.titel) && !/Logo/.test(babyLogo.titel) && babyLogo.text === 'Lade optional ein Foto hoch.' && babyLogo.weiter === 'Weiter', JSON.stringify(babyLogo));
  const logoM = sanitizeMotto({ slug: 'l', name: 'L', prompt: 'Company print, portrait, isolated on a plain empty background. Headline reads exactly "{firma}".', fields: [{ key: 'firma', label: 'Firma', type: 'text', required: true }], upload: { mode: 'exact', label: 'Euer Firmenlogo', required: true } });
  const logoSchritt = AB.standardAbfolge(logoM, id => ['f_firma', 'f-upload', 'f-logoart'].includes(id)).find(x => x.id === 'logo');
  pruefe('Standard-Abfolge: ein echtes Logo (mode exact) heisst "Euer Logo"', !!logoSchritt && logoSchritt.titel === 'Euer Logo' && logoSchritt.weiter === '', JSON.stringify(logoSchritt));
  pruefe('Standard-Abfolge Freestyle: "Worauf soll es?" laesst ohne Artikel nicht weiter (die Seite meldet den Bereich)', AB.fehlt(pf[0], fsM, {}, { bereichFehlt: b => (b === 'artikel' ? 'Artikel' : '') }) === 'Artikel' && AB.fehlt(pf[0], fsM, {}, { bereichFehlt: () => '' }) === '');
  pruefe('Standard-Abfolge: was die Seite gar nicht zeigt, wird auch nicht gefragt (Abi ohne Textil und Stil)', AB.planen(abiM, id => abiOffen.has(id) && !['f-textile', 'f-style'].includes(id)).map(s => s.id).join(',') === 'feld_motto,feld_namen,optional,optional-ort,optional-jahr,optional-rueckseite,groesse,fein,fein-farben,fein-schrift,fein-namen,los');
  // 27. Sept.: der Schritt "Personen" traegt jetzt die Wahl des Foto-Wegs (Im Stil / Original).

  // 20. Sept., Befund 1 der Pruef-Sitzung, hier nachgestellt: die Bild-KI meldete die
  // Nationalflagge als "echtes Zeichen, sicher", und die Logo-Sperre hielt sie fuer eine Marke.
  const mk = markenStore('storage'); await mk.ready();
  const flagge = mk.checkLogos([{ beschreibung: 'German national flag (black-red-gold) waving on a pole', echt: true, name: 'Germany', sicher: true }]);
  const rbFahne = mk.checkLogos([{ beschreibung: 'Red Bull flag', echt: true, name: 'Red Bull', sicher: true }]);
  const raute = mk.checkLogos([{ beschreibung: 'blue diamond crest', echt: true, name: 'Hamburger SV', sicher: true }]);
  pruefe('Logo-Sperre: eine Nationalflagge ist keine Marke; eine Red-Bull-Fahne und die HSV-Raute bleiben gesperrt', flagge === null && !!rbFahne && rbFahne.wort === 'RED BULL' && !!raute, JSON.stringify({ flagge, rbFahne, raute }));

  // 3d) 20. Sept., Markus mit Bild vom Strandtuch: "Es ist viel zu klein da drauf. Die Masse sind
  // wieder mit auf dem Motiv. Das soll nicht sein." Und: "kein direkter Vergleich, wie es auf dem
  // Handtuch am Strand aussieht. Weder beim Poster noch sonst irgendwo."
  {
    const MK = await import('./mockups.js'), fsSync = await import('node:fs');
    const os = await import('node:os'); const path = await import('node:path'); const sharp = (await import('sharp')).default;
    // Mitgelieferte Vorlagen: Bild im Repo, Flaeche im Bild, fuer jeden Schluessel
    const fehltDatei = [], schief = [];
    for (const [k, v] of Object.entries(MK.MITGELIEFERT)) {
      for (const d of (v.dateien ? Object.values(v.dateien) : [v.datei || (k + '.jpg')])) { try { await fs.access(path.join('vorlagen-original', d)); } catch (e) { fehltDatei.push(k + ':' + d); } }
      // 27. Sept.: boxen = je Farbe eine Flaeche (zwei Fotos, z. B. Getragen als Frau/Mann) - jede muss stimmen.
      const boxen = v.boxen ? Object.values(v.boxen) : [v.box];
      for (const b of boxen) if (!(b && b.w > 100 && b.h > 100 && b.x >= 0 && b.y >= 0 && b.x + b.w <= 1024 && b.y + b.h <= 1024)) schief.push(k);
    }
    pruefe('mitgelieferte Vorlagen: jede hat ihr Bild im Repo und eine brauchbare Flaeche', !fehltDatei.length && !schief.length, [...fehltDatei, ...schief].join(', '));
    const sieben = ['mousepad', 'hundedecke', 'acrylbild', 'tuerschild', 'brett', 'napfunterlage', 'gepaeckanhaenger'];
    pruefe('die sieben Artikel ohne Herstellerfoto haben jetzt Produktansicht UND Situation', sieben.every(g => MK.MITGELIEFERT[g] && MK.MITGELIEFERT[g + '-szene']));
    pruefe('Strandtuch, Kissen, Poster und Sticker haben eine Situation (am Strand, auf dem Sofa, an der Wand, aufgeklebt)', ['strandtuch', 'kissen', 'poster', 'sticker'].every(g => MK.MITGELIEFERT[g + '-szene']));
    pruefe('die Flaeche der mitgelieferten Vorlage gilt fuer beide Farben', !!MK.mitgelieferteBox('poster-szene_black') && !!MK.mitgelieferteBox('poster-szene_white') && !MK.mitgelieferteBox('tee_black'));
    // Ein Pruefstand mit eigenem Vorlagenordner, damit nichts in storage/ angefasst wird
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mo-vorlagen-'));
    await MK.ensureTemplates(tmp);
    // 20. Sept., live: die erste Strandtuch-Szene lag schon auf dem Volume, die korrigierte kam nie
    // an. Ein hoeherer Stand im Repo ersetzt die Datei - nicht aber eine im Backend erzeugte.
    {
      const pfad = path.join(tmp, 'templates', 'strandtuch-szene_white.png');
      const echt = (await fs.stat(pfad)).size;
      await fs.writeFile(pfad, await sharp({ create: { width: 1024, height: 1024, channels: 3, background: '#888' } }).png().toBuffer());
      const st = JSON.parse(await fs.readFile(path.join(tmp, 'templates', 'mitgeliefert.json'), 'utf8'));
      st['strandtuch-szene_white'] = 1; await fs.writeFile(path.join(tmp, 'templates', 'mitgeliefert.json'), JSON.stringify(st));
      await MK.ensureTemplates(tmp);
      const st2 = JSON.parse(await fs.readFile(path.join(tmp, 'templates', 'mitgeliefert.json'), 'utf8'));
      pruefe('mitgelieferte Vorlage mit hoeherem Stand ersetzt die alte Datei auf dem Volume und vermerkt den Stand', (await fs.stat(pfad)).size === echt && st2['strandtuch-szene_white'] === MK.MITGELIEFERT['strandtuch-szene'].stand, 'Stand ' + st2['strandtuch-szene_white']);
      await fs.writeFile(pfad, await sharp({ create: { width: 1024, height: 1024, channels: 3, background: '#888' } }).png().toBuffer());
      await MK.ensureTemplates(tmp);
      pruefe('gleicher Stand: eine vorhandene Datei bleibt unangetastet', (await fs.stat(pfad)).size !== echt);
      await MK.ensureTemplates(tmp);   // Stand zurueck auf den echten Inhalt fuer die folgenden Pruefungen
      await fs.writeFile(pfad, await sharp(path.resolve('vorlagen-original', MK.MITGELIEFERT['strandtuch-szene'].datei || 'strandtuch-szene.jpg')).resize({ width: 1024, height: 1024, fit: 'cover' }).png().toBuffer());
    }
    pruefe('nach dem Start liegen Produktansicht und Situation fuer Strandtuch und Acrylbild da (beide Farben)', await MK.templateReady('strandtuch', 'white') && await MK.szeneMoeglich('strandtuch', 'black') && await MK.templateReady('acrylbild', 'black') && await MK.szeneMoeglich('acrylbild', 'white'));
    // Ein Motiv 30 x 35 cm (fuer ein Shirt gebaut) auf dem Strandtuch: formatfuellend, ohne Masslinien
    // Freistehendes Motiv wie ein Shirt-Design: zwei blaue Bloecke (700 x 300 oben, 700 x 300 unten, 400 px Luft
    // dazwischen) auf durchsichtigem Grund - Umriss 700 x 1000, aber nicht deckend (30 x 35 cm bei 100 dpi)
    const block = await sharp({ create: { width: 700, height: 300, channels: 4, background: { r: 20, g: 60, b: 200, alpha: 1 } } }).png().toBuffer();
    const master = await sharp({ create: { width: 1181, height: 1378, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: block, left: 240, top: 189 }, { input: block, left: 240, top: 889 }]).png().withMetadata({ density: 100 }).toBuffer();
    const tpl = await sharp(path.join(tmp, 'templates', 'strandtuch_white.png')).raw().toBuffer({ resolveWithObject: true });
    const mk = await sharp(await MK.makeMockup(master, 'strandtuch', 'white', false, { print: 'dunkel', artikel: { ansicht: 'tee', motivart: 'freistehend', netto: [30, 35] } })).raw().toBuffer({ resolveWithObject: true });
    const W = tpl.info.width, H = tpl.info.height, ch = tpl.info.channels, cm = mk.info.channels;
    let x0 = W, x1 = -1, y0 = H, y1 = -1, gelb = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = (y * W + x) * ch, m = (y * W + x) * cm;
      const r = mk.data[m], g = mk.data[m + 1], b = mk.data[m + 2];
      if (Math.abs(r - 255) < 12 && Math.abs(g - 197) < 12 && Math.abs(b - 66) < 12) gelb++;
      if (Math.abs(r - tpl.data[t]) + Math.abs(g - tpl.data[t + 1]) + Math.abs(b - tpl.data[t + 2]) > 60) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    const box = MK.GARMENTS.strandtuch.box, breite = x1 - x0 + 1, hoehe = y1 - y0 + 1;
    pruefe('Strandtuch: ein fremdes freistehendes Motiv fuellt die Tuchbreite (vorher 173 px, eine Briefmarke), der Stoff bleibt Hintergrund', breite >= box.w - 6 && breite <= box.w + 6 && hoehe >= box.w * 1000 / 700 - 8 && hoehe <= box.w * 1000 / 700 + 8, `Motiv ${breite}x${hoehe} px auf Tuch ${box.w}x${box.h}`);
    pruefe('Strandtuch: keine gelben Masslinien mehr im Bild', gelb < 20, gelb + ' gelbe Pixel');
    // Live am 20. Sept. gemessen: die Situation kam als sachliche Ansicht zurueck, weil makeMockup
    // die mitgelieferte Flaeche nicht kannte. Die Situation muss auf der Strandvorlage liegen.
    const szeneJpg = await MK.makeMockup(master, 'strandtuch', 'white', false, { print: 'dunkel', ansicht: 'szene' });
    const sachlichJpg = await MK.makeMockup(master, 'strandtuch', 'white', false, { print: 'dunkel' });
    // Rand der Szene (Sand, Liegestuhl, Abendlicht) ist warm - Rot deutlich ueber Blau; der Studiogrund ist grau.
    // (sharp.stats() rechnet immer auf dem ganzen Eingangsbild, nicht auf dem Ausschnitt - darum raw)
    const warm = async (jpg) => { const r = await sharp(jpg).raw().toBuffer({ resolveWithObject: true }); let n = 0; for (const [x, y] of [[40, 700], [60, 980], [960, 980]]) { const i = (y * r.info.width + x) * r.info.channels; if (r.data[i] > r.data[i + 2] + 25) n++; } return n; };
    const warmSzene = await warm(szeneJpg), warmSachlich = await warm(sachlichJpg);
    // 20. Sept., Markus: ueber dem Liegestuhl sieht man nur die untere Haelfte des Tuchs - also auch
    // nur den unteren Teil des Motivs. Probe: Druckdatei oben rot, unten blau (randlos auf dem Tuch).
    const halb = await sharp({ create: { width: 700, height: 1400, channels: 4, background: { r: 220, g: 30, b: 30, alpha: 1 } } })
        .composite([{ input: await sharp({ create: { width: 700, height: 700, channels: 4, background: { r: 30, g: 60, b: 220, alpha: 1 } } }).png().toBuffer(), left: 0, top: 700 }]).png().withMetadata({ density: 254 }).toBuffer();
    {
      const gefaltet = await MK.makeMockup(halb, 'handtuch', 'white', false, { print: 'dunkel', ansicht: 'szene', artikel: { ansicht: 'handtuch', motivart: 'vollflaechig', netto: [50, 100] } });
      const r = await sharp(gefaltet).raw().toBuffer({ resolveWithObject: true });
      // Sichtbar sind 778 von 1296 px des ganzen Tuchs (60 %) - vom roten oberen Teil bleibt also
      // ein schmaler Streifen oben (rund 17 % der Hoehe), der Rest ist blau. Rot darf nie unten stehen.
      // 21. Sept.: gezaehlt wird innerhalb der Maske, sechs Pixel von ihrer Kante entfernt - am
      // Rand des Tuchs scheint sonst der Sand (orange) als "rot" durch.
      const hk = await MK.maskeKanten(await fs.readFile(path.join(tmp, 'templates', 'handtuch-szene.maske.png')));
      // 21. Sept., 20:54, Markus: "Abgeschnitten." Seitdem liegt das Handtuch flach im Sand, von
      // oben, im Verhaeltnis 1:2 - das GANZE Motiv ist zu sehen: obere Haelfte rot, untere blau.
      const b = hk.box; let rot = 0, blau = 0, rotUnten = 0, blauOben = 0;
      for (let y = b.y + 4; y < b.y + b.h - 4; y += 3) for (let x = b.x + 4; x < b.x + b.w - 4; x += 3) { if (hk.maske[(y * 1024 + x) * hk.ch] < 128 || x < hk.links[y] + 6 || x > hk.rechts[y] - 6 || y < hk.oben[x] + 6 || y > hk.unten[x] - 6) continue; const i = (y * r.info.width + x) * r.info.channels; if (r.data[i] > 150 && r.data[i + 2] < 90) { rot++; if (y > b.y + b.h * 0.6) rotUnten++; } else if (r.data[i + 2] > 150 && r.data[i] < 90) { blau++; if (y < b.y + b.h * 0.4) blauOben++; } }
      const anteil = rot / (rot + blau);
      pruefe('Handtuch im Sand zeigt das ganze Motiv: obere Haelfte rot, untere blau, nichts abgeschnitten', blau > 1000 && rot > 1000 && anteil > 0.4 && anteil < 0.6 && rotUnten === 0 && blauOben === 0, 'Rot-Anteil ' + anteil.toFixed(2) + ' · rot unten ' + rotUnten + ' · blau oben ' + blauOben);
      const flach = await MK.makeMockup(halb, 'strandtuch', 'white', false, { print: 'dunkel', artikel: { ansicht: 'strandtuch', motivart: 'vollflaechig', netto: [70, 140] } });
      const r2 = await sharp(flach).raw().toBuffer({ resolveWithObject: true }); const b2 = MK.GARMENTS.strandtuch.box; let rot2 = 0;
      for (let y = b2.y + 4; y < b2.y + b2.h / 2; y += 3) for (let x = b2.x + 4; x < b2.x + b2.w - 4; x += 3) { const i = (y * r2.info.width + x) * r2.info.channels; if (r2.data[i] > 150 && r2.data[i + 2] < 90) rot2++; }
      pruefe('sachliche Ansicht zeigt das ganze Tuch (oben rot)', rot2 > 1000, 'rot oben ' + rot2);
      // 22. Sept., Markus: "Die Handtuecher sind einfach auf dem Sand drauf geknallt. Wir wollten,
      // dass sie auch Wellen schlagen, so dass es halbwegs natuerlich aussieht." Die Vorlagen der
      // Tuecher tragen wellen + kontrast; mit wellen folgt das Motiv den Falten des Fotos: ein
      // Streifenmotiv liegt anders als flach abgetragen (viele Pixel weichen ab), die Maskenkante
      // bleibt dieselbe (gleiche Deckung), und die Schattierung ist kraeftiger als im Foto.
      {
        const foto = await fs.readFile(path.join(tmp, 'templates', 'handtuch-szene_white.png'));
        const maske = await fs.readFile(path.join(tmp, 'templates', 'handtuch-szene.maske.png'));
        const streifen = await sharp(Buffer.from(`<svg width="500" height="1000">${Array.from({ length: 50 }, (_, i) => `<rect x="0" y="${i * 20}" width="500" height="10" fill="#000"/><rect x="0" y="${i * 20 + 10}" width="500" height="10" fill="#fff"/>`).join('')}</svg>`)).png().toBuffer();
        const flach = await MK.flaecheAufMaske(foto, maske, streifen, { schatten: true });
        const wellig = await MK.flaecheAufMaske(foto, maske, streifen, { schatten: true, wellen: MK.MASKEN['handtuch-szene'].wellen, kontrast: MK.MASKEN['handtuch-szene'].kontrast });
        const a = await sharp(flach.ebene).raw().toBuffer({ resolveWithObject: true }), b = await sharp(wellig.ebene).raw().toBuffer({ resolveWithObject: true });
        let anders = 0, innen = 0, deckungGleich = true, dunkler = 0, heller = 0;
        for (let i = 0; i < 1024 * 1024; i++) { const o = i * 4; if (a.data[o + 3] !== b.data[o + 3]) deckungGleich = false; if (a.data[o + 3] < 200) continue; innen++; if (Math.abs(a.data[o] - b.data[o]) > 60) anders++; if (b.data[o] < a.data[o] - 8) dunkler++; if (b.data[o] > a.data[o] + 8) heller++; }
        pruefe('Handtuch im Sand: mit Wellen folgt das Motiv den Falten (Streifen verschoben), Maskenkante unveraendert, Faltenschatten kraeftiger', MK.MASKEN['handtuch-szene'].wellen >= 5 && MK.MASKEN['strandtuch-szene'].wellen >= 5 && MK.MASKEN['handtuch-szene'].kontrast > 1 && innen > 100000 && anders / innen > 0.08 && deckungGleich && dunkler > innen * 0.05 && heller > innen * 0.02, JSON.stringify({ innen, anders: +(anders / innen).toFixed(3), deckungGleich, dunkler: +(dunkler / innen).toFixed(3), heller: +(heller / innen).toFixed(3) }));
      }
    }
    // 20. Sept., Markus: "Leg das Strandtuch einfach auf den Strand, so wie es da liegen wuerde."
    // Liegend aus Augenhoehe: das Motiv sitzt perspektivisch im Viereck - oben (fern) rot, unten (nah)
    // blau, und neben dem Tuch (in der rechteckigen Huelle, aber ausserhalb des Vierecks) Sand.
    {
      const liegend = await MK.makeMockup(halb, 'strandtuch', 'white', false, { print: 'dunkel', ansicht: 'szene', artikel: { ansicht: 'strandtuch', motivart: 'vollflaechig', netto: [70, 140] } });
      const r = await sharp(liegend).raw().toBuffer({ resolveWithObject: true });
      const px = (x, y) => { const i = (y * r.info.width + x) * r.info.channels; return [r.data[i], r.data[i + 1], r.data[i + 2]]; };
      // 21. Sept.: das Tuch liegt im Sand, von oben; 22. Sept.: locker mit Wellen (Flaeche 291/63,
      // 440 x 904): obere Haelfte rot, untere blau, links daneben und unter dem Tuch Sand.
      const oben = px(512, 250), unten = px(512, 800), neben = px(180, 500), ganzUnten = px(512, 1000);
      // 22. Sept.: in einer Falte ist das Blau dunkler (Schattierung mit kontrast) - blau bleibt blau.
      const rot = c => c[0] > 150 && c[1] < 80 && c[2] < 90, blau = c => c[2] > 110 && c[0] < 90 && c[2] > c[0] * 2, sand = c => c[0] > c[2] + 25 && !rot(c);
      pruefe('Strandtuch im Sand: das ganze Motiv (oben rot, unten blau), daneben und darunter Sand', rot(oben) && blau(unten) && sand(neben) && sand(ganzUnten), JSON.stringify({ oben, unten, neben, ganzUnten }));
    }
    pruefe('Strandtuch in Benutzung liegt auf der Strandvorlage (mitgelieferte Flaeche), nicht vor grauem Grund', !szeneJpg.equals(sachlichJpg) && warmSzene >= 2 && warmSachlich === 0, 'warme Ecken Szene ' + warmSzene + ' von 3 · sachlich ' + warmSachlich);
    // 20. Sept., Markus: "eine Postkarte auf ein grosses Poster kann aufgrund des Formats nicht
    // funktionieren." Ein Querformat-Motiv kommt auf die Querformat-Vorlage (Poster, Acrylbild, Tuerschild).
    const quer = await sharp({ create: { width: 1772, height: 1260, channels: 4, background: { r: 200, g: 30, b: 40, alpha: 1 } } }).png().withMetadata({ density: 300 }).toBuffer();
    const breiteVon = async (jpg, tplKey) => {
      const t = await sharp(path.join(tmp, 'templates', tplKey + '.png')).raw().toBuffer({ resolveWithObject: true });
      const m2 = await sharp(jpg).raw().toBuffer({ resolveWithObject: true });
      // Gezaehlt werden Spalten, in denen das Motiv wirklich liegt (mindestens 100 abweichende
      // Pixel) - einzelne Pixel an der Rahmenkante (JPEG) zaehlen nicht mit.
      const spalten = new Array(1024).fill(0);
      for (let y = 0; y < 1024; y++) for (let x = 0; x < 1024; x++) { const i = (y * 1024 + x) * t.info.channels, j = (y * 1024 + x) * m2.info.channels; if (Math.abs(m2.data[j] - t.data[i]) + Math.abs(m2.data[j + 1] - t.data[i + 1]) + Math.abs(m2.data[j + 2] - t.data[i + 2]) > 60) spalten[x]++; }
      return spalten.filter(n => n >= 100).length;
    };
    const posterQuer = await MK.makeMockup(quer, 'poster', 'white', false, { print: 'hell', artikel: { ansicht: 'poster', motivart: 'vollflaechig', netto: [15, 10.5] } });
    const bq = await breiteVon(posterQuer, 'poster-quer_white');
    pruefe('Querformat-Motiv auf dem Poster: Querformat-Vorlage, Motiv ueber die ganze Breite (vorher klein im Hochformat-Rahmen)', bq >= MK.MITGELIEFERT['poster-quer'].box.w - 6 && bq <= MK.MITGELIEFERT['poster-quer'].box.w + 6, 'Motivbreite ' + bq + ' px, Rahmen ' + MK.MITGELIEFERT['poster-quer'].box.w);
    const posterQuerSzene = await MK.makeMockup(quer, 'poster', 'white', false, { print: 'hell', ansicht: 'szene', artikel: { ansicht: 'poster', motivart: 'vollflaechig', netto: [15, 10.5] } });
    const bqs = await breiteVon(posterQuerSzene, 'poster-quer-szene_white');
    pruefe('Querformat-Poster in Benutzung: an der Wand im Querformat-Rahmen', await MK.szeneMoeglich('poster', 'white', true) && bqs >= MK.MITGELIEFERT['poster-quer-szene'].box.w - 6 && bqs <= MK.MITGELIEFERT['poster-quer-szene'].box.w + 6, 'Motivbreite ' + bqs);
    const posterHoch = await MK.makeMockup(master, 'poster', 'white', false, { print: 'dunkel' });
    // 21. Sept.: das Poster traegt eine Maske (das Papier); der Druck fuellt das Papier, nicht mehr
    // nur den vorsichtigen Startwert aus GARMENTS.
    const posterMaske = await MK.maskeKanten(await fs.readFile(path.join(tmp, 'templates', 'poster.maske.png')));
    pruefe('Hochformat-Motiv bleibt auf der Hochformat-Vorlage des Posters', !posterHoch.equals(posterQuer) && (await breiteVon(posterHoch, 'poster_white')) <= posterMaske.box.w + 6, 'Breite ' + await breiteVon(posterHoch, 'poster_white') + ' zu Papier ' + posterMaske.box.w);
    // 20. Sept., Markus: "Eine Postkarte passt so nicht aufs Handtuch - bitte drehen." Ein Querformat-
    // Motiv liegt auf dem hochformatigen Tuch laengs: gedreht, hoeher als breit, ueber die Tuchbreite.
    {
      const rotBlock = await sharp({ create: { width: 400, height: 1000, channels: 4, background: { r: 200, g: 30, b: 40, alpha: 1 } } }).png().toBuffer();
      const querFrei = await sharp({ create: { width: 1772, height: 1260, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: rotBlock, left: 136, top: 130 }, { input: rotBlock, left: 1236, top: 130 }]).png().withMetadata({ density: 300 }).toBuffer();   // 1500 x 1000 Umriss, Luft in der Mitte
      const aufTuch = await sharp(await MK.makeMockup(querFrei, 'strandtuch', 'white', false, { print: 'hell', artikel: { ansicht: 'poster', motivart: 'vollflaechig', netto: [15, 10.5] } })).raw().toBuffer({ resolveWithObject: true });
      const t2 = await sharp(path.join(tmp, 'templates', 'strandtuch_white.png')).raw().toBuffer({ resolveWithObject: true });
      let x0 = 1024, x1 = -1, y0 = 1024, y1 = -1;
      for (let y = 0; y < 1024; y++) for (let x = 0; x < 1024; x++) { const i = (y * 1024 + x) * t2.info.channels, j = (y * 1024 + x) * aufTuch.info.channels; if (Math.abs(aufTuch.data[j] - t2.data[i]) + Math.abs(aufTuch.data[j + 1] - t2.data[i + 1]) + Math.abs(aufTuch.data[j + 2] - t2.data[i + 2]) > 60) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1, tuch = MK.GARMENTS.strandtuch.box;
      pruefe('Querformat-Motiv auf dem Strandtuch wird gedreht und liegt laengs (hoeher als breit, ueber die Tuchbreite)', bh > bw * 1.3 && bw >= tuch.w - 6 && bw <= tuch.w + 6, `Motiv ${bw}x${bh} auf Tuch ${tuch.w}x${tuch.h}`);
      // 20. Sept., Markus: "Es bleiben ja zwangslaeufig leere Flaechen - was machen wir automatisch
      // damit?" Deckendes Motiv (die Karte, hier: links rot, rechts blau): der Rest der Flaeche bekommt
      // das Motiv weichgezeichnet als Hintergrund - oben und unten auf dem Tuch ist es also farbig,
      // nicht weisser Stoff. Beim freistehenden Motiv bleibt der Stoff weiss.
      const karte = await sharp({ create: { width: 1772, height: 1260, channels: 4, background: { r: 200, g: 30, b: 40, alpha: 1 } } })
        .composite([{ input: await sharp({ create: { width: 886, height: 1260, channels: 4, background: { r: 30, g: 60, b: 220, alpha: 1 } } }).png().toBuffer(), left: 886, top: 0 }]).png().withMetadata({ density: 300 }).toBuffer();
      const voll = await sharp(await MK.makeMockup(karte, 'strandtuch', 'white', false, { print: 'hell', artikel: { ansicht: 'poster', motivart: 'vollflaechig', netto: [15, 10.5] } })).raw().toBuffer({ resolveWithObject: true });
      const pxV = (x, y) => { const i = (y * 1024 + x) * voll.info.channels; return [voll.data[i], voll.data[i + 1], voll.data[i + 2]]; };
      const pxF = (x, y) => { const i = (y * 1024 + x) * aufTuch.info.channels; return [aufTuch.data[i], aufTuch.data[i + 1], aufTuch.data[i + 2]]; };
      const bunt = c => Math.max(...c) - Math.min(...c) > 25, hell = c => Math.min(...c) > 170 && Math.max(...c) - Math.min(...c) < 25;
      const obenV = pxV(tuch.x + Math.round(tuch.w / 2), tuch.y + 30), untenV = pxV(tuch.x + Math.round(tuch.w / 2), tuch.y + tuch.h - 30);
      const obenF = pxF(tuch.x + Math.round(tuch.w / 2), tuch.y + 30), untenF = pxF(tuch.x + Math.round(tuch.w / 2), tuch.y + tuch.h - 30);
      pruefe('Flachware: leere Flaeche neben einem deckenden Motiv wird aus dem Motiv gefuellt; neben einem freistehenden bleibt der Stoff', bunt(obenV) && bunt(untenV) && hell(obenF) && hell(untenF), JSON.stringify({ obenV, untenV, obenF, untenF }));
      // Markus, 23:50: "Bei der Postkarte aus Frankreich wuerde mir die Frankreich-Flagge einfallen."
      // Land bekannt -> die Flagge fuellt den Rest: Frankreich senkrecht blau, weiss, rot (auf dem
      // hochformatigen Tuch: links blau, Mitte weiss, rechts rot - oben wie unten).
      const mitFlagge = await sharp(await MK.makeMockup(karte, 'strandtuch', 'white', false, { print: 'hell', land: 'Frankreich', artikel: { ansicht: 'poster', motivart: 'vollflaechig', netto: [15, 10.5] } })).raw().toBuffer({ resolveWithObject: true });
      const pxM = (x, y) => { const i = (y * 1024 + x) * mitFlagge.info.channels; return [mitFlagge.data[i], mitFlagge.data[i + 1], mitFlagge.data[i + 2]]; };
      const links = pxM(tuch.x + 30, tuch.y + 30), mitte = pxM(tuch.x + Math.round(tuch.w / 2), tuch.y + 30), rechts = pxM(tuch.x + tuch.w - 30, tuch.y + tuch.h - 30);
      const blau = c => c[2] > 120 && c[0] < 60, weiss = c => Math.min(...c) > 200, rotF = c => c[0] > 180 && c[2] < 90;
      pruefe('Deckendes Querformat aus Frankreich: der Rest des Tuchs traegt die Trikolore (blau, weiss, rot)', blau(links) && weiss(mitte) && rotF(rechts), JSON.stringify({ links, mitte, rechts }));
      pruefe('Flagge nur fuer bekannte Streifenflaggen; Deutschland waagerecht, Schweiz keine', !!MK.flaggeFuer('Frankreich') && MK.flaggeFuer('Deutschland').richtung === 'waagerecht' && MK.flaggeFuer('Schweiz') === null && MK.flaggeFuer('') === null);
    // 21. Sept., Markus: Startseiten-Band "quer durch alle Artikel ... auch mal von hinten mit Namensliste"
    const teile = ['tee', 'hoodie', 'tasse', 'beutel', 'strandtuch', 'sticker'];
    const reihe = [0, 1, 2, 3, 4, 5].map(i => MK.schaufensterTeil(teile, i, true));
    pruefe('Band: das Teil wechselt je Design durch die Artikel des Mottos, jedes dritte Textil von hinten (nur bei Rueckseite)', new Set(reihe.map(r => r.garment)).size === 6 && reihe.some(r => r.side === 'back') && reihe.every(r => !r.side || ['tee', 'hoodie', 'zip', 'polo'].includes(r.garment)) && [0, 1, 2, 3, 4, 5].every(i => MK.schaufensterTeil(teile, i, false).side === ''), JSON.stringify(reihe));
    // 22. Sept., 07:01, Markus: "Warum sind hier schon wieder nicht alle Artikel?" / "Warum faellt
    // das immer wieder zurueck?" - weil es nie gemessen wurde. Jetzt: 230 Designs, davon zehn fuer
    // je einen Artikel gezeichnet (plus Doppelte): jeder Artikel steht genau einmal im Band von 40,
    // verteilt, nicht geballt; ohne Artikel-Designs bleibt das Band voll; nie mehr als limit.
    {
      const pool = [];
      for (let i = 0; i < 220; i++) pool.push({ id: 't' + i, artikel: '' });
      const arten = ['kissen', 'handtuch', 'strandtuch', 'mousepad', 'hundedecke', 'fussmatte', 'tuerschild', 'acrylbild', 'beutel', 'gepaeckanhaenger'];
      arten.forEach((a, i) => { pool.push({ id: 'a' + i, artikel: a }); pool.push({ id: 'b' + i, artikel: a }); });
      const band = MK.bandAuswahl(pool.slice(), 40);
      const imBand = band.filter(x => x.artikel).map(x => x.artikel);
      const positionen = band.map((x, i) => x.artikel ? i : -1).filter(i => i >= 0);
      const abstaende = positionen.slice(1).map((p, i) => p - positionen[i]);
      const nurTextil = MK.bandAuswahl(pool.filter(x => !x.artikel), 40);
      const nurArtikel = MK.bandAuswahl(pool.filter(x => x.artikel), 40);
      pruefe('Band "Das hat Otto gezeichnet": jeder Artikel mit eigenem Design steht genau einmal im Band, gleichmaessig verteilt', band.length === 40 && new Set(imBand).size === arten.length && imBand.length === arten.length && Math.max(...abstaende) <= 5 && Math.min(...abstaende) >= 2 && nurTextil.length === 40 && nurArtikel.length === arten.length && new Set(band.map(x => x.id)).size === 40, JSON.stringify({ artikel: imBand, positionen, nurTextil: nurTextil.length, nurArtikel: nurArtikel.length }));
      // 22. Sept., 10:00, Markus: "Auf eine Hundedecke ein Hochzeitsmotiv zu machen, ist total
      // bescheuert. Da kommt natuerlich ein Hundemotiv rein. Ein Tuerschild muss irgendwas mit einer
      // Familie zu tun haben. Napfunterlage hat mit dem Tier zu tun." Vorgezeigt wird je Artikel nur,
      // was passt; Artikel ohne Regel (Kissen, Handtuch ...) nehmen jedes Motto.
      pruefe('Vorzeigen je Artikel: Hundedecke und Napfunterlage nur mit Tiermotiv, Tuerschild nur mit Familie, Kissen mit allem', !MK.passtVorzeige('hundedecke', 'hochzeit') && MK.passtVorzeige('hundedecke', 'tier-shirt') && !MK.passtVorzeige('napfunterlage', 'hochzeit') && MK.passtVorzeige('napfunterlage', 'kinder-tiershirt') && !MK.passtVorzeige('tuerschild', 'hochzeit') && MK.passtVorzeige('tuerschild', 'familie') && MK.passtVorzeige('kissen', 'hochzeit') && MK.passtVorzeige('handtuch', 'malle-fahrt'));
      // 22. Sept., Markus: "Eine Tasse kann vollflaechig bedruckt werden - das ist das, womit wir
      // werben." Bei einem randlosen Rundumdruck fuellt das Design den ganzen Streifen; ohne
      // Verschiebung laege seine Mitte an der linken Silhouette, und von vorn saehe man den Rand.
      // Probe: Streifen links rot, Mitte gruen, rechts blau - von vorn muss GRUEN zu sehen sein.
      {
        const drittel = await sharp({ create: { width: 1800, height: 800, channels: 4, background: { r: 220, g: 30, b: 30, alpha: 1 } } })
          .composite([
            { input: await sharp({ create: { width: 600, height: 800, channels: 4, background: { r: 30, g: 190, b: 60, alpha: 1 } } }).png().toBuffer(), left: 600, top: 0 },
            { input: await sharp({ create: { width: 600, height: 800, channels: 4, background: { r: 30, g: 60, b: 220, alpha: 1 } } }).png().toBuffer(), left: 1200, top: 0 }
          ]).png().withMetadata({ density: 300 }).toBuffer();
        const tasse = await MK.makeMockup(drittel, 'tasse', 'white', false, { print: 'hell', artikel: { ansicht: 'tasse', motivart: 'vollflaechig', netto: MK.GARMENTS.tasse.flaecheCm } });
        const r = await sharp(tasse).raw().toBuffer({ resolveWithObject: true });
        const zyl = MK.zylinderAusBox(MK.BOX_OVERRIDES['tasse_white']);
        const px = (x, y) => { const i = (y * r.info.width + x) * r.info.channels; return [r.data[i], r.data[i + 1], r.data[i + 2]]; };
        const mitte = px(Math.round(zyl.cx), Math.round((zyl.oben.y + zyl.oben.e + zyl.unten.y + zyl.unten.e) / 2));
        const gruen = (c) => c[1] > c[0] + 30 && c[1] > c[2] + 30;
        pruefe('Tasse, Rundumdruck: vorn sieht man die MITTE des Designs (Streifen rot-gruen-blau -> gruen)', gruen(mitte), JSON.stringify({ mitte, cx: zyl.cx }));
      }
      // 22. Sept., Markus: "Wir koennen jeden Artikel, auch die Brotdose, vollflaechig bespielen."
      // Der ganze Deckel wird bedruckt: obere Haelfte rot, untere blau, nichts abgeschnitten,
      // nichts unbedruckt - gezaehlt innerhalb der Maske, sechs Pixel von der Kante entfernt.
      {
        const bd = await MK.makeMockup(halb, 'brotdose', 'white', false, { print: 'dunkel', artikel: { ansicht: 'brotdose', motivart: 'vollflaechig', netto: MK.GARMENTS.brotdose.flaecheCm } });
        const r = await sharp(bd).raw().toBuffer({ resolveWithObject: true });
        const mk = await MK.maskeKanten(await fs.readFile(path.join(tmp, 'templates', 'brotdose.maske.png')));
        const b = mk.box; let rot = 0, blau = 0, rotUnten = 0, blauOben = 0;
        for (let y = b.y + 4; y < b.y + b.h - 4; y += 3) for (let x = b.x + 4; x < b.x + b.w - 4; x += 3) {
          if (mk.maske[(y * 1024 + x) * mk.ch] < 128 || x < mk.links[y] + 6 || x > mk.rechts[y] - 6 || y < mk.oben[x] + 6 || y > mk.unten[x] - 6) continue;
          const i = (y * r.info.width + x) * r.info.channels;
          if (r.data[i] > 150 && r.data[i + 2] < 90) { rot++; if (y > b.y + b.h * 0.6) rotUnten++; }
          else if (r.data[i + 2] > 150 && r.data[i] < 90) { blau++; if (y < b.y + b.h * 0.4) blauOben++; }
        }
        const anteil = rot / (rot + blau);
        pruefe('Brotdose: der ganze Deckel ist bedruckt (obere Haelfte rot, untere blau), nichts abgeschnitten', blau > 1000 && rot > 1000 && anteil > 0.4 && anteil < 0.6 && rotUnten === 0 && blauOben === 0, 'Rot-Anteil ' + anteil.toFixed(2) + ' · rot unten ' + rotUnten + ' · blau oben ' + blauOben);
        pruefe('Brotdose ist ein eigener Artikel (18,5 x 12 cm, vollflaechig) und wird nur mit Kindermottos vorgezeigt', MK.GARMENTS.brotdose.voll === true && MK.GARMENTS.brotdose.flaecheCm[0] === 18.5 && MK.passtVorzeige('brotdose', 'kinder-tiershirt') && !MK.passtVorzeige('brotdose', 'hochzeit'));
      }
      // "Die Fussmatte liegt doch anders vor der Tuer, d. h. das Format ist falsch." Quer, 60 x 40.
      pruefe('Fussmatte liegt quer (60 x 40), Produktansicht und Haustuer-Szene im Querformat', MK.GARMENTS.fussmatte.flaecheCm[0] === 60 && MK.GARMENTS.fussmatte.flaecheCm[1] === 40 && MK.MITGELIEFERT.fussmatte.box.w > MK.MITGELIEFERT.fussmatte.box.h * 1.4 && MK.MITGELIEFERT['fussmatte-szene'].box.w > MK.MITGELIEFERT['fussmatte-szene'].box.h * 1.4 && MK.MASKEN['hundedecke-szene'].wellen >= 5, JSON.stringify({ flaeche: MK.GARMENTS.fussmatte.flaecheCm, box: MK.MITGELIEFERT.fussmatte.box }));
    }
    const kacheln = (await fs.readdir('stile/kacheln')).filter(f => f.endsWith('.jpg')).map(f => f.replace('.jpg', ''));
    const { STYLE_KEYS: SK, STYLES: ST } = await import('./mottos.js');
    const fehltKachel = SK.filter(k => k !== 'standard' && !ST[k].off && !ST[k].nurMotto && !kacheln.includes(k));   // "Wie vorgesehen kann weg" (Markus)
    pruefe('Stil-Kacheln: fuer jeden Stil ohne festes Motto liegt die Schrift-Kachel im Repo (stile/kacheln)', !fehltKachel.length, fehltKachel.join(', '));
    // 21. Sept., 08:15, Markus: "die Kacheln fuer die Mottos keine Textilien, sondern einfach das
    // Motto cool in die Kachel bringen." Je Motto eine Schrift-Kachel im Repo, quadratisch, 800 px.
    {
      const mk = (await fs.readdir('mottos/kacheln')).filter(f => f.endsWith('.jpg')).map(f => f.replace('.jpg', ''));
      const alleMottos = (await fs.readdir('storage/mottos')).filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
      const fehltMotto = [...new Set(alleMottos)].filter(s => !mk.includes(s));
      const masse = await Promise.all(mk.slice(0, 26).map(async s => { const m = await sharp(path.join('mottos/kacheln', s + '.jpg')).metadata(); return m.width === 800 && m.height === 800; }));
      pruefe('Motto-Kacheln: fuer jedes Motto liegt die Schrift-Kachel im Repo (mottos/kacheln), 800 x 800 px', !fehltMotto.length && mk.length >= 26 && masse.every(Boolean), fehltMotto.join(', ') || `${mk.length} Kacheln`);
    }
    // 22. Sept., Markus: "Wie schliessen wir die andere Luecke?" - Der Server legt ein FEHLENDES
    // Motto mit {...Saat-Eintrag} an; was die Saat nicht nennt, bekommt den Standard aus
    // sanitizeMotto. Zwei Mottos hatten ueberhaupt keinen Eintrag: "freestyle" und "gruesse-aus".
    // Nach einem leeren Volume waere die Postkarte weg gewesen - mit artikelFest, standort,
    // teilen, Abfolge, stileVorne und bildStufe. Diese Probe haelt fest, dass die Saat jedes
    // Motto vollstaendig wiederherstellt. Nachziehen: node werkzeug/saat-abgleich.mjs
    {
      const { saatLuecken } = await import('./mottos.js');
      const saat = new Map(JSON.parse(await fs.readFile('seed.json', 'utf8')).map(m => [m.slug, m]));
      const dateien = (await fs.readdir('storage/mottos')).filter(f => f.endsWith('.json'));
      const ohne = [], mitLuecke = [];
      for (const f of dateien) {
        const m = JSON.parse(await fs.readFile(path.join('storage/mottos', f), 'utf8'));
        const e = saat.get(m.slug);
        if (!e) { ohne.push(m.slug); continue; }
        const fehlt = saatLuecken(m, e);
        if (fehlt.length) mitLuecke.push(m.slug + ': ' + fehlt.join(','));
      }
      pruefe('Saat: jedes Motto im Speicher hat einen Eintrag - nach einem leeren Volume geht keines verloren', !ohne.length, ohne.join(', '));
      pruefe('Saat: jeder Wert, der vom Standard abweicht, steht auch in der Saat - das Volume ist wiederherstellbar', !mitLuecke.length, mitLuecke.join(' · '));
    }
    // 23. Sept.: saatLuecken() prueft nur die Schalter aus SAAT_STANDARD - Text nicht. Dabei
    // lagen die VARIATIONEN von fuenf Mottos (angler, jaeger, karneval, landwirt, motorrad) nur
    // im Speicher und standen gar nicht in der Saat; bei dreien war auch der Auftrag aelter als
    // der im Speicher. Nach einem leeren Volume waeren die Variationen weg gewesen und die
    // Mottos auf einen alten Auftrag zurueckgefallen - unsichtbar, weil kein Schalter betroffen
    // ist. Die Probe vergleicht jetzt auch den Text.
    {
      const saatT = new Map(JSON.parse(await fs.readFile('seed.json', 'utf8')).map(m => [m.slug, m]));
      const anders = [];
      for (const f of (await fs.readdir('storage/mottos')).filter(f => f.endsWith('.json'))) {
        const m = JSON.parse(await fs.readFile(path.join('storage/mottos', f), 'utf8'));
        const e = saatT.get(m.slug) || {};
        for (const k of ['prompt', 'variations', 'suggestions']) {
          const ist = String(m[k] || ''), soll = String(e[k] || '');
          // Ein Motto, das den Wert gar nicht fuehrt, ist in Ordnung; nur ein gefuellter Wert,
          // den die Saat anders oder gar nicht kennt, geht beim Wiederherstellen verloren.
          if (ist && ist !== soll) anders.push(m.slug + '/' + k + (soll ? ' (weicht ab)' : ' (fehlt in der Saat)'));
        }
      }
      pruefe('Saat: Auftrag, Variationen und Vorschlaege stehen WOERTLICH in der Saat', !anders.length, anders.join(' · '));
    }
    // 23. Sept., Markus zu den neuen Meisterwerk-Bildern: "Wir hatten noch ganz klar gesagt, dass
    // wir das sein lassen, irgendwo ein Loch zu lassen, sondern immer alles rund um ein
    // geliefertes Logo bauen. Es wird einfach nicht funktionieren, weil nicht alle Logos rund
    // sind und dann sieht es scheisse aus." Vier Mottos bestellten die Leerflaeche FEST im
    // Auftrag - abschlussfahrt, handwerker-shirt, firmenausflug, vereinsjubilaeum. Ohne Logo
    // raeumte das nur logoStelleRaus() weg, und das laeuft nur, wenn das Motto ueberhaupt ein
    // Logo vorsieht. Bei den Vorzeige-Bildern lief es nie - deshalb das weisse Loch im Wappen.
    // Jetzt steht die Leerflaeche in KEINEM Motto-Text mehr; wo ein Logo kommt, sagt der
    // Logo-Zweig, wie das Design darum herum gebaut wird.
    {
      const bestellt = [], inVar = [];
      for (const f of (await fs.readdir('storage/mottos')).filter(f => f.endsWith('.json'))) {
        const m = JSON.parse(await fs.readFile(path.join('storage/mottos', f), 'utf8'));
        const pr = String(m.prompt || '');
        // Ein Satz, der eine Flaeche FORDERT. Das Verbot ("no empty area", "Leave no empty area")
        // darf stehen bleiben - genau das soll ja drinstehen.
        if (/(?<!no\s)(?<!Leave no\s)(leave (an?|one) (clearly )?(bounded )?empty|stays (completely )?empty for|a clearly empty area)/i.test(pr)) bestellt.push(m.slug);
        if (/(empty|free|reserved) (emblem |logo )?area/i.test(String(m.variations || ''))) inVar.push(m.slug);
      }
      pruefe('kein Motto-Auftrag bestellt noch eine Leerflaeche fuer ein Logo', !bestellt.length, bestellt.join(', '));
      pruefe('keine Variation baut auf einer Leerflaeche auf', !inVar.length, inVar.join(', '));
    }
    // Und ein Koerperteil ohne Koerper: der Landwirt zeigte einen Arm, der aus dem Nichts kam.
    // Die Regel dagegen stand nur in den Logo-Zweigen - jetzt in den allgemeinen Druckregeln.
    {
      const { buildPrompt } = await import('./mottos.js');
      const p2 = buildPrompt({ slug: 'probe', prompt: 'Test print.', fields: [] }, {}, { textile: 'hell' });
      pruefe('jedes Koerperteil gehoert zu einem Koerper - gilt fuer jeden Auftrag, nicht nur mit Logo',
        /EVERY BODY PART BELONGS TO A BODY/.test(p2) && /reaching in from nowhere/.test(p2));
    }
    // 22. Sept., Markus zum neuen Motto Bowling: "Da sind nicht neun, da sind glaub ich zehn Pins,
    // bitte recherchieren" und "die Kugel ist anders." Stimmt: Bowling ist Ten-Pin - zehn Pins im
    // gleichseitigen Dreieck aus vier Reihen (1-2-3-4), weiss mit zwei roten Halsringen; die Kugel
    // ist gross, farbig und hat DREI Bohrloecher. "Alle Neune" ist Kegeln und hat hier nichts zu
    // suchen. Die Probe haelt die Recherche fest, damit sie nicht wieder zurueckfaellt.
    {
      const bw = JSON.parse(await fs.readFile('storage/mottos/bowling.json', 'utf8'));
      const saat = JSON.parse(await fs.readFile('seed.json', 'utf8')).find(m => m.slug === 'bowling');
      const alles = JSON.stringify(bw) + JSON.stringify(saat);
      pruefe('Bowling: der Auftrag bestellt zehn Pins im Dreieck aus vier Reihen und verbietet neun ausdruecklich', /TEN pins/.test(bw.prompt) && /four rows/.test(bw.prompt) && /Never nine/.test(bw.prompt) && /ten pins/.test(bw.variations));
      // 22. Sept., zweite Runde: die Bild-KI zaehlt nicht. Ein Pulk aus sieben, acht, neun Pins
      // entsteht von selbst - und genau den zaehlt jemand nach. Deshalb die Regel im Auftrag:
      // das volle Dreieck NUR von oben (da sind alle zehn einzeln sichtbar), sonst hoechstens
      // drei Pins als Grafik. Keine Variation darf mehr einen Pulk bestellen.
      pruefe('Bowling: das volle Dreieck nur von oben, sonst hoechstens drei Pins - kein Pulk aus fuenf bis neun', /seen from above/.test(bw.prompt) && /one, two or three of them/.test(bw.prompt) && /five to nine/.test(bw.prompt));
      pruefe('Bowling: keine Variation bestellt einen halben Satz Pins', !/rack of pins|pins flying|a pin gang/.test(bw.variations), (bw.variations.match(/.{0,40}(rack of pins|pins flying|a pin gang).{0,20}/) || [''])[0]);
      pruefe('Bowling: die Kugel ist gross, farbig und hat drei Bohrloecher - nicht die lochlose Kegelkugel', /THREE drilled holes/.test(bw.prompt) && /thumb hole/.test(bw.prompt) && /hole-less ball of Kegeln/.test(bw.prompt));
      pruefe('Bowling: nirgends "Alle Neune" (das ist Kegeln), weder im Motto noch in der Saat', !/Neune/.test(alles), (alles.match(/.{0,30}Neune.{0,20}/) || [''])[0]);
      pruefe('Bowling: die Saat traegt die berichtigte Fassung mit hoeherem rev, damit das Volume sie uebernimmt', !!saat && (+saat.rev || 1) >= 2 && saat.prompt === bw.prompt && saat.variations === bw.variations && saat.suggestions === bw.suggestions, JSON.stringify({ rev: saat && saat.rev, seedRev: bw.seedRev }));
    }
    // 23. Sept.: beim Neuzeichnen von Meisterwerk fiel der umgekehrte Fehler auf - KEGELTOUR war
    // als Zehner-Bowling gezeichnet: Bowlingkugel mit drei Loechern, fette Pins mit roten
    // Halsringen, breite geoelte Bahn. Der Verein heisst "Alle Neune", das ist Kegeln. Im Auftrag
    // stand zur Ausruestung gar nichts, also nahm das Modell die Bowlingbahn. Recherchiert
    // (Deutscher Keglerbund, SV Semper Berlin): neun Kegel im auf der Spitze stehenden Quadrat
    // (1-2-3-2-1), der mittlere ist der KOENIG mit Kappe und etwas groesser; die Kegelkugel ist
    // klein und hat KEINE Loecher; die Bahn ist schmal und dunkel.
    {
      const kt = JSON.parse(await fs.readFile('storage/mottos/kegeltour.json', 'utf8'));
      const saatKt = JSON.parse(await fs.readFile('seed.json', 'utf8')).find(m => m.slug === 'kegeltour');
      pruefe('Kegeln: der Auftrag bestellt neun Kegel in der Raute und verbietet das Dreieck', /NINE pins/.test(kt.prompt) && /SQUARE STANDING ON ITS POINT/.test(kt.prompt) && /Never a triangle/.test(kt.prompt));
      pruefe('Kegeln: der Koenig steht drin - der groessere Kegel in der Mitte', /KOENIG/.test(kt.prompt));
      pruefe('Kegeln: die Kugel hat KEINE Loecher - nicht der Bowlingball', /NO HOLES AT ALL/.test(kt.prompt) && /three drilled finger holes/.test(kt.prompt));
      pruefe('Kegeln: die Bahn ist schmal und dunkel, nicht die geoelte Bowlingbahn', /oiled bowling lane/.test(kt.prompt));
      pruefe('Kegeln: die Saat traegt die Fassung mit hoeherem rev', !!saatKt && (+saatKt.rev || 1) >= 3 && saatKt.prompt === kt.prompt, JSON.stringify({ rev: saatKt && saatKt.rev }));
    }
    }
    // 21. Sept., 07:33, Markus (Postkarte auf der Tasse): "nicht an der Tasse ausgerichtet - Katastrophe."
    // Das Motiv liegt jetzt um die Woelbung: mittig auf dem Tassenkoerper, an den Raendern dunkler.
    {
      const breit = await sharp({ create: { width: 1800, height: 900, channels: 4, background: { r: 40, g: 160, b: 60, alpha: 1 } } }).png().withMetadata({ density: 300 }).toBuffer();
      const tasse = await sharp(await MK.makeMockup(breit, 'tasse', 'white', false, { print: 'hell' })).raw().toBuffer({ resolveWithObject: true });
      const px = (x, y) => { const i = (y * 1024 + x) * tasse.info.channels; return [tasse.data[i], tasse.data[i + 1], tasse.data[i + 2]]; };
      // 08:40, Markus: "die Rundung ueberhaupt nicht genau berechnet." Seitdem ein an der Vorlage
      // abgemessenes Zylindermodell (BOX_OVERRIDES.tasse_white.zylinder): der Druck reicht bis zur
      // linken Silhouette, endet vor dem Henkel (freier Streifen von 40 Grad um den Henkel), seine
      // Oberkante folgt der Ellipse des Trinkrands (an der Seite hoeher als vorn in der Mitte).
      const tb = MK.GARMENTS.tasse.box, zyl = MK.BOX_OVERRIDES.tasse_white.zylinder, cx = Math.round(zyl.cx), cy = Math.round((zyl.oben.y + zyl.oben.e + zyl.unten.y + zyl.unten.e) / 2);
      const druckWinkel = 2 * Math.PI * MK.GARMENTS.tasse.flaecheCm[0] / MK.GARMENTS.tasse.umfangCm, frei = (2 * Math.PI - druckWinkel) / 2;
      const ende = Math.round(zyl.cx + zyl.R * Math.sin(Math.PI / 2 - frei));   // hier hoert der Druck vor dem Henkel auf
      const mitte = px(cx, cy), rand = px(Math.round(zyl.cx - zyl.R) + 4, cy), links = px(Math.round(zyl.cx - zyl.R) - 30, cy);
      const vorEnde = px(ende - 8, cy), nachEnde = px(ende + 14, cy);
      const lippe = zyl.oben.y + zyl.oben.e;
      // Vorn in der Mitte beginnt der Druck unter der Lippe plus unbedrucktem Rand (rund 16 px),
      // an der Seite liegt der Trinkrand um e hoeher - dort ist auf Lippenhoehe schon Druck.
      const vornOben = px(cx, lippe + 4), seiteOben = px(Math.round(zyl.cx - zyl.R) + 14, lippe + 4), vornDrin = px(cx, lippe + 30);
      const gruen = c => c[1] > 100 && c[1] > c[0] + 40;
      pruefe('Tasse: Druck von der linken Silhouette bis vor den Henkel, daneben und im Henkelstreifen nichts', gruen(mitte) && gruen(rand) && !gruen(links) && gruen(vorEnde) && !gruen(nachEnde), JSON.stringify({ mitte, rand, links, vorEnde, nachEnde, ende }));
      pruefe('Tasse: die Oberkante des Drucks folgt dem Trinkrand - an der Seite hoeher als vorn in der Mitte', !gruen(vornOben) && gruen(seiteOben) && gruen(vornDrin), JSON.stringify({ vornOben, seiteOben, vornDrin, lippe }));
      // Markus: "Bei einer Tasse ist die vollflaechig bedruckt." Ein freistehendes Hochformat-Motiv
      // steht aufrecht auf der Tasse (nicht gedreht), und ein deckendes fuellt den ganzen Rundlauf -
      // vorn also von Rand zu Rand des Koerpers.
      const hoch = await sharp({ create: { width: 900, height: 1400, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: await sharp({ create: { width: 700, height: 300, channels: 4, background: { r: 20, g: 60, b: 200, alpha: 1 } } }).png().toBuffer(), left: 100, top: 100 }, { input: await sharp({ create: { width: 700, height: 300, channels: 4, background: { r: 20, g: 60, b: 200, alpha: 1 } } }).png().toBuffer(), left: 100, top: 1000 }]).png().withMetadata({ density: 300 }).toBuffer();
      const t2 = await sharp(await MK.makeMockup(hoch, 'tasse', 'white', false, { print: 'hell' })).raw().toBuffer({ resolveWithObject: true });
      const tpl2 = await sharp(path.join(tmp, 'templates', 'tasse_white.png')).raw().toBuffer({ resolveWithObject: true });
      let x0 = 1024, x1 = -1, y0 = 1024, y1 = -1;
      for (let y = 0; y < 1024; y++) for (let x = 0; x < 1024; x++) { const i = (y * 1024 + x) * tpl2.info.channels, j = (y * 1024 + x) * t2.info.channels; if (Math.abs(t2.data[j] - tpl2.data[i]) + Math.abs(t2.data[j + 1] - tpl2.data[i + 1]) + Math.abs(t2.data[j + 2] - tpl2.data[i + 2]) > 60) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
      // Mittig im sichtbaren Fenster (linke Silhouette bis Druckende vor dem Henkel), nicht in der
      // Mitte der Tasse: so sieht es der Kunde spaeter in der Hand.
      const fensterMitte = zyl.cx + zyl.R * Math.sin((-Math.PI / 2 + (Math.PI / 2 - frei)) / 2);
      pruefe('Tasse: ein Hochformat-Motiv steht aufrecht (nicht gedreht), mittig im sichtbaren Fenster vor dem Henkel', (y1 - y0) > (x1 - x0) && Math.abs((x0 + x1) / 2 - fensterMitte) < zyl.R * 0.1 && x1 < ende, `Motiv ${x1 - x0}x${y1 - y0}, Mitte ${(x0 + x1) / 2} zu ${Math.round(fensterMitte)}, rechts ${x1} vor ${ende}`);
    }
    // 21. Sept., 08:30, Markus (Kissen auf dem Sofa): "Das ist einfach nur ein Rechteck drauf
    // gemalt. Das ist kein Kissen. Es muss alles 100 % sein, immer wiederkehrend und skalierbar."
    // Vorlage mit Maske (MASKEN): der Druck folgt der Kissenkante bis zum Keder, das Sofa bleibt
    // unberuehrt, und die Schattierung des Fotos liegt auf dem Druck (unten dunkler als in der Mitte).
    {
      const maskeDa = await fs.access(path.join(tmp, 'templates', 'kissen-szene.maske.png')).then(() => true).catch(() => false);
      const gruenVoll = await sharp({ create: { width: 1200, height: 1200, channels: 4, background: { r: 40, g: 170, b: 60, alpha: 1 } } }).png().withMetadata({ density: 300 }).toBuffer();
      const km = await sharp(await MK.makeMockup(gruenVoll, 'kissen', 'white', false, { print: 'hell', ansicht: 'szene', artikel: { ansicht: 'kissen', motivart: 'vollflaechig', netto: [40, 40] } })).raw().toBuffer({ resolveWithObject: true });
      const kt = await sharp(path.join(tmp, 'templates', 'kissen-szene_white.png')).raw().toBuffer({ resolveWithObject: true });
      const kk = await MK.maskeKanten(await fs.readFile(path.join(tmp, 'templates', 'kissen-szene.maske.png')));
      const px = (x, y) => { const i = (y * 1024 + x) * km.info.channels; return [km.data[i], km.data[i + 1], km.data[i + 2]]; };
      // Toleranz 40: das Mockup ist ein JPEG, die Vorlage ein PNG - Kompression, kein Druck.
      const gleich = (x, y) => { const i = (y * 1024 + x) * km.info.channels, j = (y * 1024 + x) * kt.info.channels; return Math.abs(km.data[i] - kt.data[j]) + Math.abs(km.data[i + 1] - kt.data[j + 1]) + Math.abs(km.data[i + 2] - kt.data[j + 2]) < 40; };
      const gruen = c => c[1] > 60 && c[1] > c[0] + 30;
      const cy = Math.round(kk.box.y + kk.box.h / 2), cx = Math.round(kk.box.x + kk.box.w / 2);
      const l = Math.round(kk.links[cy]), r = Math.round(kk.rechts[cy]);
      const innenL = px(l + 6, cy), innenR = px(r - 6, cy), aussenL = gleich(l - 8, cy), aussenR = gleich(r + 8, cy), sofa = gleich(60, 980);
      const mitte = px(cx, cy), untenRand = px(cx, Math.round(kk.unten[cx]) - 10);
      pruefe('Kissen in Benutzung: Druck bis zur Kante des Kissens (Maske), links und rechts daneben bleibt das Foto', maskeDa && gruen(innenL) && gruen(innenR) && aussenL && aussenR && sofa, JSON.stringify({ maskeDa, innenL, innenR, aussenL, aussenR, sofa, l, r }));
      pruefe('Kissen in Benutzung: die Schattierung des Fotos liegt auf dem Druck (am unteren Rand dunkler als in der Mitte)', gruen(mitte) && gruen(untenRand) && untenRand[1] < mitte[1] - 8, JSON.stringify({ mitte, untenRand }));
    }
    // Markus, 21. Sept.: "Das machst du jetzt bitte fuer alle Artikel die wir haben." Jede Flachware
    // (Produktansicht und Situation, auch quer) hat eine Maske; sie liegt nach dem Start in templates/,
    // deckt die Flaeche der Vorlage (MITGELIEFERT.box, Abweichung unter 12 px auf 1024) und ist eine
    // zusammenhaengende, nicht winzige Flaeche. Und: der Druck faellt auf jeder dieser Vorlagen bis
    // zur Kante der Maske, daneben bleibt das Foto stehen.
    {
      const fehler = [];
      const keys = Object.keys(MK.MASKEN);
      for (const key of keys) {
        const f = path.join(tmp, 'templates', key + '.maske.png');
        const da = await fs.access(f).then(() => true).catch(() => false);
        if (!da) { fehler.push(key + ': keine Maske in templates'); continue; }
        const kk = await MK.maskeKanten(await fs.readFile(f));
        const m = MK.MITGELIEFERT[key];
        const gk = key.replace(/-szene$/, ''), gs = /-szene$/.test(key);
        const gb = MK.GARMENTS[gk] ? (gs ? (MK.GARMENTS[gk].szene && MK.GARMENTS[gk].szene.box) : MK.GARMENTS[gk].box) : null;
        if (m && m.box) {
          // selbst erzeugte Vorlage: die box wurde am selben Bild abgemessen - Maske und box muessen sich decken
          const abw = Math.max(Math.abs(kk.box.x - m.box.x), Math.abs(kk.box.y - m.box.y), Math.abs(kk.box.x + kk.box.w - m.box.x - m.box.w), Math.abs(kk.box.y + kk.box.h - m.box.y - m.box.h));
          if (abw > 12) fehler.push(key + ': Maske weicht ' + abw + ' px von der box ab');
        } else if (gb) {
          // Herstellerfoto: die box in GARMENTS ist ein vorsichtiger Startwert INNERHALB der Flaeche - die Maske muss ihn umfassen
          const drin = kk.box.x <= gb.x + 10 && kk.box.y <= gb.y + 10 && kk.box.x + kk.box.w >= gb.x + gb.w - 10 && kk.box.y + kk.box.h >= gb.y + gb.h - 10;
          if (!drin) fehler.push(key + ': Maske umfasst die box aus GARMENTS nicht (' + JSON.stringify(kk.box) + ' zu ' + JSON.stringify(gb) + ')');
        } else fehler.push(key + ': keine box in MITGELIEFERT/GARMENTS');
        if (kk.box.w * kk.box.h < 1024 * 1024 * 0.15) fehler.push(key + ': Maske zu klein');
      }
      pruefe('Masken fuer alle Flachware-Vorlagen (' + keys.length + '): vorhanden, decken die Flaeche der Vorlage (Abweichung unter 12 px)', fehler.length === 0, fehler.join(' | '));
      // Druck auf jeder Maske: eine Stichprobe je Vorlage - Mitte gruen, ausserhalb der Kante bleibt das Foto
      const gruenVoll = await sharp({ create: { width: 1200, height: 1200, channels: 4, background: { r: 40, g: 170, b: 60, alpha: 1 } } }).png().withMetadata({ density: 300 }).toBuffer();
      // Querformat-Vorlagen kommen automatisch, sobald das Motiv breiter als hoch ist
      const gruenQuer = await sharp({ create: { width: 1800, height: 1100, channels: 4, background: { r: 40, g: 170, b: 60, alpha: 1 } } }).png().withMetadata({ density: 300 }).toBuffer();
      const fehler2 = [];
      for (const key of keys) {
        const szene = /-szene$/.test(key), form = key.replace(/-szene$/, '');
        const quer = /-quer$/.test(form), garment = form.replace(/-quer$/, '');
        if (!MK.GARMENTS[garment] || !MK.GARMENTS[garment].voll) continue;   // Sticker: freistehend gestanzt, kein Vollflaechen-Druck
        try {
          const km = await sharp(await MK.makeMockup(quer ? gruenQuer : gruenVoll, garment, 'white', false, { print: 'hell', ansicht: szene ? 'szene' : undefined, artikel: { ansicht: garment, motivart: 'vollflaechig', netto: [40, 40] } })).raw().toBuffer({ resolveWithObject: true });
          const kt = await sharp(path.join(tmp, 'templates', key + '_white.png')).raw().toBuffer({ resolveWithObject: true });
          const kk = await MK.maskeKanten(await fs.readFile(path.join(tmp, 'templates', key + '.maske.png')));
          const px = (x, y) => { const i = (y * 1024 + x) * km.info.channels; return [km.data[i], km.data[i + 1], km.data[i + 2]]; };
          const gleich = (x, y) => { const i = (y * 1024 + x) * km.info.channels, j = (y * 1024 + x) * kt.info.channels; return Math.abs(km.data[i] - kt.data[j]) + Math.abs(km.data[i + 1] - kt.data[j + 1]) + Math.abs(km.data[i + 2] - kt.data[j + 2]) < 40; };
          const gruen = c => c[1] > 60 && c[1] > c[0] + 30;
          const cy = Math.round(kk.box.y + kk.box.h / 2), cx = Math.round(kk.box.x + kk.box.w / 2);
          const l = Math.round(kk.links[cy]), r = Math.round(kk.rechts[cy]);
          const ok = gruen(px(cx, cy)) && gruen(px(l + 6, cy)) && gruen(px(r - 6, cy)) && (l - 8 < 0 || gleich(l - 8, cy)) && (r + 8 > 1023 || gleich(r + 8, cy));
          if (!ok) fehler2.push(key + ': ' + JSON.stringify({ mitte: px(cx, cy), innenL: px(l + 6, cy), innenR: px(r - 6, cy), aussenL: gleich(l - 8, cy), aussenR: gleich(r + 8, cy) }));
        } catch (e) { fehler2.push(key + ': ' + (e && e.message ? e.message : e)); }
      }
      pruefe('Druck auf allen Masken-Vorlagen (' + keys.length + '): Motiv bis zur Kante, daneben bleibt das Foto', fehler2.length === 0, fehler2.join(' | '));
    }
    // 21. Sept., Markus: "ich erwarte auch, dass du die ganzen Mockups von den Textilien, die wir
    // ausgesucht haben, dir selber ziehst." Mit linie 'bc' bzw. 'ss' liegt das Design auf dem
    // Herstellerfoto (B&C, Stanley/Stella); ohne Linie bleibt die bisherige Vorlage; eine Farbe
    // ohne Herstellerfoto (Bomber in Weiss) faellt auf die bisherige Vorlage zurueck.
    {
      const motiv = await sharp({ create: { width: 900, height: 1200, channels: 4, background: { r: 200, g: 40, b: 40, alpha: 1 } } }).png().withMetadata({ density: 300 }).toBuffer();
      const gleichWie = async (jpg, tplKey) => {
        const a = await sharp(jpg).raw().toBuffer({ resolveWithObject: true }), t = await sharp(path.join(tmp, 'templates', tplKey + '.png')).raw().toBuffer({ resolveWithObject: true });
        let n = 0; for (const [x, y] of [[60, 60], [960, 60], [60, 990], [512, 40]]) { const i = (y * 1024 + x) * a.info.channels, j = (y * 1024 + x) * t.info.channels; if (Math.abs(a.data[i] - t.data[j]) + Math.abs(a.data[i + 1] - t.data[j + 1]) + Math.abs(a.data[i + 2] - t.data[j + 2]) < 30) n++; }
        return n === 4;
      };
      const bc = await MK.makeMockup(motiv, 'tee', 'white', false, { print: 'dunkel', linie: 'bc' });
      const ss = await MK.makeMockup(motiv, 'hoodie', 'black', false, { print: 'dunkel', linie: 'ss' });
      const ohne = await MK.makeMockup(motiv, 'tee', 'white', false, { print: 'dunkel' });
      const zipWeiss = await MK.makeMockup(motiv, 'zip', 'white', false, { print: 'dunkel', linie: 'ss' });
      pruefe('Textil-Linie: mit linie bc liegt das Design auf dem B&C-Foto, mit ss auf Stanley/Stella, ohne Linie auf der bisherigen Vorlage', await gleichWie(bc, 'bc-tee_white') && await gleichWie(ss, 'ss-hoodie_black') && await gleichWie(ohne, 'tee_white') && !bc.equals(ohne));
      pruefe('Textil-Linie: eine Farbe ohne Herstellerfoto (Bomber in Weiss) faellt auf die bisherige Vorlage zurueck', await gleichWie(zipWeiss, 'zip_white') && !(await MK.linieVorlageDa('ss', 'zip', 'white')) && await MK.linieVorlageDa('ss', 'zip', 'black'));
      // Das Design sitzt in der Druckflaeche des Herstellerfotos: in der Mitte der Flaeche rot, ausserhalb Stoff
      const b = MK.MITGELIEFERT['bc-tee'].box, r = await sharp(bc).raw().toBuffer({ resolveWithObject: true });
      const px = (x, y) => { const i = (y * 1024 + x) * r.info.channels; return [r.data[i], r.data[i + 1], r.data[i + 2]]; };
      const mitte = px(Math.round(b.x + b.w / 2), Math.round(b.y + b.h / 2)), neben = px(b.x - 25, Math.round(b.y + b.h / 2));
      pruefe('Textil-Linie: das Design sitzt in der Druckflaeche des Herstellerfotos (Mitte rot, daneben weisser Stoff)', mitte[0] > 150 && mitte[1] < 90 && neben[0] > 200 && neben[1] > 200, JSON.stringify({ mitte, neben }));
    }
    // 21. Sept.: die importierten Stilbeispiele der Postkarte hatten schwarzen Himmel - der Import
    // hat die Karte freigestellt wie ein Shirt-Motiv. Probe: eine helle Karte (weisser Himmel,
    // dunkles Motiv) durch importOne des Vorzeige-Moduls; danach ist im Master nichts durchsichtig
    // und die helle Ecke bleibt hell. Ein Shirt-Motto wird weiterhin freigestellt.
    {
      process.env.ABNAHME = '1';   // das Modul darf in der Abnahme nie den Autoimport starten
      const { mountVorzeige } = await import('./vorzeige.js');
      const IM = await import('./images.js');
      const vz = await fs.mkdtemp(path.join(os.tmpdir(), 'mo-vorzeige-'));
      const abiM = JSON.parse(await fs.readFile('storage/mottos/abi.json', 'utf8'));
      const stub = { get() {}, post() {}, put() {}, delete() {} };
      const V = mountVorzeige(stub, { STORE: vz, mottos: { get: async (slug) => slug === 'abi' ? abiM : null, all: async () => [abiM] }, env: { MASTER_WIDTH: 2048 }, adminGuard: (q, r, n) => n(), makeMaster: IM.makeMaster, makePreview: IM.makePreview, makeMockup: MK.makeMockup, pushToDrive: async () => {}, newId: () => 'T' + Math.random().toString(36).slice(2, 6).toUpperCase(), STYLE_KEYS: Object.keys(STYLES), onImported: null, erzeugeBild: null, mitBildarbeit: null, szeneMoeglich: async () => false });
      const karte = await sharp({ create: { width: 1536, height: 1024, channels: 3, background: '#e8f0ff' } })
        .composite([{ input: await sharp({ create: { width: 500, height: 400, channels: 3, background: '#1a1a1a' } }).png().toBuffer(), left: 520, top: 500 }]).png().toBuffer();
      // 6. Okt., Markus: "finde heraus, warum ueberhaupt irgendwas freigestellt werden muss. Das ist verboten worden" (Regel 43).
      // Ein undurchsichtiges Shirt-Motiv wird beim Import NICHT mehr ausgeschnitten, sondern abgelehnt - und es entsteht keine Datei.
      const vorher = (await fs.readdir(path.join(vz, 'masters')).catch(() => [])).length;
      const fehler2 = await V.importOne({ slug: 'abi', style: 'vintage', png: karte, values: { motto: 'ABI' }, textile: 'dunkel' }).then(() => '', e => String(e.message || e));
      const nachher = (await fs.readdir(path.join(vz, 'masters')).catch(() => [])).length;
      pruefe('Vorzeige-Import Shirt-Motto ohne Transparenz: wird abgelehnt statt freigestellt, keine Datei geschrieben (Regel 43)', /Freistellen ist verboten/.test(fehler2) && nachher === vorher, JSON.stringify({ fehler2, vorher, nachher }));
      // 21. Sept., Markus: "Da muessten auch ein paar andere Artikel zu sehen sein ... mach das selber."
      // Ein Vorzeige-Design FUER EINEN ARTIKEL: Leinwand des Kissens (quadratisch), nicht freigestellt,
      // Auftragszettel mit input.artikel, Platz "aquarell@kissen", der in der Stil-Galerie nicht auftaucht.
      const quadrat = await sharp({ create: { width: 1200, height: 1200, channels: 3, background: '#fff4e0' } })
        .composite([{ input: await sharp({ create: { width: 500, height: 500, channels: 3, background: '#203050' } }).png().toBuffer(), left: 350, top: 350 }]).png().toBuffer();
      const id3 = await V.importOne({ slug: 'abi', style: 'aquarell', png: quadrat, values: { motto: 'ABI' }, textile: 'hell', artikel: 'kissen' });
      const md3 = await sharp(path.join(vz, 'masters', `${id3}_PRINT_MASTER.png`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let durchsichtig3 = 0; for (let i = 3; i < md3.data.length; i += 4) if (md3.data[i] < 250) durchsichtig3++;
      const j3 = JSON.parse(await fs.readFile(path.join(vz, 'jobs', `${id3}.json`), 'utf8'));
      const fach = JSON.parse(await fs.readFile(path.join(vz, 'vorzeige', 'abi.json'), 'utf8').catch(() => '{}'));
      const galerie = await V.publicSamples('abi');
      pruefe('Vorzeige-Import fuer einen Artikel: Kissen-Leinwand (quadratisch), nichts durchsichtig, Zettel traegt input.artikel, Platz aquarell@kissen, nicht in der Stil-Galerie', Math.abs(md3.info.width / md3.info.height - 1) < 0.01 && durchsichtig3 === 0 && j3.artikel === 'kissen' && j3.input && j3.input.artikel && j3.input.artikel.id === 'kissen' && j3.input.artikel.motivart === 'vollflaechig' && fach['aquarell@kissen'] === id3 && !Object.keys(galerie).some(k => k.includes('@')), JSON.stringify({ masse: md3.info.width + 'x' + md3.info.height, durchsichtig3, artikel: j3.artikel, fach: Object.keys(fach) }));
      let unbekannt = ''; try { await V.importOne({ slug: 'abi', style: 'aquarell', png: quadrat, values: {}, textile: 'hell', artikel: 'raumschiff' }); } catch (e) { unbekannt = e.message; }
      pruefe('Vorzeige-Import: ein unbekannter Artikel wird abgewiesen', /unbekannter Artikel/.test(unbekannt), unbekannt);
    }
    // Der Mockup-Stand: alte fertige Mockups fliegen beim ersten Start nach der Aenderung weg
    await fs.mkdir(path.join(tmp, 'mockups'), { recursive: true });
    for (const f of ['stil_abi_standard.jpg', 'MO-X_tee_black_v76.jpg', 'MO-X_tee_black_v76.jpg.avif', 'sample_abi_H_tee_black.jpg', 'named_MO-X_0.png', 'druckbild_MO-X_hell.jpg']) await fs.writeFile(path.join(tmp, 'mockups', f), 'x');
    const st = await MK.mockupStandAngleichen(tmp, MK.MOCKUP_STAND);
    const bleibt = (await fs.readdir(path.join(tmp, 'mockups'))).sort();
    pruefe('Mockup-Stand: Vorzeige, Kunden- und Kachel-Mockups weg, Zwischenstufen und Druckbild bleiben, Stand vermerkt', st.geloescht === 4 && bleibt.join(',') === 'druckbild_MO-X_hell.jpg,named_MO-X_0.png,stand.txt', JSON.stringify({ st, bleibt }));
    const st2 = await MK.mockupStandAngleichen(tmp, MK.MOCKUP_STAND);
    pruefe('Mockup-Stand: beim naechsten Start passiert nichts mehr', st2.geloescht === 0 && st2.alt === MK.MOCKUP_STAND);
    // 20. Sept., 23:38 (Markus: "Es dauert ganz schoen lange, bis sich die Flaechen fuellen"): ein
    // Stand, der nur Flachware betrifft, laesst die Shirt-Mockups liegen.
    await fs.writeFile(path.join(tmp, 'mockups', 'stand.txt'), '77');
    for (const f of ['MO-Y_tee_black_v77.jpg', 'MO-Y_strandtuch_white_v77.jpg', 'MO-Y_kissen_black_szene_v77.jpg', 'stil_abi_standard_kissen.jpg', 'stil_abi_standard.jpg', 'sample_abi_H_tee_black.jpg']) await fs.writeFile(path.join(tmp, 'mockups', f), 'x');
    const st3 = await MK.mockupStandAngleichen(tmp, 78);
    const bleibt3 = (await fs.readdir(path.join(tmp, 'mockups'))).filter(f => f.startsWith('MO-Y') || f.startsWith('stil_') || f.startsWith('sample_')).sort();
    pruefe('Mockup-Stand 78 betrifft nur Flachware: Strandtuch und Kissen weg, T-Shirt-Mockups und Kacheln bleiben', st3.geloescht === 3 && bleibt3.join(',') === 'MO-Y_tee_black_v77.jpg,sample_abi_H_tee_black.jpg,stil_abi_standard.jpg', JSON.stringify({ st3, bleibt3 }));
    // 21. Sept., 07:55: Stand 80 (nur Tasse) liess die Startseite trotzdem leer, weil jede
    // Kundendatei den Gesamtstand im Namen trug. Jetzt traegt sie den Stand ihres Artikels, und
    // was mit hoeherem Stand daliegt, wird umbenannt statt neu gebaut.
    // 22. Sept.: Stand 89 betrifft Tasse, Sticker, Brett und Poster (neue Situationen) - beide
    // tragen ihn jetzt. Die Rechnung selbst ist unveraendert: der juengste Stand, der den Artikel
    // betrifft, und ein Artikel, den kein Stand betrifft, bleibt auf dem letzten allgemeinen.
    pruefe('Mockup-Stand je Artikel: Stand 84 betrifft Textilien, 86 Kissen, 90 Tasse und Poster, 92/94 alle Flachware (2. und 4. Okt., Kissen zu 100 %); bei Stand 78 Shirt 77, bei 80 Kissen 79, bei 81 Tasse 81', MK.mockupStandFuer('tee') === 84 && MK.mockupStandFuer('kissen', 91) === 86 && MK.mockupStandFuer('poster', 91) === 90 && MK.mockupStandFuer('kissen') === 94 && MK.mockupStandFuer('poster') === 94 && MK.mockupStandFuer('tasse') === 90 && MK.mockupStandFuer('tee', 78) === 77 && MK.mockupStandFuer('kissen', 80) === 79 && MK.mockupStandFuer('tasse', 81) === 81, [MK.mockupStandFuer('tee'), MK.mockupStandFuer('kissen'), MK.mockupStandFuer('poster'), MK.mockupStandFuer('tasse')].join(','));
    await fs.writeFile(path.join(tmp, 'mockups', 'stand.txt'), '80');
    for (const f of ['MO-Z_tee_black_v80.jpg', 'MO-Z_tee_black_v79.jpg', 'back_MO-Z_hoodie_white_v79.jpg.avif', 'MO-Z_tasse_white_v79.jpg', 'MO-Z_kissen_black_szene_v80.jpg', 'stil_abi_standard.jpg']) await fs.writeFile(path.join(tmp, 'mockups', f), f);
    // 2. Okt., Markus: "Bei einigen Beuteln war das Motiv nie so richtig." Zwei Beutelfotos, je eine
    // Flaeche: 30 x 30 cm waagrecht mittig auf dem gemessenen Korpus (38 x 42 cm), oben und unten gleich viel Luft.
    for (const f of ['white', 'black']) {
      const b = MK.BOX_OVERRIDES['beutel_' + f], k = MK.BEUTEL_KORPUS[f];
      const kw = k.x1 - k.x0, kh = k.y1 - k.y0;
      const mitte = Math.abs((b.x + b.w / 2) - (k.x0 + k.x1) / 2), oben = b.y - k.y0, unten = k.y1 - (b.y + b.h);
      pruefe(`Beutel ${f}: Druck 30 x 30 cm mittig auf dem Korpus, oben und unten je 6 cm Luft`, mitte <= 2 && Math.abs(b.w / kw - 30 / 38) < 0.01 && Math.abs(b.h / kh - 30 / 42) < 0.01 && Math.abs(oben - unten) <= 2 && oben > 0, JSON.stringify({ mitte, oben, unten, w: b.w, h: b.h }));
    }
    // Markus: "Wichtig ist, dass die Aenderungen so gespeichert sind, dass jeder Chat drauf zugreifen
    // kann ... speziell mit der Positionierung." Die Flaeche gilt nur fuer GENAU dieses Foto. Darum wird
    // der Korpus hier im Foto aus dem Repo nachgemessen: tauscht jemand ein Beutelfoto, ohne die
    // Flaeche neu zu messen (werkzeug/beutel-korpus.mjs), faellt die Abnahme durch.
    for (const f of ['white', 'black']) {
      const sharpB = (await import('sharp')).default; const { data, info } = await sharpB(await sharpB(path.resolve('vorlagen-original', 'beutel_' + f + '.jpg')).resize({ width: 1024, height: 1024, fit: 'cover' }).png().toBuffer()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const W = info.width, H = info.height;
      const ist = (x, y) => { const i = (y * W + x) * 3; return f === 'white' ? data[i] - data[i + 2] > 10 : data[i] + data[i + 1] + data[i + 2] < 200; };
      const zeile = (y) => { let l = -1, r = -1; for (let x = 0; x < W; x++) if (ist(x, y)) { if (l < 0) l = x; r = x; } return [l, r]; };
      const spalte = (x) => { let o = -1, u = -1; for (let y = 0; y < H; y++) if (ist(x, y)) { if (o < 0) o = y; u = y; } return [o, u]; };
      const k = MK.BEUTEL_KORPUS[f], [l, r] = zeile(700), [o, u] = spalte(360);
      pruefe(`Beutel ${f}: das Foto im Repo ist das vermessene (Korpus auf 3 px genau)`, Math.abs(l - k.x0) <= 3 && Math.abs(r - k.x1) <= 3 && Math.abs(o - k.y0) <= 3 && Math.abs(u - k.y1) <= 3, JSON.stringify({ gemessen: [l, r, o, u], hinterlegt: k }));
    }
    pruefe('Mockup-Stand: Beutel auf 93 (neue Flaeche je Foto), Shirt bleibt 84', MK.mockupStandFuer('beutel') === 93 && MK.mockupStandFuer('tee') === 84 && MK.mockupStandFuer('beutel', 92) === 82);
    const st4 = await MK.mockupStandAngleichen(tmp, 80);
    const bleibt4 = (await fs.readdir(path.join(tmp, 'mockups'))).filter(f => f.includes('MO-Z') || f.startsWith('stil_')).sort();
    const inhalt = await fs.readFile(path.join(tmp, 'mockups', 'MO-Z_tee_black_v77.jpg'), 'utf8').catch(() => '');
    pruefe('beim Start ohne Standsprung: Kundendateien werden auf den Artikel-Stand umbenannt (die juengere bleibt), veraltete Tasse weg, Kacheln bleiben', st4.umbenannt === 3 && st4.geloescht === 2 && bleibt4.join(',') === 'MO-Z_kissen_black_szene_v79.jpg,MO-Z_tee_black_v77.jpg,back_MO-Z_hoodie_white_v77.jpg.avif,stil_abi_standard.jpg' && inhalt === 'MO-Z_tee_black_v80.jpg', JSON.stringify({ st4, bleibt4, inhalt }));
    await fs.rm(tmp, { recursive: true, force: true });
  }

  {
    // Nachbau-Auftrag und im Postkarten-Motto (Vorlage und Repo-Kopie gleich).
    const { nachbauPrompt, FOTO_TEXTE } = await import('./fotos.js');
    // 21. Sept.: Neustart mitten im Auftrag - das Foto (nur im Arbeitsspeicher) ist weg. Die Meldung
    // sagt das ehrlich, nicht "nach einer Stunde geloescht".
    pruefe('Foto-Meldung nach Neustart: sagt Neustart und Arbeitsspeicher, nicht "eine Stunde"', /neu starten/.test(FOTO_TEXTE.nachNeustart) && /Arbeitsspeicher/.test(FOTO_TEXTE.nachNeustart) && !/Stunde/.test(FOTO_TEXTE.nachNeustart) && /noch einmal hoch/.test(FOTO_TEXTE.nachNeustart));
    // 26. Sept., Markus: "Wenn jemand ein Foto hochlaedt, sollten wir schon erkennen koennen, dass
    // auch ein Mensch da drauf ist oder ein Tier - jetzt gerade einfach ne Datei hochgeladen, und
    // er erkennt das an." Nachgestellt: ein graues PNG mit der Aufschrift "Rechnung 2026-0815"
    // wurde mit HTTP 200 angenommen ("Das Foto reicht fuer diese Groesse").
    {
      const { fotoInhaltBefund, FOTO_INHALT_FRAGE } = await import('./fotos.js');
      const bef = (a, b) => fotoInhaltBefund(a, b);
      pruefe('Fotoinhalt: ein Bild ohne Mensch und ohne Tier wird abgelehnt, mit klarer Ansage',
        bef({ mensch: false, tier: false, was: 'Dokument' }, 'mensch_tier').ok === false
        && /weder einen Menschen noch ein Tier/.test(bef({ mensch: false, tier: false, was: 'Dokument' }, 'mensch_tier').hinweis)
        && /Wir sehen darauf: Dokument/.test(bef({ mensch: false, tier: false, was: 'Dokument' }, 'mensch_tier').hinweis)
        && /Bitte nimm ein anderes Foto/.test(bef({ mensch: false, tier: false, was: 'Dokument' }, 'mensch_tier').hinweis),
        bef({ mensch: false, tier: false, was: 'Dokument' }, 'mensch_tier').hinweis);
      pruefe('Fotoinhalt: Mensch reicht, Tier allein reicht auch (Markus: "ein Mensch oder ein Tier")',
        bef({ mensch: true, tier: false }, 'mensch_tier').ok === true && bef({ mensch: false, tier: true }, 'mensch_tier').ok === true);
      // IM ZWEIFEL FUER DAS FOTO: ein Modell, das nicht antwortet, darf niemandem sein Selfie
      // verweigern. Nur ein ausdrueckliches Nein haelt auf.
      pruefe('Fotoinhalt: ohne Modell, bei unsicherer oder unlesbarer Antwort wird NICHTS abgelehnt',
        bef({ uebersprungen: true }, 'mensch_tier').ok === true
        && bef({ mensch: null, tier: null }, 'mensch_tier').ok === true
        && bef({}, 'mensch_tier').ok === true);
      pruefe('Fotoinhalt: ohne Anspruch des Mottos wird gar nicht erst geprueft (Freestyle: Landschaft, Auto, Logo)',
        bef({ mensch: false, tier: false }, '').ok === true && bef({ mensch: false, tier: false }, '').geprueft === false);
      pruefe('Fotoinhalt: ein Motto, das ein TIER braucht, nimmt ein Foto ohne Tier nicht an',
        bef({ mensch: true, tier: false, was: 'Mann' }, 'tier').ok === false && /kein Tier/.test(bef({ mensch: true, tier: false }, 'tier').hinweis));
      pruefe('die Frage an das Sehmodell fragt nach Mensch, Tier und was zu sehen ist - als JSON',
        /"mensch":true\|false/.test(FOTO_INHALT_FRAGE) && /"tier":true\|false/.test(FOTO_INHALT_FRAGE) && /\bwas\b/.test(FOTO_INHALT_FRAGE)
        && /statue, a doll/.test(FOTO_INHALT_FRAGE) && /Answer ONLY with JSON/.test(FOTO_INHALT_FRAGE));
      // Was ein Motto von seinem Foto verlangt, steht am FELD - nicht im Code.
      const sm = sanitizeMotto({
        slug: 'p', name: 'P', prompt: 'Print, portrait, isolated on a plain empty background. Headline reads exactly "{spruch}".',
        fields: [
          { key: 'spruch', label: 'Spruch', type: 'text', required: true, braucht: 'mensch' },
          { key: 'bild', label: 'Bild', type: 'upload', braucht: 'mensch' },
          { key: 'bild2', label: 'Bild 2', type: 'upload', braucht: 'aliens' }
        ]
      });
      pruefe('"braucht" gilt nur am Upload-Feld und nur mit bekanntem Wert',
        sm.fields.find(f => f.key === 'spruch').braucht === undefined && sm.fields.find(f => f.key === 'bild').braucht === 'mensch' && sm.fields.find(f => f.key === 'bild2').braucht === undefined,
        JSON.stringify(sm.fields.map(f => [f.key, f.braucht])));
    }
    pruefe('Nachbau-Auftrag: Menschen in genau der Kleidung aus dem Foto, nie umgezogen', /EXACTLY the clothes they wear in the photo/.test(nachbauPrompt('x', { person: true })) && /never re-dress/.test(nachbauPrompt('x', { person: true })));
    // ---- Stufe 1: Otto malt zuerst das Foto ------------------------------------------------
    // 24. Sept., Markus: "Die Person beziehungsweise Personen auf dem Foto sollen in dem jeweiligen
    // Stil ebenfalls mit nach gemalt werden."
    // Gemessen an einer echten Aquarellkarte: alles gemalt, nur die Gesichter blieben Foto. Der
    // Grund war die Bauweise - das Kundenfoto WAR das Eingangsbild. Also zuerst ein eigener
    // Auftrag, der nichts anderes tut, als das Foto in ein Bild zu verwandeln.
    const { fotoNachmalenPrompt } = await import('./fotos.js');
    const FIGUREN_FUER_TEST = 'The people in the scene are caricatures.';
    const s1 = fotoNachmalenPrompt({ stilText: 'watercolour', umgebung: true });
    pruefe('Stufe 1: das ganze Foto wird von Hand nachgemalt, nicht gefiltert',
      /Redraw this entire photograph completely by hand/.test(s1)
      && /IF ANY SQUARE CENTIMETRE OF THE RESULT COULD BE MISTAKEN FOR AN UNTOUCHED PHOTOGRAPH, THE PICTURE IS WRONG/.test(s1));
    pruefe('Stufe 1: die Leute bleiben erkennbar, samt Brille, Bart und ihrer eigenen Kleidung',
      /Keep every person and every animal in the photo clearly recognisable/.test(s1)
      && /EXACTLY the clothes they wear in the photo/.test(s1)
      && /never add a person who is not in the photo and never leave one out/.test(s1));
    pruefe('Stufe 1 mit Ort: der Hintergrund bleibt, nur das Wetter wird besser',
      /Keep the place exactly as photographed/.test(s1)
      && /becomes bright postcard weather/.test(s1));
    pruefe('Stufe 1 ohne Ort: der Hintergrund ist nicht der Punkt',
      !/Keep the place exactly as photographed/.test(fotoNachmalenPrompt({ stilText: 'x' })));
    pruefe('Stufe 1: der gewaehlte Stil steht als Machart fuer das GANZE Bild drin',
      /THE TECHNIQUE \(mandatory, for the whole picture\): watercolour/.test(s1));
    // Markus, 24. Sept.: "Vielleicht waere es da sogar hilfreich, dass wir ein Teil unserer
    // Menschen ... dort mit einbinden und da lustige Sachen erzeugen koennen."
    const s1k = fotoNachmalenPrompt({ stilText: 'x', figurenText: FIGUREN_FUER_TEST, umgebung: true });
    pruefe('Stufe 1: der Figurenwunsch greift genau da, wo der Mensch entsteht',
      s1k.includes(FIGUREN_FUER_TEST)
      && /HOW THE PEOPLE ARE DRAWN - this is a firm order from the customer/.test(s1k));
    // 24. Sept., gemessen: Mit "Karikatur" kam zweimal hintereinander keine Karikatur heraus,
    // sondern ein braves, sehr genaues Portraet. "same faces, same posture and proportions" und
    // "oversized heads, strongly exaggerated features" sind derselbe Auftrag mit zwei
    // entgegengesetzten Vorzeichen - und das Modell entscheidet so etwas immer zugunsten des
    // Eingangsbildes. Mit Figurenwunsch haengt die Aehnlichkeit deshalb an den Kennzeichen,
    // nicht an den Proportionen.
    pruefe('mit Figurenwunsch duerfen die Proportionen sich biegen - sonst kommt nie eine Karikatur heraus',
      /Their PROPORTIONS, however, belong to the drawing style ordered below/.test(s1k)
      && !/same posture and proportions/.test(s1k));
    pruefe('ohne Figurenwunsch bleibt die Aehnlichkeit streng - gleiche Haltung, gleiche Proportionen',
      /same posture and proportions/.test(s1) && !/Their PROPORTIONS, however/.test(s1));
    pruefe('auch mit Figurenwunsch bleiben Haar, Bart, Brille und die eigene Kleidung',
      /the same hair, the same beard, the same glasses/.test(s1k)
      && /EXACTLY the clothes they wear in the photo/.test(s1k));
    pruefe('Stufe 1 ohne Figurenwunsch: kein leerer Absatz',
      !/HOW THE PEOPLE ARE DRAWN/.test(s1));
  }

  // 3f) 21. Sept., Markus: "Die Menschen-Auswahl nur noch da, wo es Sinn macht."
  {
    const { figurenWahl, FIGUREN_MOTTOS } = await import('./mottos.js');
    const lade = async (slug) => publicView(JSON.parse(await fs.readFile(`storage/mottos/${slug}.json`, 'utf8')));
    const fs2 = await lade('freestyle'), fam = await lade('familie'), baby = await lade('geburt-baby'), hw = await lade('handwerker-shirt'), abi2 = await lade('abi');
    pruefe('Figuren-Auswahl nur bei Mottos mit Menschen im Motiv: Freestyle und Familie ja, Baby, Handwerker und Abi nein', fs2.figurenChoice && fam.figurenChoice && !baby.figurenChoice && !hw.figurenChoice && !abi2.figurenChoice, JSON.stringify({ fs: fs2.figurenChoice, fam: fam.figurenChoice, baby: baby.figurenChoice, hw: hw.figurenChoice }));
    pruefe('ein Motto kann die Figuren-Auswahl in seiner Datei ausdruecklich an- oder abschalten', figurenWahl({ slug: 'abi', figurenChoice: true }) && !figurenWahl({ slug: 'freestyle', figurenChoice: false }) && FIGUREN_MOTTOS.includes('firmenausflug'));
    pruefe('auf einem Shirt bleibt die ganze Auswahl stehen - dort steht der Mensch im Motiv, nicht im Foto', (fs2.figuren || []).some(f => f.key === 'strich') && (fs2.figuren || []).some(f => f.key === 'keine'));
  }

  // 3h) Firmenlogos und Partner (22. Sept. 2026)
  // Markus: "Ich habe von drei Firmen schon die Erlaubnis, das Logo zu nutzen: C.C.E. Sportswear
  // in Marschacht, DTF Express in Erkelenz und Ballz in Harmstorf." Und danach die entscheidende
  // Frage: "Es ist im gleichen Ort, aber jemand macht ein Selfie und will eine Postkarte
  // verschicken - muss das ja greifen. Welche Loesung hast du dafuer?"
  {
    const FF = await import('./firmen-freigabe.js');
    const LH = await import('./logo-holen.js');
    const sharp = (await import('sharp')).default;
    const liste = await FF.freigaben();
    const namen = liste.map(e => e.firma).sort();
    // 26. Sept.: Luigi's Pizza UG dazu (Markus hat das Logo selbst mitgegeben, Adresse Harburger
    // Strasse 10 in Jesteburg) - deshalb hat dieser Eintrag KEINE Webseite: das Logo wird nicht
    // geholt, es liegt im Repo.
    // 29. Sept.: EAST26 in Santanyí dazu - das erste Objekt in Spanien (Markus: "das Logo
    // freigegeben ... muss die Postkarte wirklich megageil sein"). Logo als PDF von ihm, im Repo.
    // 30. Sept.: Bestes vom Elbdeich (Hofladen, Hamburg-Moorburg) dazu - Freigabe von Markus,
    // Logo von der Seite (nur 72 Pixel, hochgerechnet), erster Testfall fuer Gutscheine.
    pruefe('sechs Firmen-Freigaben liegen vor, jede mit Datum und Dateinamen',
      // 1. Okt.: DTF Factory (Markus' zweite Firma, Im Dorfe 9, Harmstorf) dazu.
      namen.join(', ') === "Ball-z, Bestes vom Elbdeich, C.C.E. Sportswear, DTF Express, DTF Factory, EAST26, Luigi's Pizza UG"
      && liste.every(e => e.freigabe && e.freigabe.datum && FF.dateiName(e)), namen.join(', '));
    const logoDa = await Promise.all(liste.map(e => FF.logoBild(e).then(b => !!(b && b.length))));
    pruefe('jede Freigabe hat entweder die Webseite, von der das Logo geholt wird, ODER das Logo im Repo',
      liste.every((e, i) => /^https:\/\//.test(String(e.webseite || '')) || logoDa[i]),
      liste.map((e, i) => e.firma + '=' + (e.webseite || (logoDa[i] ? 'Logo im Repo' : 'FEHLT'))).join(' '));
    // 26. Sept., Markus: "Die Sterne duerfen in jedem Restaurant sein. Ebenso sollten wir
    // einbauen, wenn wir wissen, dass so ein Italiener ist, dass die italienische Flagge drauf
    // kommt. Beim Inder die indische, wenn's ein deutsches Restaurant ist, die deutsche."
    {
      const N = await import('./kueche.js');
      pruefe('die Kueche bestimmt die Flagge: Italiener -> Italien, Inder -> Indien, deutsches Restaurant -> Deutschland',
        N.kuecheLand('italian') === 'Italy' && N.kuecheLand('indian') === 'India' && N.kuecheLand('german') === 'Germany'
        && N.kuecheLand('turkish') === 'Turkey' && N.kuecheLand('sushi') === 'Japan',
        [N.kuecheLand('italian'), N.kuecheLand('indian'), N.kuecheLand('german')].join(' / '));
      // 26. Sept., Markus: "Pizza italienisch, und Gyros wuerde ich meistens sagen Grieche, Kebab
      // wuerde ich sagen meistens tuerkisch." Bei diesen entscheidet der haeufigste Fall.
      pruefe('Pizza ist italienisch, Gyros griechisch, Kebab tuerkisch - der haeufigste Fall gilt',
        N.kuecheLand('pizza') === 'Italy' && N.kuecheLand('pasta') === 'Italy'
        && N.kuecheLand('gyros') === 'Greece' && N.kuecheLand('souvlaki') === 'Greece'
        && N.kuecheLand('kebab') === 'Turkey' && N.kuecheLand('doner') === 'Turkey',
        [N.kuecheLand('pizza'), N.kuecheLand('gyros'), N.kuecheLand('kebab')].join(' / '));
      pruefe('eine Kueche ohne eindeutiges Land bekommt KEINE Flagge (regional, Burger, vegan, international)',
        ['regional', 'burger', 'vegan', 'international', 'asian', 'seafood', ''].every(k => N.kuecheLand(k) === '')
        && N.kuecheLand('klingonisch') === '');
    }
    pruefe("Luigi's Pizza: Punkt, Adresse, Gewerk und das Motiv stehen im Eintrag",
      (() => { const l = liste.find(e => /Luigi/.test(e.firma)); return !!l && Math.abs(l.punkt[0] - 53.3121) < 0.002 && Math.abs(l.punkt[1] - 9.9647) < 0.002 && /Jesteburg/.test(l.adresse) && /PIZZA/.test(l.motiv || ''); })(),
      JSON.stringify((liste.find(e => /Luigi/.test(e.firma)) || {}).punkt));

    // 29. Sept., EAST26 Restaurante, Carrer del Bisbe Verger 26, 07650 Santanyí (Mallorca).
    // Markus: "Das ist das erste Objekt in Spanien, was mitmachen moechte, dass das Logo
    // freigegeben - und wenn da vor Ort jemand eine Postkarte verschicken will, muss die
    // Postkarte wirklich megageil sein." Der Eintrag traegt alles selbst (Punkt aus OSM-Knoten
    // 502313544, Hausfarbe am Logo gemessen, Beschreibung, Dinge und Fotos von der Seite), weil
    // der Server die Seite nie liest: Logo und Punkt liegen vor, der Start ueberspringt das Holen.
    {
      const e26 = liste.find(e => e.firma === 'EAST26');
      pruefe('EAST26: Punkt in Santanyí, Anschrift, Spanien, Webseite, Gold als Hausfarbe, Gastro mit Motiv',
        !!e26 && Math.abs(e26.punkt[0] - 39.354) < 0.002 && Math.abs(e26.punkt[1] - 3.1269) < 0.002
        && /Santanyí/.test(e26.adresse) && e26.land === 'Spanien' && /^https:\/\/www\.east26-restaurante\.com$/.test(e26.webseite)
        && JSON.stringify(e26.farben) === '["#997209"]' && e26.gastro === true && /OCTOPUS/i.test(e26.motiv || '') && /Show it ONCE/.test(e26.motiv || ''),
        JSON.stringify(e26 && { punkt: e26.punkt, farben: e26.farben, land: e26.land }));
      pruefe('EAST26: Beschreibung, sechs Dinge und zwei Seitenfotos (https) stehen im Eintrag - der Nachweis auf dem Volume bleibt leer',
        !!e26 && /Mallorca/.test(e26.was || '') && Array.isArray(e26.stichworte) && e26.stichworte.length === 6
        && Array.isArray(e26.produktbilder) && e26.produktbilder.length === 2 && e26.produktbilder.every(u => /^https:\/\/static\.wixstatic\.com\//.test(u)),
        JSON.stringify(e26 && e26.stichworte));
      // Das Logo: freigestellt (Alphakanal), Gold, und seine Hauptschrift ist DUNKEL - also braucht
      // es einen hellen Grund (gemessen an der ersten Probe: das Modell setzte es auf Schwarz).
      const png = e26 ? await FF.logoBild(e26) : null;
      const meta = png ? await sharp(png).metadata() : null;
      const helle = png ? await FF.logoHelle(png, { perzentil: 0.9 }) : 999;
      pruefe('EAST26: das Logo liegt im Repo als PNG mit Alphakanal, rund 1024 Pixel hoch, Hauptschrift dunkel (Grund muss hell sein)',
        !!meta && meta.channels === 4 && meta.height >= 1000 && meta.height <= 1100 && helle < 128,
        meta ? meta.width + 'x' + meta.height + ' Kanaele ' + meta.channels + ' Helle(90%) ' + Math.round(helle) : 'kein Logo');
      // Strassenabgleich: OSM nennt die Strasse wie die Anschrift, "Carrer del Bisbe Verger".
      pruefe('EAST26: freigabeFuer trifft EAST26 in der Carrer del Bisbe Verger - in Palma nicht',
        (() => {
          const am = FF.freigabeFuer({ firma: 'East 26', ort: 'Santanyí', koord: '39.3541, 3.1270', strasse: 'Carrer del Bisbe Verger' }, liste);
          const weg = FF.freigabeFuer({ firma: 'East 26', ort: 'Palma', koord: '39.5696, 2.6502', strasse: 'Passeig del Born' }, liste);
          return !!am && am.firma === 'EAST26' && weg === null;
        })());
      const srvE = await fs.readFile('server.js', 'utf8');
      // 30. Sept., Markus: "Pruefe bitte, ob das weltweit funktioniert." Gemessen am lebenden
      // /api/mo/ort fuer 39.3540/3.1269: Santanyí, Spanien (es), Carrer del Bisbe Verger, East26
      // (Restaurant, gastro) 3 m - nichts davon haengt an Deutschland. Die eine Stelle, die es tat:
      // die Anschrift einer geholten Firma wurde mit ", Deutschland" verortet. Jetzt mit dem Land
      // aus dem Eintrag.
      // 30. Sept., Bestes vom Elbdeich: Punkt aus OSM-Knoten 12589821801 (shop=farm), Rot der Seite
      // als Hausfarbe, Motiv Erntetisch, zwei AVIF-Fotos der Seite - und das Logo ist mitteltonig
      // (Taupe, Helle 138): weder heller noch dunkler Grund, sondern "clearly lighter or darker".
      {
        const bve = liste.find(e => e.firma === 'Bestes vom Elbdeich');
        pruefe('Bestes vom Elbdeich: Punkt in Moorburg, Anschrift, Rot der Seite vorn, kein Gastro, Motiv, sechs Dinge, zwei Fotos der Seite',
          !!bve && Math.abs(bve.punkt[0] - 53.4987) < 0.002 && Math.abs(bve.punkt[1] - 9.8893) < 0.002 && /Moorburger Elbdeich 447/.test(bve.adresse)
          && bve.farben[0] === '#FF353A' && bve.gastro === false && /APPLES/i.test(bve.motiv || '') && (bve.stichworte || []).length === 6
          && (bve.produktbilder || []).length === 2 && bve.produktbilder.every(u => /^https:\/\/bestes-vom-elbdeich\.de\//.test(u)) && String(bve.was || '').length <= 300,
          JSON.stringify(bve && { punkt: bve.punkt, farben: bve.farben, was: (bve.was || '').length }));
        const bvePng = bve ? await FF.logoBild(bve) : null;
        const bveHelle = bvePng ? await FF.logoHelle(bvePng, { perzentil: 0.9 }) : 0;
        // 30. Sept., spaeter: das Original von Markus (Bildmarke plus Schriftzug, 1413x1024 mit
        // Alphakanal) - gemessen Rot 58 %, Taupe 38 %, Gruen 4 %, Helle(90%) 138: weiter "mitte".
        const bveMeta = bvePng ? await sharp(bvePng).metadata() : null;
        pruefe('Bestes vom Elbdeich: das Original-Logo liegt im Repo (breiter als hoch, 1024 hoch, Alphakanal), Hauptschrift mitteltonig (zwischen 120 und 180)',
          !!bveMeta && bveMeta.channels === 4 && bveMeta.height === 1024 && bveMeta.width > bveMeta.height && bveHelle >= 120 && bveHelle <= 180,
          (bveMeta ? bveMeta.width + 'x' + bveMeta.height + ' ' : '') + 'Helle(90%) ' + Math.round(bveHelle));
      }
      pruefe('Server: die Anschrift einer geholten Firma wird mit dem Land aus dem Eintrag verortet, nicht fest mit Deutschland',
        /geocodeRoh\(r\.anschrift\.text \+ ', ' \+ \(String\(eintrag\.land \|\| ''\)\.trim\(\) \|\| 'Deutschland'\)\)/.test(srvE) && !/anschrift\.text \+ ', Deutschland'/.test(srvE));

      // 1. Okt., DTF Factory - Markus' zweite Firma, Im Dorfe 9, Harmstorf, 70 m neben Ball-z.
      // Markus: "Aber er findet DTF Factory ja noch nicht mal als Firma, da faengt das Problem
      // ja schon an - und hiermit ist das Logo und die Internetseite freigegeben, weil es ist ja
      // meine Firma." Die Firma steht nicht in OpenStreetMap (gemessen: Nominatim kennt weder
      // "DTF Factory" noch die Hausnummer 9), also kann sie nur ueber die Freigabe erscheinen.
      {
        const dtf = liste.find(e => e.firma === 'DTF Factory');
        // Markus, 1. Okt.: "DTF-factory.com" - die Firmenseite (B2B: Folien, Tinten, Trockner,
        // Pressen); dtf-queen.com ist nur der Shop derselben GmbH. Hausfarbe = das Gruen der
        // Schrift im Logo (#6FAF33), das Einhorn ist ein Regenbogen und taugt nicht als Hausfarbe.
        pruefe('DTF Factory: Punkt Im Dorfe (Harmstorf), Anschrift Im Dorfe 9, Gruen der Logoschrift, Webseite dtf-factory.com, kein Gastro, Motiv Presse ohne Einhorn, sechs Dinge, zwei Fotos der Seite',
          !!dtf && Math.abs(dtf.punkt[0] - 53.3487) < 0.001 && Math.abs(dtf.punkt[1] - 9.987) < 0.001 && /Im Dorfe 9/.test(dtf.adresse)
          && dtf.farben[0] === '#6FAF33' && dtf.webseite === 'https://dtf-factory.com' && dtf.gastro === false && /PRESS/i.test(dtf.motiv || '') && /NOT a unicorn/.test(dtf.motiv || '')
          && (dtf.stichworte || []).length === 6 && (dtf.produktbilder || []).length === 2 && dtf.produktbilder.every(u => /^https:\/\/dtf-factory\.com\//.test(u))
          && (dtf.namen || []).includes('DTF Queen') && (dtf.namen || []).includes('DTF Factory GmbH') && !!(dtf.freigabe && dtf.freigabe.datum === '2026-10-01'),
          JSON.stringify(dtf && { punkt: dtf.punkt, farben: dtf.farben, webseite: dtf.webseite }));
        const dtfPng = dtf ? await FF.logoBild(dtf) : null;
        const dtfMeta = dtfPng ? await sharp(dtfPng).metadata() : null;
        // Freigestellt per Flutfuellung vom Rand: die Ecken sind durchsichtig, das Einhorn und die Schrift nicht.
        const dtfEcke = dtfPng ? (await sharp(dtfPng).ensureAlpha().raw().toBuffer())[3] : 255;
        const dtfStats = dtfPng ? await sharp(dtfPng).stats() : null;
        pruefe('DTF Factory: das Original-Logo (Einhorn, gruene Schrift) liegt im Repo, 1024 breit, Alphakanal, Ecke durchsichtig, Einhorn und Schrift deckend',
          !!dtfMeta && dtfMeta.width === 1024 && dtfMeta.channels === 4 && dtfEcke === 0 && dtfStats && dtfStats.channels[3].mean > 20 && dtfStats.channels[3].mean < 120,
          dtfMeta ? dtfMeta.width + 'x' + dtfMeta.height + ' · Alpha-Mittel ' + Math.round(dtfStats.channels[3].mean) : '');
        // Der Kern seiner Frage: wer Im Dorfe steht, bekommt BEIDE Firmen angeboten, die naechste zuerst.
        const imDorfe = FF.kandidatenAmOrt('53.3487,9.9870', liste);
        pruefe('Im Dorfe, Harmstorf: DTF Factory und Ball-z werden beide angeboten, DTF Factory zuerst (0 m), Ball-z 70 m dahinter',
          imDorfe.length === 2 && imDorfe[0].eintrag.firma === 'DTF Factory' && imDorfe[0].entfernungM < 10
          && imDorfe[1].eintrag.firma === 'Ball-z' && imDorfe[1].entfernungM > 50 && imDorfe[1].entfernungM < 100,
          JSON.stringify(imDorfe.map(k => k.eintrag.firma + '@' + k.entfernungM + 'm')));
        pruefe('"DTF Queen" und "DTF-Factory GmbH" treffen denselben Eintrag; "DTF Express" bleibt die andere Firma',
          (FF.freigabeFuer({ firma: 'DTF Queen', koord: '53.3487,9.9870' }, liste) || {}).firma === 'DTF Factory'
          && (FF.freigabeFuer({ firma: 'DTF-Factory GmbH', koord: '53.3487,9.9870' }, liste) || {}).firma === 'DTF Factory'
          && (FF.freigabeFuer({ firma: 'DTF Express' }, liste) || {}).firma === 'DTF Express');
      }

      // 1. Okt., DAS TOR JE BETRIEB (Markus: "Mach das komplett fertig mit 20 % Lizenzgebuehr fuer
      // EAST26, generiere mir auch einen QR-Code dazu, und mit dem QR-Code soll diese Seite direkt
      // so aufgehen und auch schon das EAST26-Logo direkt anzeigen. Die Moeglichkeit Postkarte,
      // Gutschein und all unsere Artikel schoen gemacht.")
      {
        const e26b = liste.find(e => e.firma === 'EAST26');
        pruefe('EAST26: Lizenz 20 % auf Artikel, seit 1. Okt.; das Tor /bei/east26 steht im Eintrag',
          !!e26b && e26b.lizenz && e26b.lizenz.prozent === 20 && e26b.lizenz.artikel === true && !('postkarte' in e26b.lizenz) && !('gutschein' in e26b.lizenz) && e26b.lizenz.seit === '2026-10-01' && e26b.tisch && e26b.tisch.tor === '/bei/east26');
        // 1. Okt., Markus: "ueber Stripe direkt ausgezahlt - die 20 % an den Gastronom, bei
        // Gutscheinen genau andersrum." lizenzen.js: 20 % vom NETTO, Satz je Bestellzeile,
        // Transfer auf das Connect-Konto; ohne Konto wartet der Satz, stuendlich wird nachgeholt.
        {
          const LZ = await import('./lizenzen.js');
          const os = await import('node:os'); const path = await import('node:path');
          const lager = await fs.mkdtemp(path.join(os.tmpdir(), 'lizenz-'));
          pruefe('Lizenz: 20 % vom Netto - ein Shirt zu 24,90 brutto (19 % MwSt) macht 4,18 EUR fuer das Haus; ohne Prozent nichts',
            LZ.faellig({ bruttoCents: 2490, prozent: 20 }) === 418 && LZ.faellig({ bruttoCents: 2490, prozent: 0 }) === 0 && LZ.faellig({ bruttoCents: 0, prozent: 20 }) === 0);
          pruefe('Lizenz: die Design-Nummer kommt aus _designId der Bestellzeile oder aus der SKU MO-<id>__<teil>__',
            LZ.designAusZeile({ properties: [{ name: '_designId', value: 'MO-GRUESSEA-20261001-ABCD' }] }) === 'MO-GRUESSEA-20261001-ABCD'
            && LZ.designAusZeile({ sku: 'MO-GRUESSEA-20261001-ABCD__tee__M' }) === 'GRUESSEA-20261001-ABCD' && LZ.designAusZeile({ title: 'x' }) === '');
          const jobs = { 'D1': { firma: { name: 'EAST26', lizenz: { prozent: 20 } } }, 'D2': { firma: { name: 'Ball-z' } } };
          const order = { id: 1001, name: '#1001', currency: 'EUR', line_items: [
            { sku: 'MO-D1__tee__M', price: '24.90', quantity: 2 }, { sku: 'MO-D2__tasse__', price: '14.90', quantity: 1 }, { title: 'ohne Design', price: '5.00', quantity: 1 }] };
          const deps = { readJob: async (id) => jobs[id] || null, kontoFuer: async () => '', secretKey: '', firmenSlug: (s) => String(s).toLowerCase().replace(/[^a-z0-9_-]/g, '') };
          const s1 = await LZ.beiBestellung(lager, order, deps);
          const s2 = await LZ.beiBestellung(lager, order, deps);
          pruefe('Lizenz: aus einer Bestellung mit drei Zeilen wird EIN Satz (nur das Design mit Lizenz), 2 x 24,90 -> 8,37 EUR, ohne Stripe-Konto wartet er; der doppelte Webhook legt keinen zweiten an',
            s1.length === 1 && s1[0].firma === 'EAST26' && s1[0].betragCents === 837 && s1[0].bruttoCents === 4980 && s1[0].status === 'ohne_konto' && s2.length === 0 && (await LZ.liste(lager)).length === 1,
            JSON.stringify(s1.map(l => [l.firma, l.bruttoCents, l.betragCents, l.status])));
          const s3 = await LZ.ueberweisen(lager, s1[0].id, { ...deps, kontoFuer: async () => 'acct_test' });
          pruefe('Lizenz: mit Konto, aber ohne Stripe-Schluessel bleibt der Satz offen und sagt warum', s3.status === 'offen' && /STRIPE_SECRET_KEY/.test(s3.fehler));
          const sum = LZ.summen(await LZ.liste(lager));
          pruefe('Lizenz: Summen je Betrieb (offen vs. ueberwiesen)', sum.length === 1 && sum[0].firma === 'EAST26' && sum[0].offenCents === 837 && sum[0].ueberwiesenCents === 0);
          await fs.rm(lager, { recursive: true, force: true });
          const billL = await fs.readFile('billing.js', 'utf8'); const fulfL = await fs.readFile('fulfillment.js', 'utf8'); const hausRoute = await fs.readFile('haus-route.js', 'utf8');
          pruefe('Server: Lizenz haengt am Shopify-Webhook (beiBestellung), Transfer ueber /transfers mit transfer_group, Nachholen stuendlich nach dem Start, Backend-Liste und Probe',
            /import \* as lizenzen from '\.\/lizenzen\.js'/.test(srvE) && /beiBestellung: \(\{ order \}\) => lizenzen\.beiBestellung\(STORE, order, lizenzDeps\(\)\)/.test(srvE)
            && /setInterval\(lauf, 3600e3\)/.test(srvE) && /const lizenzKonto = async \(firmaName\)/.test(srvE)
            && /deps\.beiBestellung\(\{ orderId, order \}\)/.test(fulfL) && /export async function connectUeberweisung/.test(billL) && /s\.post\('\/transfers', \{ amount: betragCents/.test(billL)
            && /app\.post\('\/api\/admin\/lizenzen\/:id\/ueberweisen'/.test(hausRoute) && /app\.post\('\/api\/admin\/lizenzen\/probe'/.test(hausRoute));
        }
        const hausDateien = await fs.readdir('postkarte/haus');
        const HR = await import('./haus-route.js');
        pruefe('Das Haus-Design liegt vorgebaut im Repo: acht Artikel und der QR fuer den Tisch - ohne Beutel und ohne Schneidebrett (Markus, 1. Okt.), keine Postkarten-Bilder mehr',
          !hausDateien.some(f => /-karte\.jpg$/.test(f)) && hausDateien.includes('east26-qr.png') && HR.TOR_TEILE.length === 8 && HR.TOR_TEILE.every(t => hausDateien.includes('east26-' + t + '.jpg'))
          && !HR.TOR_TEILE.includes('beutel') && !HR.TOR_TEILE.includes('brett') && !hausDateien.includes('east26-beutel.jpg') && !hausDateien.includes('east26-brett.jpg')
          && HR.TOR_TEILE.includes('strandtuch') && HR.TOR_TEILE.includes('fussmatte') && !HR.TOR_TEILE.includes('mousepad'),
          hausDateien.join(' '));
        // 1. Okt., Markus: "das Schneidebrett nehmen wir komplett raus, ueberall." Ein Schalter (GARMENTS.brett.aus,
        // Katalog ausserHandel, aus den Preisen) - der Eintrag bleibt fuer alte Designs lesbar.
        {
          const MKB = await import('./mockups.js'); const AK = await import('./artikel.js'); const PR = (await import('./preise.cjs')).default;
          const { mountProdukte } = await import('./produkte.js');
          pruefe('Schneidebrett ist ueberall raus: GARMENTS.brett.aus, nicht verkaufsfaehig, kein Vorzeige-Design, nicht in den Preisen - das Label bleibt fuer alte Bestellungen',
            MKB.GARMENTS.brett && MKB.GARMENTS.brett.aus === true && !AK.verkaufsfaehig('brett') && !Object.values(AK.artikelAuswahl()).flat().some(a => a.id === 'brett')
            && !MKB.passtVorzeige('brett', 'familie') && MKB.passtVorzeige('tasse', 'familie') && !PR.MERCH.brett && PR.label('brett') === 'Schneidebrett' && typeof mountProdukte === 'function');
        }
        const qrMeta = await sharp('postkarte/haus/east26-qr.png').metadata();
        pruefe('Tisch-QR 1200 px', qrMeta.width === 1200 && qrMeta.height === 1200);
        const hausTpl = await fs.readFile('haus.html', 'utf8');
        const hausRoute = await fs.readFile('haus-route.js', 'utf8');
        // 1. Okt., Markus: "Es geht keinen Kunden an, wie viel Prozent der Lizenz ... das ist doch Kundenseite!"
        const TOR_PLATZ = ['__LOGO__', '__NAME__', '__ORT__', '__AKZENT__', '__AKZENT_INK__', '__SLUG__', '__TEE__', '__TEILE__', '__TEILE_KLASSE__', '__WEBSEITE__', '__HELD__'];
        pruefe('haus.html: Logo, Name, Ort, Akzent, EINE Tuer (Shirt & Co., einfacher Weg), Artikel - keine Postkarte, kein Gutschein, keine Lizenzzeile, kein Prozent, und nichts, was der Server nicht ersetzt',
          TOR_PLATZ.every(p => hausTpl.includes(p))
          && /href="\/bei\/__SLUG__\/machen\?was=teil"/.test(hausTpl) && !/was=postkarte|\/m\/gutschein|Postkarte|Gutschein/.test(hausTpl)
          && !/__LIZENZ__|Lizenz|\d+ %/.test(hausTpl) && !/Lizenz des Hauses|__LIZENZ__/.test(hausRoute)
          && (hausTpl.match(/__[A-Z_]+__/g) || []).every(p => TOR_PLATZ.includes(p))
          && (hausTpl.match(/__[A-Z_]+__/g) || []).every(p => new RegExp('replace\\(/' + p + '/g').test(hausRoute)));
        // 1. Okt., Markus: "Wenn jemand dort auf Textil machen drueckt, muss man genau da auch hinkommen
        // und nicht wieder auf die Postkarte, und es soll alles so funktionieren wie immer, nur dass
        // 100 % das EAST-Logo drauf ist - bei Luigi Luigi, beim Sportverein das Logo vom Sportverein."
        {
          const hausRoh = JSON.parse(await fs.readFile('postkarte/motto-haus.json', 'utf8'));
          const hausM = sanitizeMotto(hausRoh);
          const frei = sanitizeMotto(JSON.parse(await fs.readFile('seed.json', 'utf8')).find(m => m.slug === 'freestyle'));
          pruefe('Motto "haus" = Freestyle plus Betrieb: dieselben Felder wie Freestyle und davor das versteckte Feld firma, Logo-Upload exakt und Pflicht, markenfrei, Artikelwahl, Schalter hausTextil, Logo-Vorschlag an',
            hausM.hausTextil === true && hausM.markenfrei === true && hausM.artikelPflicht === true && hausM.upload.mode === 'exact' && hausM.upload.required === true
            && hausM.fields[0].key === 'firma' && hausM.fields[0].versteckt === true
            && hausM.fields.slice(1).map(f => f.key).join(',') === frei.fields.map(f => f.key).join(',')
            && publicView(hausM).hausTextil === true && publicView(hausM).firmenFrage === true,
            hausM.fields.map(f => f.key).join(','));
          pruefe('Server: fr_<slug>.png ist das Logo des freigegebenen Betriebs (nur fuer das Haus-Motto), der Auftrag traegt Betrieb und Lizenz, ohne Haus-Logo kein Auftrag',
            /if \(id && \/\^fr_\[a-z0-9\]\{1,60\}\\\.png\$\/\.test\(id\)\) \{/.test(srvE) && /if \(!motto\.hausTextil\) return res\.status\(400\)/.test(srvE)
            && /const png = await firmenLogoBild\(eintrag, STORE\);/.test(srvE) && /if \(motto\.hausTextil && !korr\) \{/.test(srvE)
            && /job\.kartenart = 'haus';/.test(srvE) && /if \(!uploadFile \|\| !uploadFile\.startsWith\('fr_'\)\)/.test(srvE)
            && /const HAUS_REV = 4;/.test(srvE));
          const seiteHT = await fs.readFile('motto-seite.js', 'utf8');
          const hausTpl2 = await fs.readFile('haus.html', 'utf8'); const hausRoute2 = await fs.readFile('haus-route.js', 'utf8');
          pruefe('Seite und Tor: ?firma= setzt beim Haus-Motto das Logo des Betriebs als Upload (fr_), ohne Entfernen-Knopf; Tuer 3 und die Artikel fuehren in den einfachen Weg fuer Artikel, nicht zur Postkarte',
            /if \(current\.hausTextil && \$\('v_firma'\)\) \{/.test(seiteHT) && /firmenLogo = 'fr_' \+ slugH \+ '\.png'/.test(seiteHT)
            && /if \(firmenLogo && \/\^fr_\/\.test\(firmenLogo\)\) \{/.test(seiteHT) && /\$\('thumb-del'\)\.classList\.add\('hide'\)/.test(seiteHT)
            && /href="\/bei\/__SLUG__\/machen\?was=teil"/.test(hausTpl2) && !/gruesse-aus\?firma=__SLUG__&amp;teil/.test(hausTpl2)
            && /href="\/bei\/\$\{encodeURIComponent\(h\.slug\)\}\/machen\?was=teil&amp;teil=/.test(hausRoute2));
        }
        pruefe('haus-route.js: /bei/<slug>, Aufsteller, QR und Artikelbilder, Lizenz-Liste fuers Backend; ohne Freigabe geht es zur Startseite',
          ["app.get('/bei/:slug'", "app.get('/bei/:slug/aufsteller'", "app.get('/api/mo/bei/:slug/qr.png'", "app.get('/api/mo/bei/:slug/:datei'", "app.get('/api/admin/lizenzen'"].every(s => hausRoute.includes(s))
          && /if \(!e \|\| !\(e\.freigabe && e\.freigabe\.datum\)\) return res\.redirect\('\/'\)/.test(hausRoute) && /@page\{size:A6 portrait/.test(hausRoute));
        pruefe('Server: das Tor ist eingehaengt (nach readTpl), und die Lizenz des Hauses haengt an jedem Design mit seinem Logo',
          /import \{ mountHaus \} from '\.\/haus-route\.js'/.test(srvE) && /mountHaus\(app, \{ STORE, env, adminGuard, firmenListe, firmenSlug, umfang: firmenUmfang, readTpl, escHtml, preise: PREISE, lizenzen, lizenzDeps, bilderDir: partner\.bilderDir, logoBild: \(e\) => firmenLogoBild\(e, STORE\),/.test(srvE)
          && srvE.indexOf('mountHaus(app, {') > srvE.indexOf('const readTpl =') && /if \(ff\.lizenz && ff\.lizenz\.prozent\) job\.firma\.lizenz = \{ prozent: \+ff\.lizenz\.prozent/.test(srvE));
        const seiteH = await fs.readFile('motto-seite.js', 'utf8');
        pruefe('Mottoseite ohne Postkarten-Wege: kein Absender-Knopf, kein Standort, kein Gutschein-Link - der Betrieb aus dem Link gilt nur beim Haus-Textil',
          !/wunschFirma|standortWaehlen|absenderAnbieten|current\.standort|current\.gutschein/.test(seiteH) && /if \(current\.hausTextil && \$\('v_firma'\)\) \{/.test(seiteH));
        // 2. Okt., Markus: "Haus-Design hoert sich total scheisse an. Auch der Name kann nicht aus der
        // kompletten Firmenbezeichnung genommen werden. Bei Luigi gehoert Luigi drauf, und nicht
        // Luigi's Pizza UG." Der Kunde sieht ueberall den Anzeigenamen (Eintrag anzeige), nie "das Haus".
        {
          const frei = JSON.parse(await fs.readFile('postkarte/firmen-freigaben.json', 'utf8'));
          const luigiA = frei.find(e => e.firma === "Luigi's Pizza UG");
          const hausTpl3 = await fs.readFile('haus.html', 'utf8');
          const hausRoute3 = await fs.readFile('haus-route.js', 'utf8');
          const koerper = hausTpl3.slice(hausTpl3.indexOf('<body>'));
          const hausM = JSON.parse(await fs.readFile('postkarte/motto-haus.json', 'utf8'));
          const saat = JSON.parse(await fs.readFile('seed.json', 'utf8')).find(m => m.slug === 'haus');
          pruefe('Anzeigename: Luigi heisst beim Kunden "Luigi" - das Tor nimmt anzeige, die Firmenbezeichnung bleibt im Eintrag',
            luigiA && luigiA.anzeige === 'Luigi' && /name: String\(e\.anzeige \|\| e\.firma\)/.test(hausRoute3));
          pruefe('Kein "Haus" auf der Kundenseite: haus.html spricht vom Betrieb mit Namen, das Motto heisst "Shirt, Tasse & Co. mit Logo" (Datei, Saat, HAUS_REV 2)',
            !/des Hauses|das Haus|im Haus|Haus-Design|Hausdesign/i.test(koerper) && /__NAME__ auf unseren Artikeln/.test(koerper)
            && hausM.name === 'Shirt, Tasse & Co. mit Logo' && saat && saat.name === 'Shirt, Tasse & Co. mit Logo'
            // 2. Okt., gemessen live: seed.json (rev) und HAUS_REV schreiben dasselbe Motto - sie muessen gleich sein
            && saat.rev === 4 && /const HAUS_REV = 4;/.test(srvE));
        }
        {
          const luigi = (JSON.parse(await fs.readFile('postkarte/firmen-freigaben.json', 'utf8'))).find(e => e.firma === "Luigi's Pizza UG");
          const hausDateienL = await fs.readdir('postkarte/haus');
          pruefe('Luigi hat sein Tor: tisch.tor /bei/luigispizzaug, acht Artikel und Tisch-QR liegen vor',
            !!(luigi && luigi.tisch && luigi.tisch.tor === '/bei/luigispizzaug' && luigi.freigabe && luigi.freigabe.datum)
            && hausDateienL.includes('luigispizzaug-qr.png')
            && HR.TOR_TEILE.every(t => hausDateienL.includes('luigispizzaug-' + t + '.jpg')));
          // 1. Okt., Markus: "Beim Strandtuch mit dem Auffuellen koenntest du beim Italiener links und
          // rechts die italienische Flagge hinmachen. Beim Spanier die spanische ... beim Griechen vom
          // Griechen, ist ja logisch." Gemessen an den Tuechern des Tors: Luigi gruen-weiss-rot laengs,
          // EAST26 rot-gold-rot laengs - an beiden Enden alle Farben, nicht nur die aeussere.
          const MKF = await import('./mockups.js');
          const mkSrc = await fs.readFile('mockups.js', 'utf8');
          const srvF = await fs.readFile('server.js', 'utf8');
          pruefe('Die Flagge des Hauses: Griechenland in der Flaggentabelle (neun Streifen), die Streifen laufen entlang der Achse, die das Motiv fuellt',
            !!(MKF.FLAGGEN.griechenland && MKF.FLAGGEN.griechenland.farben.length === 9) && MKF.flaggeFuer('griechenland') === MKF.FLAGGEN.griechenland
            && /const richtung = \(mm\.width \/ mm\.height >= w \/ h\) \? 'senkrecht' : 'waagerecht';/.test(mkSrc) && /flaggeSvg\(\{ \.\.\.flagge, richtung \}, w, h\)/.test(mkSrc));
          pruefe('Server: flaggenLandFuer (Kueche, sonst Land des Eintrags) haengt am Design (job.firma.flaggeLand) und geht VOR dem getippten Land in die Mockups',
            /function flaggenLandFuer\(ein\)/.test(srvF) && /job\.firma\.flaggeLand = flaggenLandFuer\(ff\);/.test(srvF) && /import \{ kuecheLand \} from '\.\/kueche\.js';/.test(srvF)
            && /const land = \(jobT && jobT\.firma && jobT\.firma\.flaggeLand\) \|\| \(jobT && jobT\.input && jobT\.input\.values \? jobT\.input\.values\.land : ''\);/.test(srvF)
            && /Italy: 'italien', Spain: 'spanien', Greece: 'griechenland'/.test(srvF));
          // 2. Okt.: Luigis Tuch traegt ein eigenes Hochformat-Design - die Flagge liegt jetzt an den Enden oben und unten.
          const hrQ = await fs.readFile('haus-route.js', 'utf8');
          pruefe('Tor: eine zu helle Hausfarbe (Creme beim Elbdeich) wird nie Schrift - naechste dunkle Hausfarbe, sonst die kraeftigste Logofarbe; Elbdeich hat sieben Artikel',
            /async function akzentVon\(e\)/.test(hrQ) && /hell\(farben\[0\]\) <= 0\.6/.test(hrQ) && /await akzentVon\(e\)/.test(hrQ)
            && ['tee', 'hoodie', 'kissen', 'poster', 'strandtuch', 'acrylbild', 'fussmatte'].every(t => hausDateienL.includes('bestesvomelbdeichhamburg-' + t + '.jpg')));
          // 2. Okt., danach (CLAUDE.md Regel 9): ein fuer das Teil GEBAUTES Motiv fuellt die Flaeche zu 100 %,
          // ohne aufgefuellte Seitenstreifen - die Flagge fuellt nur noch auf, wo ein Motiv nicht passt. Die
          // Tuecher der Tore tragen jetzt ihr eigenes Design; gemessen wird, dass oben KEIN Flaggenband
          // liegt. Am bekannten Fall geeicht: die alten Flaggen-Tuecher aus main 12,8 (Luigi) / 79,1 (EAST26), die
          // eigenen Designs 162 / 164 - Grenze 100.
          const zeilenStreuung = async (datei, y) => { const { data, info } = await sharp(datei).raw().toBuffer({ resolveWithObject: true }); const st = []; for (const [x0, x1] of [[290, 380], [400, 500], [520, 610]]) { const v = []; for (let x = x0; x < x1; x++) { const i = (y * info.width + x) * info.channels; v.push(data[i] + data[i + 1] + data[i + 2]); } const m = v.reduce((a, b) => a + b, 0) / v.length; st.push(Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length)); } return Math.max(...st); };
          const streu = [await zeilenStreuung('postkarte/haus/luigispizzaug-strandtuch.jpg', 90), await zeilenStreuung('postkarte/haus/east26-strandtuch.jpg', 120)];
          pruefe('Die Tuecher des Tors tragen ihr eigenes Design bis an die Kante, kein aufgefuelltes Flaggenband (Luigi, EAST26)', streu.every(x => x > 100), streu.map(x => x.toFixed(1)).join(' / '));
        }
      }

      // 2. Okt., Markus: "Die Bereiche EAST, Luigi und alle, die noch dazukommen, muessen selber einen
      // Login-Bereich bekommen ... das muss viel viel einfacher werden ... Foto hochladen, ein kleines
      // Textfeld, automatisiert das Logo vom Partner, nur zwei oder drei Stile ... eine Seite, wo die
      // Partner gesucht werden koennen und wo Partner sich eigenstaendig anmelden koennen." Und: "Ziel
      // ist ... fuer den Gastronom, fuer den Partner, fuer den Verein einen kleinen Merchandising-Shop."
      {
        const PA = await import('./partner.js');
        const PR = await import('./partner-route.js');
        const sharpP = (await import('sharp')).default;
        pruefe('Partner-Adresse: nur a-z und 0-9, Umlaute ausgeschrieben (passt zu /bei/<slug> und fr_<slug>.png)',
          PA.partnerSlug('Café Müller') === 'cafemueller' && PA.partnerSlug("Luigi's Pizza") === 'luigispizza' && PA.partnerSlug('TSV Harmstorf von 1921 e.V.') === 'tsvharmstorfvon1921ev');
        const gut = PA.anmeldungPruefen({ name: 'TSV Harmstorf', firma: 'TSV Harmstorf e.V.', strasse: 'Im Dorfe 9', plz: '21228', ort: 'Harmstorf', email: 'Vorstand@Example.org', art: 'verein', erklaerung: true, vereinbarung: true });
        pruefe('Anmeldung: gueltig -> Eintrag mit Status "bestaetigen", Shop-Vorgaben (alle Teile, keine Postkarte, kein Gutschein, vier Stile: Aquarell, Meisterwerk, Glitzer, Pop Art), E-Mail klein',
          gut.ok && gut.eintrag.status === 'bestaetigen' && gut.eintrag.slug === 'tsvharmstorf' && gut.eintrag.email === 'vorstand@example.org' && gut.eintrag.art === 'verein'
          && !('postkarte' in gut.eintrag.angebot) && !('gutschein' in gut.eintrag.angebot) && gut.eintrag.angebot.teile.length === PA.SHOP_TEILE.length && gut.eintrag.stile.join() === 'aquarell,meisterwerk,glitzer,popart');
        // 2. Okt., Markus: "Die Lizenzvereinbarung koennen wir doch, wenn jemand Partner werden will, mit anhaengen - die soll er einmal bestaetigen."
        pruefe('Vereinbarung: ohne Bestaetigung keine Anmeldung; mit Bestaetigung Fassung und Zeit im Eintrag und die Standard-Lizenz 20 % auf Artikel',
          /Lizenzvereinbarung bestaetigen/.test(PA.anmeldungPruefen({ name: 'X Y', strasse: 'a', ort: 'b', email: 'a@b.de', erklaerung: true }).fehler)
          && gut.eintrag.vereinbarung.fassung === PA.VEREINBARUNG.fassung && /^\d{4}-\d\d-\d\dT/.test(gut.eintrag.vereinbarung.bestaetigt)
          && gut.eintrag.lizenz.prozent === 20 && gut.eintrag.lizenz.artikel === true && !('postkarte' in gut.eintrag.lizenz) && !('gutschein' in gut.eintrag.lizenz)
          && PA.zusammenfuehren([], [{ ...gut.eintrag, status: 'aktiv', aktivSeit: '2026-10-02T09:00:00Z' }])[0].lizenz.prozent === 20
          && PA.zusammenfuehren([{ firma: 'EAST26', lizenz: { prozent: 20, artikel: true }, freigabe: { datum: 'x' } }], [{ slug: 'east26', basis: 'EAST26', lizenz: { prozent: 5 } }])[0].lizenz.prozent === 20
          && PA.zusammenfuehren([{ firma: 'Luigi', freigabe: { datum: 'x' } }], [{ slug: 'luigi', basis: 'Luigi', lizenz: { prozent: 20, artikel: true } }])[0].lizenz.prozent === 20);
        const vtrag = await fs.readFile('partner-vereinbarung.html', 'utf8');
        const prV = await fs.readFile('partner-route.js', 'utf8');
        pruefe('Vereinbarungsseite: alle Platzhalter ersetzt (Fassung, Stand, Prozent, Betreiber aus dem Impressum), Haken in Anmeldung und Partnerbereich, Bestaetigen fuer bestehende Partner',
          (vtrag.match(/__[A-Z_]+__/g) || []).every(x => new RegExp('replace\\(/' + x + '/g').test(prV)) && /app\.get\('\/partner\/vereinbarung'/.test(prV) && /app\.post\('\/api\/partner\/:slug\/vereinbarung'/.test(prV)
          && /if \(!p\.lizenz\) p\.lizenz = v\.lizenz;/.test(prV)
          && /id="vereinbarung"/.test(await fs.readFile('partner-werden.html', 'utf8')) && /id="vereinbarung-senden"/.test(await fs.readFile('partner-bereich.html', 'utf8')));
        // 2. Okt., Markus: "eine Design-Gebuehr ... wenn der Kunde das nicht selber hinbekommt, dass wir fuer 99 Euro ihm alle Wunsch-Designs fertig machen."
        const bilV = await fs.readFile('billing.js', 'utf8');
        pruefe('Design-Service: 99 Euro einmalig an uns (Stripe Checkout ohne Connect), Rueckkehr wird nachgeschlagen, ohne Stripe als Anfrage; Meldung an uns; im Vertrag als Nummer 7 mit Preis aus partner.js, keine Gutschein-Gebuehr mehr',
          PA.DESIGN_SERVICE.nettoCents === 9900 && PA.DESIGN_SERVICE.cents === 11781 && /zuzüglich Umsatzsteuer \(derzeit __DESIGN_BRUTTO__/.test(vtrag) && !/Gutschein/.test(vtrag) && !/Postkarte/.test(vtrag) && /export async function einmalCheckout\(/.test(bilV) && !/application_fee_amount/.test(bilV.slice(bilV.indexOf('export async function einmalCheckout'), bilV.indexOf('export async function gutscheinSessionLesen')))
          && /app\.post\('\/api\/partner\/:slug\/designservice'/.test(prV) && /app\.post\('\/api\/partner\/:slug\/designservice\/pruefen'/.test(prV)
          && /status: 'angefragt'/.test(prV) && /ds\.status = 'bezahlt'/.test(prV) && /designServiceMelden\(p, 'Design-Service bezahlt/.test(prV)
          && /<h2>7\. Design-Service<\/h2>/.test(vtrag) && /__DESIGN_PREIS__/.test(vtrag) && /id="ds-senden"/.test(await fs.readFile('partner-bereich.html', 'utf8')));
        pruefe('Anmeldung: ohne Freigabe, ohne E-Mail, ohne Anschrift oder mit vergebenem Namen abgelehnt',
          !PA.anmeldungPruefen({ name: 'X Y', strasse: 'a', ort: 'b', email: 'a@b.de' }).ok
          && !PA.anmeldungPruefen({ name: 'X Y', strasse: 'a', ort: 'b', erklaerung: true }).ok
          && !PA.anmeldungPruefen({ name: 'X Y', email: 'a@b.de', erklaerung: true }).ok
          && /gibt es schon/.test(PA.anmeldungPruefen({ name: 'Luigi', strasse: 'a', ort: 'b', email: 'a@b.de', erklaerung: true, vereinbarung: true }, { vergeben: ['Luigi'] }).fehler));
        const es = PA.einstellungenSauber({ anzeige: '<b>Luigi</b>', farbe: '#ab12CD', stile: ['comic', 'popart', 'aquarell', 'neon', 'bleistift'], angebot: { teile: ['tee', 'tasse', 'brett', 'kissen'], gutschein: 1, postkarte: true }, kueche: 'klingonisch', webseite: 'http://luigi.de' });
        pruefe('Einstellungen: hoechstens vier Stile aus der Liste, nur Teile des Shops, kein HTML, Farbe als #RRGGBB, unbekannte Kueche leer',
          es.stile.join() === 'comic,popart,aquarell,neon' && es.angebot.teile.join() === 'tee,kissen' && !('gutschein' in es.angebot) && !('postkarte' in es.angebot)
          && !/[<>]/.test(es.anzeige) && es.farben[0] === '#AB12CD' && es.kueche === '' && es.webseite === 'https://luigi.de');
        const repoP = [{ firma: "Luigi's Pizza UG", anzeige: 'Luigi', freigabe: { datum: '2026-09-26' }, tisch: { tor: '/bei/luigispizzaug' } }];
        const ablageP = [
          { slug: 'luigispizzaug', basis: "Luigi's Pizza UG", emails: ['luigi@example.org'], stile: ['popart', 'comic'], angebot: { teile: ['tee'] } },
          { slug: 'tsvharmstorf', firma: 'TSV Harmstorf e.V.', anzeige: 'TSV Harmstorf', status: 'aktiv', aktivSeit: '2026-10-02T08:00:00Z', emails: ['v@x.de'], punkt: [53.3487, 9.987], datei: 'partner-tsvharmstorf.png' },
          { slug: 'wartet', firma: 'Wartet GmbH', anzeige: 'Wartet', status: 'bestaetigen' },
          { slug: 'adidasshop', firma: 'Adidas Shop', anzeige: 'Adidas Shop', status: 'pruefen' }
        ];
        const zl = PA.zusammenfuehren(repoP, ablageP);
        const luigiZ = zl.find(e => e.firma === "Luigi's Pizza UG"), tsvZ = zl.find(e => e.firma === 'tsvharmstorf');
        pruefe('Zusammenfuehren: Repo-Partner bekommt seine Einstellungen und seinen Zugang, ein aktiver eigener Partner wird ein Freigabe-Eintrag mit Datum, unbestaetigte und markenverdaechtige bleiben draussen',
          zl.length === 2 && luigiZ.stile.join() === 'popart,comic' && luigiZ.angebot.teile.join() === 'tee' && luigiZ.partner.emails[0] === 'luigi@example.org'
          && tsvZ && tsvZ.anzeige === 'TSV Harmstorf' && tsvZ.freigabe.datum === '2026-10-02' && tsvZ.datei === 'partner-tsvharmstorf.png' && tsvZ.partner.selbst === true
          && !zl.some(e => e.firma === 'wartet' || e.firma === 'adidasshop'));
        pruefe('Shop nur mit ausdruecklicher Zustimmung: Partner, Tisch-Tor oder Artikel-Lizenz - eine reine Logo-Freigabe (Ball-z & Co.) hat keinen Artikel-Shop',
          PR.shopErlaubt(tsvZ) && PR.shopErlaubt(luigiZ) && PR.shopErlaubt({ freigabe: { datum: 'x' }, lizenz: { artikel: true } })
          && !PR.shopErlaubt({ firma: 'Ball-z', freigabe: { datum: '2026-09-22' } }) && PR.angebotVon({ firma: 'Ball-z', freigabe: { datum: 'x' } }).teile.length === 0
          && PR.angebotVon(luigiZ).teile.join() === 'tee' && !('gutschein' in PR.angebotVon(tsvZ)));
        // Ein Logo auf weissem Grund wird vom Rand her freigestellt - der weisse Kreis IM Logo bleibt.
        const svgL = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="600" height="300" fill="#fff"/><circle cx="150" cy="150" r="100" fill="#1E6B3A"/><circle cx="150" cy="150" r="40" fill="#fff"/></svg>';
        const auf = await PR.logoAufbereiten(sharpP, await sharpP(Buffer.from(svgL)).jpeg({ quality: 95 }).toBuffer());
        const rawL = await sharpP(auf.png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const px = (x, y) => rawL.data[(y * rawL.info.width + x) * 4 + 3];
        pruefe('Logo-Upload: weisser Grund vom Rand her durchsichtig, auf den Inhalt beschnitten, der weisse Kreis im Logo bleibt deckend',
          auf.freigestellt && rawL.info.width <= 210 && rawL.info.width >= 190 && px(0, 0) === 0 && px(Math.round(rawL.info.width / 2), Math.round(rawL.info.height / 2)) === 255);
        const srvP = await fs.readFile('server.js', 'utf8');
        const prSrc = await fs.readFile('partner-route.js', 'utf8');
        pruefe('Server: Repo-Freigaben und Partner-Ablage sind EINE Liste (firmenFreigaben), Partner-APIs mit grossem Body vor dem allgemeinen Parser, Partner eingehaengt',
          /import \{ freigaben as firmenFreigabenRepo,/.test(srvP) && /async function firmenFreigaben\(\) \{ return partner\.zusammenfuehren\(await firmenFreigabenRepo\(\), await partner\.alle\(\)\); \}/.test(srvP)
          && srvP.indexOf("app.use('/api/partner', express.json({ limit: '9mb' }))") > 0 && srvP.indexOf("app.use('/api/partner', express.json({ limit: '9mb' }))") < srvP.indexOf("app.use(express.json({ limit: '256kb' }))")
          && /mountPartner\(app, \{/.test(srvP) && /bilderDir: partner\.bilderDir/.test(srvP) && /accounts\.createLogin\(email, next, 3 \* 86400e3\)/.test(srvP));
        pruefe('Ergebnis: ein Motiv mit Partner-Logo (kartenart haus) zeigt nur die Teile aus dem Angebot des Partners',
          /if \(j\.kartenart === 'haus' && j\.firma && j\.mockups\) \{/.test(srvP) && /mockups: mockupsZeigen,/.test(srvP));
        pruefe('Wege: /partner, /partner/werden, /partner/bereich, /bei/<slug>/machen, Liste, Plan, Anmelden, Bereich, Einstellungen, Logo, Backend',
          ["app.get('/partner'", "app.get('/partner/werden'", "app.get('/partner/bereich'", "app.get('/bei/:slug/machen'", "app.get('/api/partner/liste'", "app.get('/api/partner/:slug/plan'",
            "app.post('/api/partner/anmelden'", "app.get('/api/partner/ich'", "app.post('/api/partner/:slug/einstellungen'", "app.post('/api/partner/:slug/logo'", "app.get('/api/admin/partner'", "app.post('/api/admin/partner/:slug'"].every(w => prSrc.includes(w))
          && /p\.status = p\.markenTreffer \? 'pruefen' : 'aktiv';/.test(prSrc));
        const machen = await fs.readFile('bei-machen.html', 'utf8');
        pruefe('Einfacher Weg: Foto, Text, Stil auf EINEM Bildschirm; Logo exakt (fr_), nur Shirt & Co. (keine Postkarte); Warten auf der Seite, erst fertig zur Mottoseite (mo_lauf), Fehler bleiben hier',
          /id="foto"/.test(machen) && /id="motiv"/.test(machen) && !/id="gruss"/.test(machen) && /id="stile"/.test(machen)
          && /uploadId: plan\.logoUpload, logoArt: 'exakt'/.test(machen) && !/gruesse-aus|postkarte/.test(machen) && /var motto = 'haus';/.test(machen)
          && /if \(st === 'done'\) \{/.test(machen) && /localStorage\.setItem\('mo_lauf'/.test(machen) && /zeigen\(l\); return;/.test(machen) && machen.indexOf('zeigen(l); return;') > machen.indexOf("if (st === 'done') {")
          && /Noch einmal starten/.test(machen) && !/📷/.test(machen));
        // 2. Okt., Markus: Gaeste beim Partner konnten nicht sagen, dass sie keine Lust haben zu warten - "WhatsApp und 4".
        pruefe('Nicht warten (4): der Auftrag liegt im Speicher des Handys je Partner (7 Tage), nicht nur im Tab; Seite wieder auf = fertiges Motiv, danach "Dein letztes Motiv"; Uebergabe an die Mottoseite mit frischer Zeit (45-Minuten-Grenze)',
          /var LAUF_KEY = 'mo_partner_lauf_' \+ SLUG, LAUF_TAGE = 7;/.test(machen) && !/sessionStorage\.setItem/.test(machen)
          && /if \(!offen\.gesehen\) \{ warten\(offen, true\); return; \}/.test(machen) && /id="letztes"/.test(machen)
          && /localStorage\.setItem\('mo_lauf', JSON\.stringify\(\{ jobId: l\.jobId, started: Date\.now\(\)/.test(machen)
          && /Keine Lust zu warten\?<\/b> Mach die Seite ruhig zu/.test(machen));
        pruefe('Nicht warten (WhatsApp): Link aus der Nachricht (?lauf=&m=&a=) fuehrt auf die Partnerseite und zeigt das Motiv; das Feld kommt nur, wenn WhatsApp eingerichtet ist',
          /if \(\/\^mo_\[a-f0-9\]\{16\}\$\/\.test\(id\)/.test(machen) && /laufMerken\(l\); warten\(l, false\); return;/.test(machen)
          && /fetch\('\/api\/mo\/benachrichtigen\/wege'/.test(machen) && /\$\('wa-block'\)\.classList\.toggle\('hide', !w\.whatsapp\)/.test(machen)
          && /whatsapp: nr, partner: SLUG/.test(machen) && /löschen sie danach/.test(machen));
        {
          // 2. Okt., Markus: "keine E-Mail, dass das Design fertig ist ... allerdings eine Nachricht, dass jemand ein Design gemacht hat ... Kaufabbruch!"
          const srvM = await fs.readFile('server.js', 'utf8'), accM = await fs.readFile('accounts.js', 'utf8');
          pruefe('Fertig-Mail: jeder Kunde mit Konto bekommt sie automatisch (nicht nur nach "Keine Lust zu warten"); Vorzeige/Automatik/Pruefstand nicht',
            /saveJob\(job\); meldeAdresseAusKonto\(job\)\.then\(\(\) => meldeFertig\(job\)\); meldeChef\(job\);/.test(srvM)
            && /async function meldeAdresseAusKonto\(job\) \{/.test(srvM) && /if \(job\.vorzeige \|\| job\.auto \|\| job\.test \|\| \(job\.who && job\.who\.via === 'pruefstand'\)\) return;\n    if \(!\(job\.who && job\.who\.userId\)/.test(srvM));
          pruefe('Fertig-Mail: im Anhang das Motiv (Vorschau mit Wasserzeichen) und die Ansicht auf dem Teil, nie die Druckdatei; scheitert ein Anhang, geht die Mail ohne raus',
            /anhang\.push\(\{ url: job\.preview, name: `Motiv-\$\{nr\}\.png` \}\)/.test(srvM) && /if \(gut && teilUrl\) anhang\.push/.test(srvM)
            && !/anhang\.push\(\{ url: [^}]*master/i.test(srvM) && /if \(!\(m\.anhang && m\.anhang\.length\)\) throw e;/.test(srvM)
            && /attachment: anhang\.map\(a => \(\{ url: a\.url, name: a\.name \}\)\)/.test(accM));
        }
        {
          // 3. Okt., Markus: "Barca hat nicht geklappt wegen Sperre Fussball .. Aber das Hotel heisst Hotel Barca."
          const { markenStore } = await import('./marken.js');
          const mk = markenStore('/nicht-da/mo-marken-probe'); await mk.ready();
          // ... und am selben Tag: "duerfen nur gesperrt werden, wenn sie im Kontext mit Fussball sind ... HSV kann jeder drauf schreiben. Ist es HSV Hamburg, dann ist es klar der Fussball-Bezug."
          const frei = ['Hotel Barca', 'Grüße aus dem Hotel Barca', 'Bar Juve', 'Pizzeria Ajax', 'Barcelona', 'Grüße aus Barcelona', 'Barca', 'HSV', 'BVB', 'Grüße aus Leverkusen',
            'Grüße aus Dortmund und Leverkusen', 'Grüße aus München, Bayern', 'Grüße aus Gelsenkirchen-Schalke', '1860', 'Fortuna', 'Eintracht'].every(t => !mk.check(t));
          const gesperrt = ['FC Barcelona', 'Barca Fan', 'Hotel FC Barcelona', 'Real Madrid Hotel', 'HSV Hamburg', 'Hamburger SV', 'Werderfan', 'Bundesliga', 'Mainz 05', 'Allianz Arena', 'Borussia Dortmund', 'Nike', 'Disney'].every(t => !!mk.check(t));
          pruefe('Markensperre nur mit Fussball-Bezug: Barcelona, Barca, HSV, Leverkusen allein frei; HSV Hamburg, Barca Fan, Werderfan, FC Barcelona, Bundesliga, Stadien gesperrt; Hotel Barca frei; Produktmarken wie bisher', frei && gesperrt,
            JSON.stringify({ frei: ['Barcelona', 'Barca', 'HSV'].map(t => !mk.check(t)), gesperrt: ['HSV Hamburg', 'Werderfan'].map(t => !!mk.check(t)) }));
          pruefe('Fussball-Bezug aus dem ganzen Design: "Barca" neben einem Fussballwort, auf dem Fan-Shirt oder mit "Stadion..." gesperrt; "Hertha" neben "Berlin" (Vorname) frei',
            !!mk.check('Barca', null, ['Fußball-Abend']) && !!mk.check('Barca', null, ['Fan-Shirt']) && !!mk.check('HSV', null, ['Die Stadionwurst-Gang']) && !mk.check('Hertha', null, ['Oma aus Berlin']));
          pruefe('Markensperre im Bild: "HOTEL" und "BARCA" als zwei Texte sind frei; "BARCA" auf einem Fan-Motto gesperrt; "FC BARCELONA" immer; ein erkanntes Wappen "Barca" bleibt gesperrt',
            !mk.checkImageTexts(['HOTEL', 'BARCA'], ['Hotel Barca']) && !!mk.checkImageTexts(['BARCA'], ['Barca'], ['Fan-Shirt']) && !!mk.checkImageTexts(['FC BARCELONA'], ['Hotel Barca'])
            && !!mk.checkLogos([{ name: 'Barca', beschreibung: 'crest', echt: false, sicher: false }]));
          const srvS = await fs.readFile('server.js', 'utf8');
          pruefe('Markensperre im Server: Eingabe, Freitext, Namensliste und Bild-QA kennen den Ortsnamen der Karte und den Fussball-Bezug des ganzen Designs (markenKontext)',
            /marken\.checkAll\(printedVals, ortsNamen\(values\), markenKontext\(motto, values\)\)/.test(srvS) && /marken\.checkImageTexts\(texts, opts\.erlaubt, opts\.kontext\)/.test(srvS)
            && (srvS.match(/erlaubt: ortsNamen\(values\), kontext: markenKontext\(motto, values\)/g) || []).length === 2 && /marken\.checkAll\(pp\.names, null, markenKontext\(/.test(srvS));
          // 3. Okt., Markus: "Und ich moechte da immer sofort eine Nachricht, wenn ein Versuch gesperrt [wird]."
          pruefe('Sperre: jede Sperre (verboten und Marke: Eingabe, Freitext, Namen, Upload, fertiges Bild) landet im Protokoll und geht sofort als Mail raus, gleiche Sperre vom selben Besucher hoechstens alle 10 Minuten',
            /sperreMelden\(\{ quelle, wort, eingabe, motto, auftrag, spur:/.test(srvS) && /< 10 \* 60000\) return;/.test(srvS)
            && ['marke-eingabe', 'marke-freitext', 'marke-namen', 'marke-upload', 'marke-bild'].every(q => srvS.includes(`verbotenMerken({ quelle: '${q}'`)));
        }
        {
          // 4. Okt., Markus (EAST26-Shirt im Shop): "Warum wurde das Logo vom East hier verfremdet? Das Logo ist doch ganz klar."
          // Auf den Shop-Bildern sitzt das ORIGINAL-Logo (werkzeug/logo-einsetzen.mjs). Gemessen wird an den Stellen aus
          // postkarte/haus/logo-plaetze.json die mittlere Abweichung der Logo-Pixel vom Original: eingesetzt 7-15,
          // von der Bild-KI nachgezeichnet (alte Bilder) 43-90. Grenze 25.
          const sharpL = (await import('sharp')).default;
          const plaetze = JSON.parse(await fs.readFile('postkarte/haus/logo-plaetze.json', 'utf8'));
          const abw = [];
          for (const [slug, e] of Object.entries(plaetze)) {
            if (slug.startsWith('_')) continue;
            for (const [teil, p] of Object.entries(e.plaetze)) {
              const logo = await sharpL('postkarte/logos/' + e.logo).trim().resize(p.w, p.h, { fit: p.verzerren ? 'fill' : 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).ensureAlpha().raw().toBuffer();
              const bild = await sharpL(`postkarte/haus/${slug}-${teil}.jpg`).extract({ left: Math.round(p.cx - p.w / 2), top: Math.round(p.cy - p.h / 2), width: p.w, height: p.h }).removeAlpha().raw().toBuffer();
              let sum = 0, n = 0;
              for (let i = 0; i < p.w * p.h; i++) { if (logo[i * 4 + 3] < 250) continue; for (let k = 0; k < 3; k++) sum += Math.abs(logo[i * 4 + k] - bild[i * 3 + k]); n++; }
              abw.push([slug + '-' + teil, n ? sum / n / 3 : 999]);
            }
          }
          pruefe('Shop-Bilder der Partner: das Logo ist das Original, nicht von der Bild-KI nachgezeichnet (EAST26, sechs Artikel - das Hoodie-Brustemblem ist zu klein zum Messen; Abweichung unter 25)',
            abw.length >= 6 && abw.every(([, a]) => a < 25), abw.map(([k, a]) => k + ' ' + a.toFixed(1)).join(' · '));
        }
        {
          // 4. Okt., Markus: "Streich den Namen aus der Liste, wenn wir selber was bauen" - "Anna" kommt in keinem
          // eigenen Beispiel vor (Platzhalter, Vorzeige-Vorgaben, Seiten, Haus-Motto).
          const dateien = ['seed.json', 'vorzeige-designs.json', 'postkarte/motto-haus.json', 'bei-machen.html', 'haus.html', 'motto.html', 'home-neu.html', 'partner-werden.html'];
          const mitAnna = [];
          for (const d of dateien) { try { if (/\bAnna\b/.test(await fs.readFile(d, 'utf8'))) mitAnna.push(d); } catch (e) { /* Datei fehlt */ } }
          pruefe('Kein "Anna" in eigenen Beispielen (Platzhalter, Vorzeige, Seiten)', mitAnna.length === 0, mitAnna.join(', '));
        }
        {
          // 5. Okt., Markus (EAST26-Weg zeigte "Unser Stammtisch mit Pizza und Vespa ... Luigis Crew"): "das muss immer zum
          // Partner passen". Das Beispiel kommt je Partner aus Name, Ort und Art.
          const P = await import('./partner.js');
          const fr = JSON.parse(await fs.readFile('postkarte/firmen-freigaben.json', 'utf8'));
          const bsp = (re) => P.motivBeispiel(fr.find(e => re.test(e.firma)) || {});
          const east = bsp(/EAST26/), luigi = bsp(/Luigi/), elb = bsp(/Elbdeich/);
          const seite = await fs.readFile('bei-machen.html', 'utf8');
          pruefe('Beispiel unter "Was soll drauf?" passt zum Partner (EAST26 ohne Pizza/Luigi, Luigi mit Pizza, Elbdeich mit Ort), nie fest "Luigis Crew"',
            /EAST26/.test(east) && /Santany/.test(east) && !/pizza|luigi/i.test(east) && /Pizza/.test(luigi) && /Moorburg/.test(elb)
              && !/Luigis Crew|Stammtisch mit Pizza/.test(seite) && /p\.motivBeispiel/.test(seite), [east, luigi, elb].join(' | '));
        }
        {
          // 5. Okt., Markus: "Gerade Karneval sollte ziemlich bunt und grell sein" und "fuer Abi ... eine Frontseite und eine
          // Rueckseite ... boring".
          const sv = await fs.readFile('server.js', 'utf8');
          const sf = JSON.parse(await fs.readFile('startseite/schaufenster.json', 'utf8')).designs || [];
          // 9. Okt.: Karneval ist voruebergehend nicht im Schaufenster (Markus: Koeln mit Narrenkappe, nicht Eulenspiegel - das
          // neue Koelner Design kommt nach). Pflicht bleibt: die feste Farbe je Eintrag im Code, und wo ein Karneval-Eintrag
          // eine Farbe traegt, ist es Gelb.
          const karneval = sf.find(e => e.vorzeige === 'karneval' || /^MO-KARNEVAL-/.test(e.id || '')) || null;
          pruefe('Schaufenster: Karneval (wenn dabei) mit fester Farbe nur Gelb (feste Farbe je Eintrag - ohne faerbbare Szene auf dem Herstellerfoto); Band: Abi nur mit Rueckseite (Namen), nie dieselbe Vorderseite',
            (!karneval || !karneval.farbe || karneval.farbe === 'gelb') && /TEXTIL_FARBEN\[eintrag\.farbe\]/.test(sv) && /farbeOhneSzene/.test(sv)
              && /abiRuecken && !x\.back\) continue/.test(sv) && /abiRuecken \? \[\[w\.garment, false, 'back'\]/.test(sv), 'Karneval ' + (karneval ? (karneval.farbe || 'weiss') : 'fehlt'));
        }
        {
          // 5. Okt., Markus mit drei Bildern aus dem Band: blau auf Rot, weiss auf weiss, Rahmen um das Bowling-Motiv.
          const sharp = (await import('sharp')).default;
          const B = await import('./brett.js');
          const sv = await fs.readFile('server.js', 'utf8');
          const svg = (inhalt, w = 600, h = 800) => sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${inhalt}</svg>`)).png().toBuffer();
          const F = { weiss: '#FFFFFF', schwarz: '#111111', rot: '#C8102E', royal: '#1F3E8C', gelb: '#F5D21F' };
          const blau = await B.farbWerte(await svg('<circle cx="300" cy="400" r="200" fill="#1D3FBF"/>'), F);
          const weissFein = await B.farbWerte(await svg('<circle cx="300" cy="250" r="140" fill="#111"/><text x="300" y="600" font-size="60" text-anchor="middle" font-family="DejaVu Sans" fill="#F4F4F4" stroke="#F4F4F4">LEBEN AUF ZWEI RAEDERN</text><path d="M80 680 C 200 640, 400 720, 520 680" stroke="#EEE" stroke-width="6" fill="none"/>'), F);
          const kasten = await B.farbWerte(await svg('<rect x="20" y="20" width="560" height="760" fill="none" stroke="#2A6" stroke-width="8" stroke-dasharray="30 14"/><circle cx="300" cy="400" r="150" fill="#E33"/>'), F);
          const emblem = await B.farbWerte(await svg('<circle cx="300" cy="400" r="280" fill="#E33"/><circle cx="300" cy="400" r="200" fill="#FFF"/>'), F);
          const weissMotiv = await B.farbWerte(await svg('<text x="300" y="420" font-size="150" text-anchor="middle" font-family="DejaVu Sans" font-weight="700" fill="#FFF">HSV</text><rect x="100" y="480" width="400" height="16" fill="#000"/>'), F);
          pruefe('Band/Schaufenster: Blau auf Rot beisst, feine weisse Schrift auf Weiss faellt durch, gestrichelter Kasten ist ein Rahmen, rundes Emblem nicht, Rot nur fuer weisse Motive',
            !B.zeigbar(blau, 'rot') && blau.biss.rot > B.BISS_GRENZE && B.zeigbar(blau, 'weiss')
              && !B.zeigbar(weissFein, 'weiss') && weissFein.fein.weiss > B.FEIN_GRENZE
              && kasten.rahmen >= B.RAHMEN_GRENZE && emblem.rahmen < B.RAHMEN_GRENZE
              && !(B.besteFarbe(blau, F, ['rot', 'royal', 'gelb']) || []).includes('rot') && !(B.besteFarbe(blau, F, ['rot', 'royal', 'gelb']) || []).includes('royal')
              && B.zeigbar(weissMotiv, 'rot') && !B.zeigbar(emblem, 'rot') && !B.zeigbar({ werte: {} }, 'weiss')
              && /zeigbarAuf\(sc\[x\.designId\], stoffVon\(color, farbe, gewaehlt\[0\]\)\)/.test(sv) && /NIE_AUF_HELL = \['aquarell'\]/.test(sv) && /if \(!zeigbarAuf\(e, stoffVon\(color, farbe\)\)\)/.test(sv) && /farbMessung\.v !== MESS_STAND/.test(sv),
            JSON.stringify({ biss: blau.biss.rot, fein: weissFein.fein.weiss, rahmen: [kasten.rahmen, emblem.rahmen], weiss: weissMotiv.palette }));
          // 5. Okt. nachmittags, Markus: "Die farbigen Sachen gefallen mir ueberhaupt nicht und da ist schon wieder weiss auf weiss".
          // Wenig Helles insgesamt, aber genau am Rand zum Stoff (weisse Kontur, weisse Schrift neben dunklem Motiv) - faellt durch.
          const F2 = { ...F, natur: '#EFE6D2' };
          const hellRand = await B.farbWerte(await svg('<circle cx="300" cy="330" r="190" fill="#FFF"/><circle cx="300" cy="330" r="172" fill="#111"/><text x="300" y="640" font-size="42" text-anchor="middle" font-family="DejaVu Sans" fill="#FAFAFA">ZWEI RAEDER</text>'), F2);
          const dunkelRand = await B.farbWerte(await svg('<circle cx="300" cy="330" r="190" fill="#111"/><circle cx="300" cy="330" r="60" fill="#FFF"/><text x="300" y="640" font-size="60" text-anchor="middle" font-family="DejaVu Sans" font-weight="700" fill="#C8102E">ZWEI RAEDER</text>'), F2);
          pruefe('Band: helle Kontur am Rand zum Stoff faellt auf Weiss und Natur durch (Rand-Messung), dunkler Rand mit Weiss innen bleibt; Band und Schaufenster faerben nicht mehr selbst (nur Karneval), das Band nimmt Ersatz bis es voll ist, Beutel wird gegen Natur gemessen',
            hellRand.rand.weiss > B.RAND_GRENZE && !B.zeigbar(hellRand, 'weiss') && !B.zeigbar(hellRand, 'natur') && dunkelRand.rand.weiss <= B.RAND_GRENZE && B.zeigbar(dunkelRand, 'weiss')
              && /const BAND_FARBIG = false;/.test(sv) && /\(BAND_FARBIG \|\| x\.slug === 'karneval'\) \? besteFarbe/.test(sv) && /i < items\.length && fertige\.length < limit; i\+\+/.test(sv) && /fest\.concat\(vorne, /.test(sv) && /schonText\.has\(textSchluessel\)\) continue/.test(sv) && /BAND_FARBIG && color === 'black'/.test(sv) && /g === 'beutel' \? 'natur'/.test(sv),
            JSON.stringify({ hell: hellRand.rand, dunkel: dunkelRand.rand }));
          const M = await import('./mottos.js');
          const z = Array.from({ length: 200 }, () => M.pickVariation({}, { styled: true }));
          const plaetze = new Set(z.map(v => (v.match(/placement of the main lettering[^:]*: ([^-]{0,30})/) || [])[1]).filter(Boolean));
          pruefe('Auftrag: der Platz der Hauptschrift wird gezogen (nie Bogen oben mit Band unten als Standard), kein gezeichneter Doppelrahmen mehr, kein Widerspruch Typo/kleine Schrift',
            plaetze.size >= 7 && z.filter(v => /placement of the main lettering/.test(v)).every(v => /NOT the stock look of an arched headline/.test(v))
              && !M.VARIETY.ornament.some(o => /frame/.test(o)) && !z.some(v => /TYPE IS|HEADLINE FIRST/.test(v) && /small and quiet/.test(v))
              && M.pickVariation({}, { format: 'breit' }).indexOf('placement') < 0, plaetze.size + ' Plaetze');
          const mh = await fs.readFile('motto.html', 'utf8'), bm = await fs.readFile('bei-machen.html', 'utf8');
          pruefe('Laptop: Weiter-Kasten und Startknopf kleben unten im Fenster, Stile am Laptop vierspaltig, Partnerseite zweispaltig mit Startleiste (Messung: werkzeug/probe-laptop.mjs)',
            /\.ab-fuss\{position:sticky;bottom:0/.test(mh) && /#go\{position:sticky/.test(mh) && /\.ab-schritt \.styles:not\(\.form\)\{grid-template-columns:repeat\(4,1fr\)\}/.test(mh)
              && /\.startleiste\{position:sticky;bottom:0/.test(bm) && /<div class="startleiste"><button class="start" id="start"/.test(bm), '');
          // 5. Okt., Markus (EAST26): ein vorgegebenes Design, nur Name, Datum, Spruch und Bewertung aendern sich.
          const MD = await import('./minimal-design.js');
          const fr = JSON.parse(await fs.readFile('postkarte/firmen-freigaben.json', 'utf8'));
          const east = fr.find(e => /EAST26/.test(e.firma));
          const ohne = await MD.minimalMotiv({ logo: await fs.readFile('postkarte/logos/east26.png'), lieblings: 'Mein Lieblingsrestaurant', ort: 'SANTANYÍ', punkt: east.punkt, zusatz: 'Max · 05.10.2026', textil: 'hell', W: 800 });
          const mit = await MD.minimalMotiv({ logo: await fs.readFile('postkarte/logos/east26.png'), lieblings: 'Mein Lieblingsrestaurant', ort: 'SANTANYÍ', punkt: east.punkt, zusatz: 'Max · 05.10.2026', sterne: 5, textil: 'hell', W: 800 });
          const hOhne = (await sharp(ohne.png).metadata()).height, hMit = (await sharp(mit.png).metadata()).height;
          pruefe('Partner wie im Shop: Seite bietet "Wie im Shop" (Spruch, Name, Datum, Sterne), /generate nimmt vorlage linie, runJob setzt minimalMotiv ohne Bild-KI; Sterne machen die Linie hoeher',
            /data-linie="ja"/.test(bm) && /vorlage: 'linie'/.test(bm) && /body\.vorlage === 'linie'/.test(sv) && /const codeBild = nurLogo \|\| linie;/.test(sv)
              && /!codeBild && attempt <= MAX_ATTEMPTS/.test(sv) && /minimalMotiv\(\{/.test(sv) && hMit > hOhne, hOhne + ' -> ' + hMit + ' px');
        }
        {
          // 5. Okt., Markus: "absoluter Highlight-Button relativ oben ... der Kunde tippt oder spricht seinen Wunsch nur ein".
          const { execFileSync } = await import('node:child_process');
          let aus = '';
          try { aus = execFileSync(process.execPath, ['werkzeug/probe-wunsch.mjs'], { encoding: 'utf8', timeout: 180000 }); } catch (e) { aus = String((e && e.stdout) || e); }
          const hn = await fs.readFile('home-neu.html', 'utf8');
          pruefe('Wunsch auf der Startseite: Kasten zwischen Laufband und Aufmacher, Mikrofon (de-DE), Server fuellt das Motto, Mottoseite steht ausgefuellt auf "Alles klar?" (iPhone und Laptop)',
            (aus.match(/^OK /mg) || []).length === 2 && hn.indexOf('class="wunsch"') > hn.indexOf('class="laufband"') && hn.indexOf('class="wunsch"') < hn.indexOf('class="held"') && /rec\.lang = 'de-DE'/.test(hn),
            aus.split('\n').filter(Boolean).slice(-3).join(' | '));
        }
        {
          const WA = await import('./whatsapp.js');
          const faelle = [['0171 2345678', '491712345678'], ['+49 171 234 5678', '491712345678'], ['0049-171-2345678', '491712345678'], ['+34 612 345 678', '34612345678'], ['12', ''], ['abc', ''], ['', '']];
          pruefe('WhatsApp: Nummern in die internationale Form (0171 -> 49171, +34 bleibt), Unsinn wird abgelehnt', faelle.every(([e, a]) => WA.nummerSauber(e) === a), faelle.map(([e]) => WA.nummerSauber(e)).join(' '));
          let gesendet = null;
          const fake = async (url, o) => { gesendet = { url, body: JSON.parse(o.body), auth: o.headers.authorization }; return { ok: true, json: async () => ({ messages: [{ id: 'wamid.X' }] }) }; };
          const env = { WHATSAPP_TOKEN: 't', WHATSAPP_PHONE_ID: '123' };
          const r = await WA.whatsappSenden(env, '0171 2345678', 'https://www.motto-otto.de/bei/luigispizzaug/machen?lauf=mo_0123456789abcdef&m=haus', { fetchFn: fake });
          let aus = false; try { await WA.whatsappSenden({}, '0171 2345678', 'x', { fetchFn: fake }); } catch (e) { aus = /nicht eingerichtet/.test(e.message); }
          pruefe('WhatsApp: freigegebene Vorlage (motiv_fertig, de) mit dem Link als {{1}} an die Cloud API; ohne Zugang aus; verdeckt nur die letzten drei Ziffern',
            r.id === 'wamid.X' && gesendet.url === 'https://graph.facebook.com/v21.0/123/messages' && gesendet.body.to === '491712345678' && gesendet.body.template.name === 'motiv_fertig'
            && gesendet.body.template.language.code === 'de' && gesendet.body.template.components[0].parameters[0].text.includes('?lauf=mo_0123456789abcdef') && aus
            && !WA.whatsappAn({}) && WA.nummerVerdeckt('491712345678') === '+•••••••••678');
          const srvW = await fs.readFile('server.js', 'utf8');
          pruefe('WhatsApp im Server: nur fuer den eigenen Auftrag, Nachricht genau einmal und nur bei Erfolg, die Nummer wird danach geloescht; die Seite fragt nur ja/nein ab',
            srvW.indexOf('const nummerRoh') > srvW.indexOf("if (!meinAuftrag(job, who)) return res.status(403)") && /if \(!job \|\| !job\.melde \|\| !job\.melde\.whatsapp \|\| job\.waGesendet\) return;/.test(srvW)
            && /if \(job\.status === 'done'\) \{\n      const base/.test(srvW) && /job\.melde = \{ \.\.\.job\.melde, whatsapp: '', whatsappVerdeckt: nummerVerdeckt\(nummer\) \};/.test(srvW)
            && /if \(job && job\.melde && job\.melde\.whatsapp\) await meldeWhatsapp\(job\);/.test(srvW)
            && /res\.json\(\{ email: !!env\.BREVO_API_KEY, whatsapp: whatsappAn\(env\) \}\)/.test(srvW));
        }
        const seiteP = await fs.readFile('motto-seite.js', 'utf8');
        pruefe('Mottoseite: ein schon fertiger Auftrag wird beim Oeffnen gezeigt, nicht hinter Schritt 1 der Abfolge (zumWartescreen vor laufTakt)',
          /if \(st === 'done'\) \{ started = s\.started; laufJob = s\.jobId; runActive = true; zumWartescreen\(\); laufTakt\(\); return; \}/.test(seiteP));
        const htmlP = await Promise.all(['partner.html', 'partner-werden.html', 'partner-bereich.html'].map(f => fs.readFile(f, 'utf8')));
        pruefe('Partnerseiten: Kopf und Farben aus marke.css, Partner im Menue, "Partner werden" und Login erreichbar, Freigabe-Text wie in partner.js',
          htmlP.every(h => /href="\/marke\.css"/.test(h) && /href="\/partner\.css"/.test(h) && /class="mo-kopf"/.test(h) && /href="\/partner"/.test(h))
          && /href="\/partner\/werden"/.test(htmlP[0]) && /href="\/partner\/bereich"/.test(htmlP[0])
          && htmlP[1].includes('Ich gebe Motto Otto frei, Namen und Logo auf Artikeln zu verwenden') && htmlP.every(h => !/Postkarte|Gutschein/.test(h)));
        const hausR = await fs.readFile('haus-route.js', 'utf8');
        pruefe('Tor: Kopfzeile nach Art (Verein, Gastro, Betrieb), Shop zeigt nur das Angebot (angebotVon, SHOP_TEILE), Bilder auch vom Volume',
          /const heldZeile = \(h\) => \(h\.art === 'verein'/.test(hausR) && /const angebot = angebotVon\(e\);/.test(hausR) && /for \(const t of SHOP_TEILE\)/.test(hausR) && /async function bildDatei\(name\)/.test(hausR));
      }

      // 2. Okt., Markus (Kissen von EAST26 mit braunen Streifen): "Wenn wir schon antippen, ein Design fuer ein
      // Kissen zu machen, dann sollte es zu 100 % passen." Gemessen am echten Motiv (Druckdatei 1:1, Kissen 40 x 40).
      {
        const mkK = await fs.readFile('mockups.js', 'utf8');
        const MK = await import('./mockups.js'), fsSync = await import('node:fs');
        const sharpK = (await import('sharp')).default;
        await MK.ensureTemplates('./storage');
        const quad = await sharpK({ create: { width: 1200, height: 1200, channels: 3, background: '#C02020' } }).png().toBuffer();
        const jk = await MK.makeMockup(quad, 'kissen', 'white', false, { place: 'front', artikel: { ansicht: 'kissen', motivart: 'vollflaechig', id: 'kissen' } });
        const { data: dk, info: ik } = await sharpK(jk).raw().toBuffer({ resolveWithObject: true });
        const b = MK.GARMENTS.kissen.box;
        const rot = (x, y) => { const i = (y * ik.width + x) * ik.channels; return dk[i] > 120 && dk[i + 1] < 90 && dk[i + 2] < 90; };
        const sy = Math.round(b.y + b.h / 2);
        pruefe('Kissen: ein fuer das Kissen gebautes Motiv (1:1 wie 40 x 40 cm) fuellt die Flaeche im Foto ganz - links und rechts kein aufgefuellter Streifen',
          /const passtZumArtikel = randlos && quelleVerh != null && !!echtCm/.test(mkK) && /fit: 'fill'/.test(mkK)
          && rot(b.x + 12, sy) && rot(b.x + b.w - 12, sy) && rot(Math.round(b.x + b.w / 2), b.y + 12));
        // Markus: "Das muss natuerlich fuer alle Artikel gelten, die wir anbieten." Jeder verkaeufliche
        // vollflaechige Artikel, je eine Groesse: ein Motiv im echten Mass des Teils fuellt die Flaeche bis an
        // alle vier Kanten. Mousepad, Fussmatte, Napfunterlage und Brotdose haben eine Maske, deren Box groesser
        // ist als die sichtbare Flaeche - dort misst die Box-Kante den Tisch, nicht das Motiv; im Bild geprueft
        // (werkzeug/alle-artikel-messen.mjs, 2. Okt.: alle 31 Groessen randvoll, vorn und Szene).
        const AK = await import('./artikel.js');
        const ohneBoxMessung = ['mousepad', 'fussmatte', 'napfunterlage', 'brotdose'];
        const nichtVoll = [];
        for (const aid of Object.keys(AK.ARTIKEL)) {
          if (!AK.verkaufsfaehig(aid) || AK.ARTIKEL[aid].motivart !== 'vollflaechig') continue;
          const g = AK.ansichtVon(aid) || aid;
          if (!MK.GARMENTS[g] || ohneBoxMessung.includes(g)) continue;
          const fl = Object.keys(AK.flaechenVon(aid))[0];
          const lw = AK.artikelLeinwand(aid, fl);
          const sc = 900 / Math.max(lw.px[0], lw.px[1]);
          const probe = await sharpK({ create: { width: Math.round(lw.px[0] * sc), height: Math.round(lw.px[1] * sc), channels: 3, background: '#C02020' } }).png().toBuffer();
          const jm = await MK.makeMockup(probe, g, 'white', false, { place: 'front', artikel: { id: aid, ansicht: g, motivart: 'vollflaechig', netto: lw.netto } });
          const { data: dm, info: im } = await sharpK(jm).raw().toBuffer({ resolveWithObject: true });
          const bx = MK.GARMENTS[g].box;
          const rotM = (x, y) => { const i = (y * im.width + x) * im.channels; return dm[i] > 110 && dm[i + 1] < 100 && dm[i + 2] < 100; };
          const mx = Math.round(bx.x + bx.w / 2), my = Math.round(bx.y + bx.h / 2);
          // 8. Okt.: oben in der Mitte des Gepaeckanhaengers sitzt die Oese (Maske laesst sie frei) - dort
          // die obere Kante ein Viertel weiter links messen, nicht auslassen.
          const ox = g === 'gepaeckanhaenger' ? Math.round(bx.x + bx.w * 0.25) : mx;
          if (!(rotM(bx.x + 10, my) && rotM(bx.x + bx.w - 10, my) && rotM(ox, bx.y + 10) && rotM(mx, bx.y + bx.h - 10))) nichtVoll.push(aid + ' ' + fl);
        }
        pruefe('Alle verkaeuflichen vollflaechigen Artikel: ein Motiv im echten Mass fuellt die Flaeche bis an alle vier Kanten (Kissen, Poster, Acrylbild, Tuerschild, Handtuch, Strandtuch, Hundedecke, Gepaeckanhaenger)',
          nichtVoll.length === 0, nichtVoll.join(', '));
      }
    }

    // ---- 27. Sept.: Minimalistisch, Bleistift ----------------------------------------------------
    {
      const { STYLES: ST } = await import('./mottos.js');
      // Markus: "Minimalistisch ist nicht einfarbig, sondern es ist nur minimalistisch GEZEICHNET -
      // d.h. wir koennen trotzdem alle Farben nutzen." Im Stiltext stand "very few colours".
      // Zweiter Anlauf am selben Tag - der erste war ein bunter Siebdruck mit Farbflaechen, Markus:
      // "Das hat aber noch mit unserem vorherigen Minimalistic Design nichts zu tun." Es bleibt
      // die feine LINIE von vorher, nur ohne die Farbsperre.
      pruefe('Minimalistisch: die feine Linie bleibt, ABER in allen Farben des Motivs - die Rationierung ist raus',
        /MINIMALIST LINE DRAWING, IN COLOUR/.test(ST.minimal.text) && /continuous line/.test(ST.minimal.text)
        && /THE MINIMALISM IS IN THE DRAWING, NOT IN THE PALETTE/.test(ST.minimal.text) && /never rationed to one or two accents/.test(ST.minimal.text)
        && !/very few colours/.test(ST.minimal.text) && !/off-white plus/.test(ST.minimal.text));
      // "Was machen wir so wie Aquarell, dass es nicht jeder Idiot sieht, dass es mit KI gemacht
      // ist" - Aquarell beschreibt ein MATERIAL mit seinen Zufaellen. Jetzt Minimal auch.
      // 30. Sept., Markus (Auftrag 00176, graue Scheibe hinter dem Emblem): das Modell hat das
      // bestellte "off-white paper" als Blatt MITGEMALT. Das Werkzeug bleibt (feine Stifte, Spuren
      // der Hand), das Papier ist ab jetzt das Shirt - kein gemaltes Blatt, keine Scheibe.
      pruefe('Minimalistisch beschreibt ein Werkzeug mit Spuren der Hand, nicht eine Abstraktion - und das Shirt ist das Papier',
        /DRAWN BY HAND WITH FINE PENS, NOT GENERATED/.test(ST.minimal.text) && /the shirt is the paper/.test(ST.minimal.text)
        && /line weight breathing/.test(ST.minimal.text) && !/off-white paper with a hint of grain/.test(ST.minimal.text) && !/empty paper between/.test(ST.minimal.text));
      // 9. Okt., Markus: "Schaufenster und Wand, bitte das Wasserzeichen entfernen und gute Aufloesung"
      {
        const srv = await fs.readFile('server.js', 'utf8'), mk = await fs.readFile('mockups.js', 'utf8');
        pruefe('Schaufenster und Band ohne Wasserzeichen: eigene Unterschrift (rein), eigene Datei _rein, 4:4:4 mit Qualitaet 93, nur wenn fertig',
          /req\.query\.rein === reinSig\(designId, exp\)/.test(srv) && /makeMockup\(master, garment, color, !rein, \{ hochwertig: rein/.test(srv)
          && /_rein\.jpg/.test(srv) && (srv.match(/await reinWennDa\(/g) || []).length >= 2
          && /chromaSubsampling: '4:4:4'/.test(mk) && !/\.jpeg\(\{ quality: 84 \}\)/.test(mk.slice(mk.indexOf('export async function makeMockup'), mk.indexOf('export async function makeMockup') + 40000)));
      }
      // 9. Okt.: Vorzeige-Bilder aus dem Repo (datei / kachelDatei) - jede genannte Datei liegt da, unter vorzeige/<motto>/
      {
        const man = JSON.parse(await fs.readFile('vorzeige-designs.json', 'utf8'));
        const fehlt = [];
        for (const [slug, m] of Object.entries(man.mottos || {})) {
          const liste = Object.values(m.artikel || {}).map(e => e && e.datei).concat([m.kachelDatei]).filter(Boolean);
          for (const d of liste) { try { if (!d.startsWith('vorzeige/' + slug + '/')) throw new Error('falscher Ort'); await fs.access(d); } catch (e) { fehlt.push(slug + ':' + d); } }
        }
        const hz = (man.mottos || {}).hochzeit || {};
        pruefe('Vorzeige aus dem Repo: jede Datei im Manifest liegt unter vorzeige/<motto>/, Hochzeit ohne alte Stil-Adressen',
          !fehlt.length && Object.keys(hz.styles || {}).length === 0 && !!hz.kachelDatei, fehlt.join(', '));
      }
      // 9. Okt., Markus: "Karneval ist aber eher gerade in Koeln, mit einer Narrenkappe und nicht so wie ein Eulenspiegel"
      {
        const M = await import('./mottos.js');
        const mk = JSON.parse(await fs.readFile('storage/mottos/karneval.json', 'utf8'));
        const koeln = M.buildPrompt(mk, { gruppe: 'Die Rheinjecken', stadt: 'Köln', jahr: '2026', spruch: 'Alaaf' }, { style: 'comic', textile: 'weiss', variation: 'central motif: a jester hat with bells and a venetian mask' });
        const mainz = M.buildPrompt(mk, { gruppe: 'Narren', stadt: 'Mainz' }, { style: 'comic', textile: 'weiss' });
        pruefe('Koelner Karneval: Narrenkappe = Schiffchen in Rot-Weiss mit Goldborte, nie Schellenmuetze, Harlekin oder Federmaske - nur bei Koeln',
          /COLOGNE "SCHIFFCHEN"/.test(koeln) && /NEVER a jester hat with bells/.test(koeln) && /NEVER a Venetian or feathered mask/.test(koeln) && !/SCHIFFCHEN/.test(mainz));
      }
      // "Recherchiere bitte auch mal nach Kalligraphie, dass es so aussieht, als waer's mit
      // Bleistift gemalt, auch sehr minimalistisch, jedoch relativ detailgetreu."
      pruefe('Bleistift: fuer alle Mottos frei, Graphit auf Papier mit Kalligraphie-Schrift',
        !!ST.bleistift && ST.bleistift.label === 'Bleistift' && !ST.bleistift.nurMotto
        && /GRAPHITE PENCIL DRAWING ON PAPER/.test(ST.bleistift.text) && /calligraphic pencil script/.test(ST.bleistift.text)
        && /SELECTIVE DETAIL/.test(ST.bleistift.text) && /paper whose grain shows/.test(ST.bleistift.text) && /Nothing on this card looks generated/.test(ST.bleistift.text));
      {
        // platzhalterFinden liefert die groesste Insel jetzt auch allein - gemessen an einem Bild
        // mit einem grossen Magenta-Feld und einem kleinen Magenta-Punkt daneben.
        const IM = await import('./images.js');
        const feld = Buffer.from('<svg width="400" height="300"><rect width="400" height="300" fill="#fff"/><rect x="20" y="40" width="200" height="150" fill="#ff00e6"/><circle cx="300" cy="100" r="8" fill="#ff00e6"/></svg>');
        const png = await sharp(feld).png().toBuffer();
        const p = await IM.platzhalterFinden(png);
        pruefe('platzhalterFinden: der Kasten nimmt den Nachbarpunkt mit, die Insel allein ist das Feld',
          p.gefunden && p.kasten.x1 >= 290 && p.insel.x0 === 20 && p.insel.x1 === 219 && p.insel.y0 === 40 && p.insel.y1 === 189 && p.insel.breite === 200 && p.insel.hoehe === 150,
          JSON.stringify({ kasten: p.kasten, insel: p.insel }));
      }
    }

    // ---- 27. Sept.: der alte Reiter nach dem Deploy - die Seite fragt nach ihrer Fassung ----
    {
      const seite = await fs.readFile('motto-seite.js', 'utf8');
      const html = await fs.readFile('motto.html', 'utf8');
      const srv = await fs.readFile('server.js', 'utf8');
      pruefe('Seite: beim Zurueckkommen fragt sie /api/mo/fassung, laedt neu, wenn nichts angefangen ist, sonst Hinweis mit Knopf',
        /function fassungPruefen\(\)/.test(seite)
        && /if \(document\.hidden\) return;[\s\S]{0,120}fassungPruefen\(\);/.test(seite)
        && /if \(ev && ev\.persisted\) fassungPruefen\(\);/.test(seite)
        && /var angefangen = !!\(fotoSitzung \|\| runActive \|\| shown\.designId \|\| \(fieldsBox && fieldsBox\.dataset\.touched === '1'\)\);\n\s+if \(!angefangen\) \{ location\.reload\(\); return; \}/.test(seite)
        && /id="neue-fassung"/.test(html) && /id="neue-fassung-btn"/.test(html)
        && /app\.get\('\/api\/mo\/fassung', async \(req, res\) => \{ res\.set\('Cache-Control', 'no-store'\); res\.json\(\{ v: await assetV\(\) \}\); \}\);/.test(srv)
        && /res\.set\('Cache-Control', 'no-cache'\)\.type\('html'\)\.send\(html2\);/.test(srv));
    }

    {
      const seite = await fs.readFile('motto-seite.js', 'utf8');
      // 24. Sept., Markus: "Text korrigieren. Anklicken funktioniert nicht." Gemessen im
      // Browser: der Gruss steht im Abfolge-Schritt "text", nach dem fertigen Design steht die
      // Abfolge aber auf dem letzten Schritt "los" - und der hat gar kein Feld. Der Knopf
      // scrollte also zu einem Kasten, in dem nichts zu aendern war.
      pruefe('die Korrektur springt in den Abfolge-Schritt, in dem der Text wirklich steht',
        /abfolge\.zeige\(ziel\)/.test(seite)
        && /f\.printed !== false && f\.versteckt !== true && \(f\.type === 'text' \|\| f\.type === 'textarea'\)/.test(seite));
      pruefe('ohne fertiges Design sagt der Korrektur-Knopf, warum nichts passiert - er schweigt nicht',
        /Es ist noch kein fertiges Design da/.test(seite));
      // 24. Sept., Markus (Screenshot Tasse): "So koennte dein Motiv auf dem Tasse aussehen."
      // Der Artikel stand fest im Satz. Jeder Name, den wir wirklich fuehren, wird hier
      // durchgerechnet - eine neue Tasse im Katalog faellt sofort auf.
      {
        const wm = seite.match(/var WEIBLICH = (\/\^\([^/]+\)\$\/)/);
        const mm = seite.match(/var MEHRZAHL = (\/\^\([^/]+\)\$\/)/);
        pruefe('die Seite kennt weibliche und Mehrzahl-Artikel', !!wm && !!mm && /aufDem\(teilName\)/.test(seite));
        if (wm && mm) {
          const W = new RegExp(wm[1].slice(1, -1)), P = new RegExp(mm[1].slice(1, -1));
          const auf = (n) => W.test(n) ? 'auf der ' + n : P.test(n) ? 'auf den ' + n : 'auf dem ' + n;
          const MO = await import('./mockups.js');
          const AR = await import('./artikel.js');
          const namen = [...new Set([...Object.values(MO.GARMENTS || {}).map(g => g.label),
            ...Object.values(AR.ARTIKEL).map(a => a.name)])].filter(Boolean);
          const soll = { 'Tasse': 'auf der Tasse', 'T-Shirt': 'auf dem T-Shirt', 'Brotdose': 'auf der Brotdose',
            'Socken': 'auf den Socken', 'Fußmatte': 'auf der Fußmatte', 'Hundedecke': 'auf der Hundedecke',
            'Zip-Jacke': 'auf der Zip-Jacke', 'Trinkflasche': 'auf der Trinkflasche', 'Handyhülle': 'auf der Handyhülle',
            'Schürze': 'auf der Schürze', 'Napfunterlage': 'auf der Napfunterlage',
            'Kissen': 'auf dem Kissen', 'Poster': 'auf dem Poster', 'Puzzle': 'auf dem Puzzle' };
          const falsch = Object.keys(soll).filter(n => auf(n) !== soll[n]);
          pruefe('jeder Artikelname bekommt seinen richtigen Artikel - nie wieder "auf dem Tasse"',
            falsch.length === 0, falsch.map(n => auf(n)).join(' · ') || namen.length + ' Namen geprueft');
        }
      }
    }

    const htmlStartseite = '<html><head><link rel="icon" href="/favicon.ico"></head><body>'
      + '<div class="logo-bar"><img src="/cdn/siegel_express.png" class="logo-bar__image"></div>'
      + '<header><a href="/" class="site-header__logo-image"><img class="lazyload" src="//x.de/cdn/DTF-200_abc_300x300.png" data-src="//x.de/cdn/DTF-200_abc_{width}x.png" alt="dtf-express GmbH"></a></header>'
      + '</body></html>';
    const rl = LH.logoKandidaten(htmlStartseite, 'https://www.dtf-express.de', 'DTF Express');
    pruefe('Logo-Suche: das Bild im Link auf die eigene Startseite gewinnt gegen die Siegelleiste, die "logo-bar" heisst',
      /DTF-200/.test(rl.kandidaten[0].url) && !/siegel/.test(rl.kandidaten[0].url), rl.kandidaten.slice(0, 2).map(k => k.punkte + ':' + k.url.split('/').pop()).join(' '));
    pruefe('Logo-Suche nimmt die grosse Fassung aus data-src ({width}) statt des kleinen Vorschaubilds',
      /_1200x\.png/.test(rl.kandidaten[0].url) && !rl.kandidaten.some(k => /\{width\}/.test(k.url)), rl.kandidaten[0].url);
    // Eine Seite, die sich erst im Browser aufbaut (ball-z.de): kein einziges <img> im Quelltext.
    const htmlJs = '<html><head><meta property="og:image" content="https://cdn.x/ballz-hero-abc.webp"></head><body><script>'
      + 'window.__DATA={"a":"https://cdn.x/ballz-logo-white-green-b_dd53735f.png","b":"https://cdn.x/ballz-hero-abc.webp"}'
      + '</script></body></html>';
    const rj = LH.logoKandidaten(htmlJs, 'https://www.ball-z.de', 'Ballz');
    pruefe('Logo-Suche findet das Logo auch, wenn die Seite sich erst per JavaScript aufbaut (kein <img> im Quelltext)',
      /ballz-logo/.test(rj.kandidaten[0].url) && !/hero/.test(rj.kandidaten[0].url), rj.kandidaten.map(k => k.punkte + ':' + k.url.split('/').pop()).join(' '));
    pruefe('eine Firmenseite ohne Logo liefert keinen Kandidaten - statt irgendein Bild zu nehmen',
      LH.logoKandidaten('<html><body><img src="/bilder/team-2024.jpg" class="feature-row__image"></body></html>', 'https://x.de', 'X').kandidaten.length === 0);

    // Schwarzer Kasten statt Transparenz - am echten Ball-z-Logo gemessen.
    const mitKasten = await sharp({ create: { width: 120, height: 60, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } })
      .composite([{ input: await sharp({ create: { width: 40, height: 20, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }).png().toBuffer(), left: 40, top: 20 }])
      .png().toBuffer();
    const frei = await LH.randFreistellen(mitKasten);
    const fst = await sharp(frei).stats();
    pruefe('ein Logo mit schwarzem Kasten statt Transparenz wird freigestellt (sonst klebt ein schwarzer Block auf der Karte)',
      fst.channels[3].min === 0 && fst.channels[3].max === 255, 'Alpha ' + fst.channels[3].min + '/' + fst.channels[3].max);
    const schonFrei = await sharp({ create: { width: 40, height: 20, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 0 } } }).png().toBuffer();
    pruefe('ein bereits freigestelltes Logo wird nicht angefasst', (await LH.randFreistellen(schonFrei)) === schonFrei);

    // Farben: fast gleiche zusammenfassen (Ball-z lieferte zweimal Weiss).
    const zf = FF.farbenKuerzen([{ r: 250, g: 251, b: 250 }, { r: 69, g: 233, b: 22 }, { r: 224, g: 224, b: 224 }]);
    pruefe('fast gleiche Firmenfarben werden zusammengefasst - sonst waere der Rand "weiss, gruen, weiss"',
      zf.length === 2 && zf[0] === '#FAFBFA' && zf[1] === '#45E916', zf.join(' '));
    pruefe('drei wirklich verschiedene Farben bleiben drei',
      FF.farbenKuerzen([{ r: 9, g: 10, b: 9 }, { r: 69, g: 156, b: 216 }, { r: 169, g: 67, b: 149 }]).length === 3);
    pruefe('im Eintrag gesetzte Farben gewinnen gegen die gemessenen (ein Mensch hat sie hingeschrieben)',
      (await FF.firmenFarben({ farben: ['#123456'] }, async () => [])).join() === '#123456');

    // 23. Sept.: Die Hausfarben werden nicht mehr nach FLAECHE sortiert. hausfarben() war seit
    // dem 22. Sept. da, aber firmenFarben() rief weiter farbenKuerzen auf - also war DTF Express
    // im Betrieb immer noch schwarz. Gemessen am echten DTF-Logo (Werte aus CLAUDE.md):
    {
      const dtfLogo = [
        { r: 9, g: 10, b: 9, share: 0.739 }, { r: 41, g: 171, b: 226, share: 0.072 },
        { r: 169, g: 67, b: 149, share: 0.040 }, { r: 226, g: 35, b: 38, share: 0.039 },
        { r: 255, g: 222, b: 23, share: 0.037 }, { r: 46, g: 49, b: 146, share: 0.025 },
        { r: 115, g: 169, b: 59, share: 0.020 }, { r: 191, g: 150, b: 44, share: 0.017 }
      ];
      const dtfSeite = [{ r: 0x95, g: 0xC1, b: 0x1F, n: 8 }, { r: 255, g: 255, b: 255, n: 22 }, { r: 0, g: 0, b: 0, n: 14 }];
      const nachFlaeche = FF.farbenKuerzen(dtfLogo);
      const hf = FF.hausfarben(dtfLogo, dtfSeite);
      pruefe('ein fast unbunter Ton fuehrt nie - sonst waere Schwarz (73,9 % der Flaeche) die Hausfarbe von DTF Express',
        nachFlaeche[0] === '#090A09' && hf[0] === '#95C11F', 'Flaeche ' + nachFlaeche[0] + ' -> Hausfarbe ' + hf[0]);
      pruefe('bei Ball-z und C.C.E. bleibt es bei der Farbe aus dem Logo - die Webseite wird gar nicht gebraucht',
        FF.hausfarben([{ r: 250, g: 251, b: 250, share: 0.45 }, { r: 69, g: 233, b: 22, share: 0.38 }], [])[0] === '#45E916'
        && FF.hausfarben([{ r: 9, g: 10, b: 9, share: 0.55 }, { r: 236, g: 162, b: 7, share: 0.268 }], [])[0] === '#ECA207');
      // Der eigentliche Fehler war die VERDRAHTUNG, nicht die Rechnung - also wird sie gemessen.
      const srv = await fs.readFile('server.js', 'utf8');
      pruefe('die Hausfarben laufen ueber EINE Stelle, und die kennt die Farben der Webseite',
        /return firmenFarben\(eintrag, dominantColors, STORE, s\);/.test(srv)
        && !/firmenFarben\(\w+, dominantColors, STORE\)/.test(srv)
        && /seitenFarben: r\.seitenFarben \|\| \[\]/.test(srv));
      const ff2 = await fs.readFile('firmen-freigabe.js', 'utf8');
      pruefe('firmenFarben rechnet mit hausfarben, nicht mehr mit farbenKuerzen',
        /return hausfarben\(await messen\(png\), seiteFarben \|\| \[\]\);/.test(ff2));
    }

  }

  //    Die Bild-KI baut den Rahmen, der Server setzt die echten Fotos ein - dann kann der Mensch
  //    nicht umgefaerbt, das Logo nicht neu geschrieben und kein Foto erfunden werden.
  {
    const sharpM = (await import('sharp')).default;
    const { platzhalterFelder } = await import('./images.js');
    const bau = (inhalt) => sharpM(Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#111"/>' + inhalt + '</svg>'
    )).png().toBuffer();

    // Ein grosses Feld links, zwei kleine rechts - dazu ein gruener Pinselstrich, der kein Feld ist.
    const drei = await bau(
      '<rect x="60" y="140" width="720" height="560" fill="#ff00e6"/>' +
      '<rect x="820" y="140" width="330" height="250" fill="#ff00e6"/>' +
      '<rect x="820" y="430" width="330" height="270" fill="#ff00e6"/>' +
      '<path d="M20 40 L300 30 L280 70 L10 80 Z" fill="#95C11F"/>');
    const r = await platzhalterFelder(drei, { hue: 306 });
    pruefe('drei leere Felder werden als drei Felder erkannt, der Pinselstrich nicht',
      r.gefunden && r.felder.length === 3, JSON.stringify(r.felder.map(f => f.width + 'x' + f.height)));
    pruefe('die Felder kommen von gross nach klein und stehen pixelgenau',
      r.felder[0].width === 720 && r.felder[0].height === 560 && r.felder[0].left === 60 && r.felder[0].top === 140,
      JSON.stringify(r.felder[0]));
    pruefe('ein sauberes Feld fuellt seinen Kasten ganz aus (so faellt ein Pinselstrich auf)',
      r.felder.every(f => f.fuellung > 0.95), JSON.stringify(r.felder.map(f => f.fuellung.toFixed(2))));

    // Spritzer in derselben Farbe sind KEIN Bildfeld - sonst landet ein Foto in einem Klecks.
    const mitSpritzer = await bau(
      '<rect x="60" y="140" width="720" height="560" fill="#ff00e6"/>' +
      '<circle cx="1100" cy="700" r="9" fill="#ff00e6"/>');
    const r2 = await platzhalterFelder(mitSpritzer, { hue: 306 });
    pruefe('ein kleiner Farbspritzer gilt nicht als Bildfeld', r2.felder.length === 1, JSON.stringify(r2.felder.length));

    // Ohne Platzhalter darf nichts gefunden werden - sonst wuerde in ein fertiges Bild gestanzt.
    const ohne = await bau('<rect x="100" y="100" width="400" height="300" fill="#45E916"/>');
    const r3 = await platzhalterFelder(ohne, { hue: 306 });
    pruefe('ohne Magenta findet der Server kein Feld', !r3.gefunden && r3.felder.length === 0);
  }

  // 7) Die feste Rueckkehr-Uhrzeit (Markus, 22. Sept.: "dass wir zumindest auf den Stand von
  //    8:00 Uhr morgens und einmal um 14:00 Uhr zurueckgehen koennen")
  {
    const { faelligerStand, zeitenAus, standName, schonGesichert, naechsteNummer, ZEITEN_STANDARD } = await import('./sicherung.js');
    const zeiten = ZEITEN_STANDARD;
    pruefe('Standard sind zwei feste Staende am Tag: 8 und 14 Uhr', JSON.stringify(zeiten) === '[8,14]', JSON.stringify(zeiten));
    pruefe('Uhrzeiten aus der Umgebung werden sortiert und entdoppelt', JSON.stringify(zeitenAus('14, 8 ,8,99,-1')) === '[8,14]', JSON.stringify(zeitenAus('14, 8 ,8,99,-1')));

    // Deutsche Zeit, nicht UTC: dieselbe Wanduhrzeit muss im Sommer wie im Winter greifen.
    const sommerVor = faelligerStand(new Date('2026-09-22T05:30:00Z'), { zeiten });   // 07:30 dt.
    const sommerNach = faelligerStand(new Date('2026-09-22T06:05:00Z'), { zeiten });  // 08:05 dt.
    const winterVor = faelligerStand(new Date('2026-12-15T06:30:00Z'), { zeiten });   // 07:30 dt.
    const winterNach = faelligerStand(new Date('2026-12-15T07:05:00Z'), { zeiten });  // 08:05 dt.
    pruefe('vor 8 Uhr deutscher Zeit ist kein Stand faellig - im Sommer wie im Winter',
      sommerVor === null && winterVor === null, JSON.stringify({ sommerVor, winterVor }));
    pruefe('ab 8 Uhr deutscher Zeit ist der 8-Uhr-Stand faellig - im Sommer wie im Winter',
      sommerNach && sommerNach.stunde === 8 && winterNach && winterNach.stunde === 8,
      JSON.stringify({ sommerNach, winterNach }));

    const mittag = faelligerStand(new Date('2026-09-22T12:00:00Z'), { zeiten });      // 14:00 dt.
    const kurzVor = faelligerStand(new Date('2026-09-22T11:59:00Z'), { zeiten });     // 13:59 dt.
    pruefe('um 14 Uhr loest der zweite Stand aus, eine Minute vorher noch nicht',
      mittag && mittag.stunde === 14 && kurzVor && kurzVor.stunde === 8, JSON.stringify({ mittag, kurzVor }));

    // Ein verpasster Stand wird nachgeholt, nicht ausgelassen (Server stand um 8 Uhr still).
    const spaet = faelligerStand(new Date('2026-09-22T07:40:00Z'), { zeiten });       // 09:40 dt.
    pruefe('ein verpasster Stand wird nachgeholt: um 9:40 gilt weiter der 8-Uhr-Stand',
      spaet && spaet.stunde === 8, JSON.stringify(spaet));

    // Jede Uhrzeit braucht ihren eigenen Namen - sonst ueberschreibt der Mittag den Morgen.
    const n8 = standName({ tag: '2026-09-22', stunde: 8 }, 43), n14 = standName({ tag: '2026-09-22', stunde: 14 }, 44);
    pruefe('Morgen- und Mittagsstand haben verschiedene Dateinamen',
      n8 !== n14 && n8.endsWith('-08.tar.gz') && n14.endsWith('-14.tar.gz'), n8 + ' / ' + n14);

    // Markus, 22. Sept.: "Die Rueckkehrpunkte sollten mit Datum und fortlaufender Nummer sein."
    pruefe('jeder Stand traegt laufende Nummer UND Datum im Namen',
      n8 === 'motto-otto-0043-2026-09-22-08.tar.gz' && n14 === 'motto-otto-0044-2026-09-22-14.tar.gz', n8 + ' / ' + n14);
    pruefe('die Nummer laeuft aus dem Protokoll weiter, auch ueber gescheiterte Laeufe hinweg',
      naechsteNummer([{ ok: true, nr: 41 }, { ok: false, nr: 42 }]) === 43, String(naechsteNummer([{ ok: true, nr: 41 }, { ok: false, nr: 42 }])));
    pruefe('ohne Protokoll faengt die Zaehlung bei 1 an', naechsteNummer([]) === 1 && naechsteNummer(null) === 1);
    pruefe('die Nummer steht vorn, damit die Staende in ihrer Reihenfolge liegen',
      [standName({ tag: '2026-09-23', stunde: 8 }, 9), standName({ tag: '2026-09-22', stunde: 8 }, 10)].sort()[0].includes('-0009-'));

    // Gezaehlt wird je Tag UND Uhrzeit, nicht je Tag - sonst bliebe es bei einem Stand taeglich.
    const log = [{ ok: true, tag: '2026-09-22', stunde: 8 }];
    pruefe('der 8-Uhr-Stand gilt als gesichert, der 14-Uhr-Stand desselben Tages noch nicht',
      schonGesichert(log, { tag: '2026-09-22', stunde: 8 }) && !schonGesichert(log, { tag: '2026-09-22', stunde: 14 }));
    pruefe('ein gescheiterter Lauf zaehlt nicht als gesichert',
      !schonGesichert([{ ok: false, tag: '2026-09-22', stunde: 14 }], { tag: '2026-09-22', stunde: 14 }));
  }
}
