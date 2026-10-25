#!/usr/bin/env python3
"""Baut die Seiten der Geschenke-Fee aus einer Quelle: index.html (Startseite) und je Feenwelt eine Unterseite.
Die Zuordnung Welt -> Anlass -> Artikel folgt Tammys Entwurf (geschenke-fee/entwurf-seite.html, 19. Okt. 2026).
Aufruf: python3 bauen.py   (schreibt index.html, vorschau-index.html und welt-*.html)"""
import html, json, os

HIER = os.path.dirname(os.path.abspath(__file__))

def icon(name, cls=''):
    s = open(os.path.join(HIER, 'icons', name + '.svg'), encoding='utf8').read().strip()
    return s.replace('<svg ', f'<svg aria-hidden="true" focusable="false" class="{cls}" ', 1)

# Tammys Feenwelten: Name, Anlass, Artikel (so steht es im Entwurf), dazu die Beispiele aus dem Material.
WELTEN = [
    dict(slug='sternenzauber', name='Sternenzauber', anlass='Weihnachten und Advent', zauber='schnee',
         liste='Decke, Kissen, Kalender, Kugel, Tasse',
         satz='Wenn es draußen still wird und drinnen die Lichter brennen. Hier entstehen Geschenke, die man auspackt und behält.',
         artikel=[('Kuscheldecke', 'ste-decke', '<q>Familie Müller, Weihnachten 2026</q> mit Fuchs im Winterwald'),
                  ('Kissen', 'ste-kissen', '<q>Emmas erstes Weihnachten</q> mit Elefant auf dem Mond'),
                  ('Wandkalender', 'ste-kalender', '<q>Familie Müller 2027</q>, gemalt beim Schneemannbauen'),
                  ('Weihnachtskugel', 'ste-kugel', '<q>Emma 2026</q> für den ersten eigenen Baum'),
                  ('Tasse', 'ste-tasse', '<q>Für Opa Klaus</q> mit seinem Fuchs')],
         wunsch='Unsere Emma feiert ihr erstes Weihnachten. Ein kleiner Elefant auf dem Mond, mit Mütze und Schnee.',
         wunsch_bild='ste-kissen', wunsch_alt='Kissen mit Elefant auf dem Mond und der Schrift Emmas erstes Weihnachten',
         beispiel='Für Opa Klaus, der jeden Morgen den Fuchs im Garten beobachtet. Am liebsten auf einer Tasse.'),
    dict(slug='wiegenwald', name='Wiegenwald', anlass='Geburt und Taufe', zauber='sterne',
         liste='Babybody, Decke, Kinderteller, Spardose',
         satz='Ein neuer Mensch ist da. Hier bringt der Storch Geschenke mit Namen, Datum und allem, was zu diesem kleinen Wunder gehört.',
         artikel=[('Babybody', 'wie-body', '<q>Lasse</q> mit Storch und Geburtsdatum'),
                  ('Babydecke', 'wie-decke', '<q>Emma</q> mit Elefant auf dem Mond'),
                  ('Kinderteller', 'wie-teller', '<q>Lasse</q> mit Storch und Wolken'),
                  ('Spardose', 'wie-spardose', '<q>Emma</q> mit Sternen in Rosa und Gold'),
                  ('Kissen', 'echt-kissen', '<q>Willkommen auf der Welt, Emma</q> mit Geburtsdaten'),
                  ('Poster', 'echt-poster', '<q>Willkommen auf der Welt, Emma</q> fürs Kinderzimmer')],
         wunsch='Für Lasse, geboren am 14. März. Ein Storch soll ihn zu uns bringen.',
         wunsch_bild='wie-body', wunsch_alt='Babybody mit Storch, dem Namen Lasse und dem Datum 14.03.2026',
         beispiel='Für Lasse, geboren am 14. März. Ein Storch soll ihn zu uns bringen.'),
    dict(slug='rosenhain', name='Rosenhain', anlass='Liebe, Hochzeit, Valentinstag', zauber='herzen',
         liste='Sternenkarte, Paar-Porträt, Acryl',
         satz='Zwei Namen, ein Datum, ein Himmel. Hier wird aus eurer Geschichte ein Geschenk, das an der Wand bleibt.',
         artikel=[('Sternenkarte', 'ros-sternenkarte', '<q>Lea & Jonas</q>, der Himmel über Hamburg am Hochzeitstag'),
                  ('Paar-Porträt', 'ros-portraet', 'Das Brautpaar unter dem Rosenbogen, gemalt'),
                  ('Acrylbild', 'ros-acryl', '<q>Lea & Jonas</q> mit Rosenherz und Ringen')],
         wunsch='Lea und Jonas heiraten im Juni. Rosen, zwei Ringe und ihr Datum.',
         wunsch_bild='ros-acryl', wunsch_alt='Acrylbild mit Rosenherz, zwei Ringen und den Namen Lea und Jonas',
         beispiel='Lea und Jonas heiraten am 12. Juni in Hamburg. Der Sternenhimmel von diesem Abend.'),
    dict(slug='bluetenlichtung', name='Blütenlichtung', anlass='Muttertag', zauber='blueten',
         liste='Kissen mit Kinderbild, Tasse, Windlicht',
         satz='Für die Frau, die alles zusammenhält. Hier werden Kinderbilder und liebe Worte zu Geschenken für Mama.',
         artikel=[('Kissen mit Kinderbild', 'blu-kissen', 'Die Zeichnung der Kinder, <q>Für Mama</q>'),
                  ('Tasse', 'blu-tasse', '<q>Mama, du bist unser Zuhause</q> mit Tulpen'),
                  ('Windlicht', 'blu-windlicht', '<q>Mia & Ben</q> im Blütenkranz')],
         wunsch='Mia und Ben haben Mama gemalt. Das Bild soll aufs Kissen.',
         wunsch_bild='blu-kissen', wunsch_alt='Leinenkissen mit Kinderzeichnung von Mama und zwei Kindern, Schrift Für Mama',
         beispiel='Mia und Ben haben Mama gemalt. Das Bild soll aufs Kissen.'),
    dict(slug='schultuetenwiese', name='Schultütenwiese', anlass='Einschulung und Kita', zauber='konfetti',
         liste='Brotdose, Trinkflasche, Turnbeutel',
         satz='Der erste Schultag kommt nur einmal. Hier bekommt alles, was mit in die Schule geht, den Namen und das Lieblingstier.',
         artikel=[('Brotdose', 'echt-brotdose', '<q>Mia 6</q> mit Fuchs'),
                  ('Trinkflasche', 'sch-flasche', '<q>Mia</q> mit Fuchs auf der Wiese'),
                  ('Turnbeutel', 'sch-turnbeutel', '<q>Mia, 1. Klasse</q> mit Schultüte'),
                  ('Sticker', 'echt-sticker', '<q>Mia 6</q> für Hefte und Stifte')],
         wunsch='Mia kommt in die Schule und liebt Füchse. Ihr Name soll groß drauf.',
         wunsch_bild='echt-brotdose', wunsch_alt='Brotdose mit Fuchs und der Schrift Mia 6',
         beispiel='Mia kommt in die Schule und liebt Füchse. Ihr Name soll groß drauf.'),
    dict(slug='pfotenreich', name='Pfotenreich', anlass='Haustiere', zauber='pfoten',
         liste='Tierporträt auf Poster, Tasse, Decke, Napfunterlage',
         satz='Sie gehören zur Familie. Hier wird euer Tier zum Kunstwerk, auf Wand, Tasse, Decke und Napf.',
         artikel=[('Tierporträt', 'pfo-poster', '<q>Nelli</q> als Gemälde'),
                  ('Tasse', 'pfo-tasse', '<q>Chefin im Haus</q> mit Nelli'),
                  ('Decke', 'echt-hundedecke', '<q>Nelli, Chefin im Haus</q>'),
                  ('Napfunterlage', 'echt-napfunterlage', '<q>Bello, Futterstation</q>')],
         wunsch='Unsere Nelli ist die Chefin im Haus. Bitte mit Bergen und Knochen.',
         wunsch_bild='echt-hundedecke', wunsch_alt='Hundedecke mit Australian Shepherd und der Schrift Nelli, Chefin im Haus',
         beispiel='Unsere Nelli ist ein Australian Shepherd mit einem blauen Auge. Sie ist die Chefin im Haus.'),
    dict(slug='kerzenfest', name='Kerzenfest', anlass='Geburtstag', zauber='konfetti', flammen=True,
         liste='Tasse, Shirt, Puzzle, Poster',
         satz='Ein Jahr älter, ein Grund mehr zu feiern. Hier wird aus Namen, Zahl und Insidern ein Geschenk für den großen Tag.',
         artikel=[('Tasse', 'ker-tasse', '<q>Steffi 40</q> mit Ballons'),
                  ('Shirt', 'ker-shirt', '<q>Steffi, Jahrgang 1986</q>'),
                  ('Puzzle', 'ker-puzzle', '<q>Omas 70.</q> mit der ganzen Familie'),
                  ('Poster', 'ker-poster', '<q>Alles Liebe zum 40., Steffi</q>')],
         wunsch='Steffi wird 40. Rosa, Gold und viele Ballons.',
         wunsch_bild='ker-poster', wunsch_alt='Gerahmtes Poster mit Torte, Ballons und der Schrift Alles Liebe zum 40., Steffi',
         beispiel='Oma wird 70. Die ganze Familie am Kaffeetisch, als Puzzle.'),
    dict(slug='dankesgarten', name='Dankesgarten', anlass='Lehrer, Erzieher, Ruhestand', zauber='blaetter',
         liste='Beutel, Keksglas, Kissen',
         satz='Danke sagen, wenn ein Abschnitt endet. Hier entstehen Geschenke, auf denen alle unterschreiben, die dazugehören.',
         artikel=[('Beutel', 'dan-beutel', '<q>Danke, Frau Krüger!</q> mit den Handabdrücken der Klasse'),
                  ('Keksglas', 'dan-keksglas', '<q>Für unsere Sabine</q>, gefüllt mit Keksen'),
                  ('Kissen', 'dan-kissen', '<q>Kita Sonnenschein 2026</q> mit allen Namen'),
                  ('Hoodie zum Ruhestand', 'echt-hoodie', '<q>Tischlerei Brandt</q>, nach vierzig Jahren Werkstatt')],
         wunsch='Unsere Erzieherin Sabine geht in Rente. Alle Kinder sollen mit drauf.',
         wunsch_bild='dan-kissen', wunsch_alt='Kissen mit Kinderzeichnungen, Namen und der Schrift Kita Sonnenschein 2026',
         beispiel='Frau Krüger verlässt unsere Klasse. Ein Beutel mit den Händen aller Kinder.'),
]

# Echte Beispielprodukte (640 x 480), alle anderen 800 x 800
def masse(datei):
    return (640, 480) if datei.startswith('echt-') else (800, 800)

FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' \
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Antonio:wght@500;600&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Great+Vibes&family=Quicksand:wght@400;500;600;700&display=swap">'

def kopf(aktiv='', start=False):
    pre = '' if start else './'
    return f'''<a class="sprung" href="#inhalt">Zum Inhalt</a>
<header class="kopf"><div class="rahmen kopf-innen">
  <a class="marke" href="./" aria-label="Geschenke-Fee, zur Startseite"><img class="marke-fee" src="bilder/fee-figur.webp" alt="" width="1500" height="1007"><span class="wortmarke" aria-hidden="true"><b>GESCHENKE</b><i>Fee</i></span></a>
  <nav class="navi" aria-label="Hauptmenü">
    <a class="link" href="{pre}#welten"{' aria-current="page"' if aktiv == 'welten' else ''}>Feenwelten</a>
    <a class="link" href="{pre}#zauber">So geht's</a>
    <a class="link" href="{pre}#geschenke">Geschenke</a>
    <a class="knopf klein" href="#wunsch">Wunsch erzählen</a>
    <button class="menue-knopf" type="button" aria-expanded="false" aria-controls="menue" aria-label="Menü">{icon('list')}</button>
  </nav>
</div>
<nav class="menue" id="menue" hidden aria-label="Menü">
  <a href="{pre}#welten">Feenwelten</a><a href="{pre}#zauber">So geht's</a><a href="{pre}#geschenke">Geschenke</a><a href="#wunsch">Wunsch erzählen</a>
</nav></header>
<canvas id="sternenstaub" aria-hidden="true"></canvas>'''

def katalog_json():
    k = {'welten': {w['slug']: w['name'] for w in WELTEN}, 'anlaesse': {w['slug']: w['anlass'] for w in WELTEN}, 'artikel': []}
    for w in WELTEN:
        for t, d, _b in w['artikel']:
            k['artikel'].append(dict(id=d, name=t, welt=w['slug'], w=masse(d)[0], h=masse(d)[1]))
    vorhanden = {a['id'] for a in k['artikel']}
    extra = {'echt-acrylbild': 'Acrylbild', 'echt-fussmatte': 'Fußmatte', 'echt-gepaeckanhaenger': 'Gepäckanhänger', 'echt-grillschuerze': 'Grillschürze',
             'echt-handtuch': 'Handtuch', 'echt-hoodie': 'Hoodie', 'echt-mousepad': 'Mousepad', 'echt-napfunterlage': 'Napfunterlage', 'echt-shopper': 'Shopper',
             'echt-sticker': 'Sticker', 'echt-strandtuch': 'Strandtuch', 'echt-tshirt': 'T-Shirt', 'echt-tuerschild': 'Türschild', 'echt-kissen': 'Kissen',
             'echt-brotdose': 'Brotdose', 'echt-hundedecke': 'Hundedecke', 'echt-poster': 'Poster'}
    for d, t in extra.items():
        if d not in vorhanden:
            k['artikel'].append(dict(id=d, name=t, welt='', w=masse(d)[0], h=masse(d)[1]))
    return json.dumps(k, ensure_ascii=False).replace('</', '<\\/')

def wunschkasten(titel, text, beispiel, vorwahl=''):
    return f'''<section class="abschnitt hauch" id="wunsch" aria-labelledby="wunsch-titel"><div class="rahmen wunschkasten">
  <div class="titel"><img class="zauberstab" src="bilder/zauberstab.webp" alt="" width="697" height="1055" loading="lazy"><h2 id="wunsch-titel">{titel}</h2><p>{text}</p></div>
  <form class="formular" data-wunsch novalidate>
    <label for="wunsch-feld">Dein Wunsch</label>
    <textarea id="wunsch-feld" name="wunsch" placeholder="Zum Beispiel: {html.escape(beispiel)}">{html.escape(vorwahl)}</textarea>
    <p class="hilfe">Name, Anlass, was diesen Menschen ausmacht und worauf es soll. Je mehr du erzählst, desto persönlicher wird es.</p>
    <div class="zeile">
      <button class="knopf zweit" type="button" data-mikro>{icon('microphone')}<span>Einsprechen</span></button>
      <button class="knopf" type="submit">Wunsch abschicken</button>
    </div>
    <p class="antwort" aria-live="polite"></p>
  </form>
  <div class="ergebnis" data-ergebnis hidden aria-live="polite"></div>
  <script type="application/json" id="katalog">{katalog_json()}</script>
</div></section>'''

def fuss():
    links = ''.join(f'<li><a href="welt-{w["slug"]}.html">{w["name"]}</a></li>' for w in WELTEN)
    return f'''<footer class="fuss"><div class="rahmen">
  <div class="fuss-innen">
    <div><img class="fuss-logo" src="bilder/logo-voll.webp" alt="Geschenke-Fee" width="1400" height="1048" loading="lazy"><p>Personalisierte Geschenke aus deinem Wunsch, gestaltet für jeden Artikel neu.</p></div>
    <ul class="fuss-welten" aria-label="Feenwelten">{links}</ul>
  </div>
  <p class="fuss-recht" id="impressum">Impressum und Datenschutz folgen, sobald der Shop online geht.</p>
</div></footer>'''

def tor(w, artikel=True, ueberschrift='h3'):
    zeile = f'<span class="tor-artikel">{w["liste"]}</span>' if artikel else ''
    return f'''<a class="tor" href="welt-{w["slug"]}.html">
  <span class="tor-bild"><img src="bilder/welten/{w["slug"]}-klein.webp" alt="" width="640" height="960" loading="lazy"></span>
  <span class="tor-name">{w["name"]}</span><span class="tor-anlass">{w["anlass"]}</span>{zeile}
</a>'''

def startseite():
    beispiele = [
        dict(knopf='Emma', wer='Wunsch für Emma', wunsch='Für unsere Emma, geboren am 8. September. Ein kleiner Elefant, der auf dem Mond schläft.',
             bild='bilder/artikel/echt-kissen.webp', alt='Kissen mit Elefant auf dem Mond und der Schrift Willkommen auf der Welt, Emma',
             was='Kissen aus dem <a href="welt-wiegenwald.html">Wiegenwald</a>'),
        dict(knopf='Mia', wer='Wunsch für Mia', wunsch='Mia kommt in die Schule und liebt Füchse. Ihr Name soll groß drauf.',
             bild='bilder/artikel/echt-brotdose.webp', alt='Brotdose mit Fuchs und der Schrift Mia 6',
             was='Brotdose von der <a href="welt-schultuetenwiese.html">Schultütenwiese</a>'),
        dict(knopf='Nelli', wer='Wunsch für Nelli', wunsch='Unsere Nelli ist die Chefin im Haus. Bitte mit Bergen und Knochen.',
             bild='bilder/artikel/echt-hundedecke.webp', alt='Hundedecke mit Australian Shepherd und der Schrift Nelli, Chefin im Haus',
             was='Decke aus dem <a href="welt-pfotenreich.html">Pfotenreich</a>'),
    ]
    b0 = beispiele[0]
    # Die Fee mit dem Zauberstab aus Tammys Logo (freigestellt); .stern sitzt auf dem grossen Stern des Stabs
    fee = '<div class="fee-figur" aria-hidden="true"><img src="bilder/fee-figur.webp" alt="" width="1500" height="1007" fetchpriority="high"><span class="stern"></span></div>'

    tore = '\n'.join(tor(w) for w in WELTEN)
    bento = [
        ('gross', 'echt-kissen', 'Kissen', 'wiegenwald', 'Kissen mit Elefant auf dem Mond, Willkommen auf der Welt, Emma'),
        ('', 'dan-keksglas', 'Keksglas', 'dankesgarten', 'Keksglas mit Blütenkranz, Für unsere Sabine'),
        ('', 'ste-decke', 'Kuscheldecke', 'sternenzauber', 'Kuscheldecke mit Fuchs im Winterwald, Familie Müller'),
        ('', 'ros-sternenkarte', 'Sternenkarte', 'rosenhain', 'Sternenkarte im Holzrahmen, Lea und Jonas'),
        ('', 'blu-tasse', 'Tasse', 'bluetenlichtung', 'Tasse mit Tulpen, Mama, du bist unser Zuhause'),
        ('breit', 'ker-puzzle', 'Puzzle', 'kerzenfest', 'Puzzle mit gezeichneter Familie am Geburtstagstisch, Omas 70.'),
        ('', 'echt-hundedecke', 'Decke', 'pfotenreich', 'Hundedecke mit Australian Shepherd, Nelli'),
        ('', 'echt-brotdose', 'Brotdose', 'schultuetenwiese', 'Brotdose mit Fuchs, Mia 6'),
    ]
    namen = {w['slug']: w['name'] for w in WELTEN}
    kacheln = '\n'.join(
        f'''<a class="kachel {k}" href="welt-{s}.html"><span class="bild"><img src="bilder/artikel/{d}.webp" alt="{html.escape(alt)}" width="{masse(d)[0]}" height="{masse(d)[1]}" loading="lazy"{' style="object-position:50% 14%"' if k == 'breit' else ''}></span><span class="unter"><b>{t}</b><span>{namen[s]}</span></span></a>'''
        for k, d, t, s, alt in bento)
    knoepfe = ''.join(f'<button type="button" aria-pressed="{"true" if i == 0 else "false"}">{b["knopf"]}</button>' for i, b in enumerate(beispiele))

    return f'''<title>Geschenke-Fee</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Erzähl der Geschenke-Fee deinen Wunsch. Sie zaubert daraus ein Motiv, das es nur einmal gibt, auf Kissen, Decke, Tasse und mehr.">
{FONTS}
<link rel="stylesheet" href="fee.css">
{kopf(start=True)}
<main id="inhalt">
<section class="hero" aria-labelledby="hero-titel"><div class="rahmen hero-innen">
  <div class="hero-text">
    <h1 id="hero-titel">Ein Wunsch genügt.</h1>
    <p>Erzähl der Fee, für wen es ist. Sie zaubert daraus ein Motiv, das es nur einmal gibt.</p>
    <div class="knoepfe"><a class="knopf" href="#wunsch">Wunsch erzählen</a><a class="knopf zweit" href="#welten">Feenwelten ansehen</a></div>
  </div>
  <div class="buehne" data-buehne>
    <script type="application/json">{json.dumps(beispiele, ensure_ascii=False)}</script>
    {fee}
    <div class="funken-ebene" aria-hidden="true"></div>
    <figure class="buehne-karte" aria-label="Beispiel: aus einem Wunsch wird ein Geschenk">
      <blockquote class="wunsch"><span class="wer">{b0['wer']}</span><span class="wunsch-text">{b0['wunsch']}</span></blockquote>
      <div class="geschenk"><img src="{b0['bild']}" alt="{html.escape(b0['alt'])}" width="640" height="480"></div>
      <figcaption class="buehne-fuss"><span class="was">{b0['was']}</span><span class="beispiele" role="group" aria-label="Beispiele">{knoepfe}</span></figcaption>
    </figure>
  </div>
</div></section>

<section class="abschnitt" id="welten" aria-labelledby="welten-titel"><div class="rahmen">
  <div class="titel"><h2 id="welten-titel">Acht Feenwelten</h2><p>Jede Welt gehört zu einem Anlass. Tipp sie an, dort warten die Geschenke, die dazu passen.</p></div>
  <div class="tore">
{tore}
  </div>
</div></section>

<section class="abschnitt hauch" id="zauber" aria-labelledby="zauber-titel"><div class="rahmen">
  <div class="titel"><h2 id="zauber-titel">So zaubert die Fee</h2><p>Vom ersten Satz bis zum fertigen Geschenk. Das Beispiel: Lasse, geboren am 14. März.</p></div>
  <div class="ablauf">
    <svg class="spur" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true"><path d="M60 70 C 260 0, 360 130, 600 64 S 940 -6, 1140 66"/><path class="zeichnen" d="M60 70 C 260 0, 360 130, 600 64 S 940 -6, 1140 66"/></svg>
    <div class="station">
      <div class="station-bild station-wunsch">
        <span class="mikro"><span class="kreis">{icon('microphone')}</span>Eingesprochen</span>
        <blockquote>„Für Lasse, geboren am 14. März. Ein Storch soll ihn zu uns bringen.“</blockquote>
      </div>
      <h3><span class="nr" aria-hidden="true">1</span>Erzählen</h3>
      <p>Sprich oder tipp deinen Wunsch: wer, welcher Anlass, was diesen Menschen ausmacht.</p>
    </div>
    <div class="station">
      <div class="station-bild"><img src="bilder/motive/storch-lasse.webp" alt="Motiv: Storch mit Bündel, darunter Lasse und 14.03.2026" width="800" height="800" loading="lazy"></div>
      <h3><span class="nr" aria-hidden="true">2</span>Zaubern</h3>
      <p>Die Fee malt daraus ein eigenes Motiv. Du siehst es, bevor etwas gedruckt wird.</p>
    </div>
    <div class="station">
      <div class="station-paar"><div class="station-bild"><img src="bilder/artikel/wie-body.webp" alt="Babybody mit dem Storch-Motiv für Lasse" width="800" height="800" loading="lazy"></div><img class="klein" src="bilder/artikel/wie-teller.webp" alt="Kinderteller mit Storch und dem Namen Lasse" width="800" height="800" loading="lazy"></div>
      <h3><span class="nr" aria-hidden="true">3</span>Verschenken</h3>
      <p>Das Motiv kommt aufs Geschenk, für jeden Artikel neu angeordnet.</p>
    </div>
  </div>
</div></section>

<section class="abschnitt" id="geschenke" aria-labelledby="geschenke-titel"><div class="rahmen">
  <div class="titel"><h2 id="geschenke-titel">Aus jeder Welt ein Lieblingsstück</h2><p>So sehen Wünsche aus, wenn sie fertig sind. Jedes Stück führt in seine Feenwelt.</p></div>
  <div class="bento">
{kacheln}
  </div>
</div></section>

{wunschkasten('Was soll die Fee für dich zaubern?', 'Erzähl, für wen es ist und worauf es soll. Du kannst tippen oder einsprechen.', 'Für Opa Klaus, der jeden Morgen den Fuchs im Garten beobachtet. Am liebsten auf einer Tasse.')}
</main>
{fuss()}
<script src="fee.js" defer></script>
'''

def weltseite(i):
    w = WELTEN[i]
    nach = WELTEN[(i + 1) % len(WELTEN)]
    regal = '\n'.join(
        f'''<article class="artikel"><div class="bild"><img src="bilder/artikel/{d}.webp" alt="{html.escape(t)}: {html.escape(b.replace('<q>', '').replace('</q>', ''))}" width="{masse(d)[0]}" height="{masse(d)[1]}" loading="lazy"></div><h3>{t}</h3><p>Beispiel: {b.replace('&', '&amp;')}</p></article>'''
        for t, d, b in w['artikel'])
    flammen = ''
    if w.get('flammen'):
        pos = [(41.5, 21.6), (45.2, 21.2), (49.6, 20.4), (53.9, 21.2), (57.8, 22.0)]
        flammen = '<div class="flammen" aria-hidden="true">' + ''.join(f'<span class="flamme" style="left:{x}%;top:{y * 1.2:.1f}%;animation-delay:{k * .23:.2f}s"></span>' for k, (x, y) in enumerate(pos)) + '</div>'
    mond = '<span class="mondlicht" aria-hidden="true"></span>' if w['slug'] == 'wiegenwald' else ''
    aktuell = ' aria-current="page"'
    liste = ''.join(f'<li><a href="welt-{x["slug"]}.html"{aktuell if x is w else ""}>{x["name"]}</a></li>' for x in WELTEN)
    return f'''<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{w['name']} | Geschenke-Fee</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="{w['name']}: Geschenke für {w['anlass']}, gestaltet aus deinem Wunsch von der Geschenke-Fee.">
{FONTS}
<link rel="stylesheet" href="fee.css">
<style>:root{{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}[hidden]{{display:none!important}}</style>
</head>
<body class="welt welt-{w['slug']}">
{kopf('welten')}
<main id="inhalt">
<section class="welt-hero" aria-labelledby="welt-titel"><div class="rahmen welt-innen">
  <div class="welt-text">
    <a class="zurueck" href="./#welten">{icon('arrow-left')}Alle Feenwelten</a>
    <h1 class="welt-name" id="welt-titel" style="--n:{len(w['name'])}">{w['name']}</h1>
    <p class="welt-anlass">{w['anlass']}</p>
    <p class="welt-satz">{w['satz']}</p>
    <div class="knoepfe"><a class="knopf" href="#wunsch">Wunsch erzählen</a><a class="knopf zweit" href="#geschenke">Geschenke ansehen</a></div>
  </div>
  <div class="welt-bild"><div class="diorama" data-zauber="{w['zauber']}"><img src="bilder/welten/{w['slug']}.webp" alt="Papierwelt {w['name']}" width="1024" height="1536" fetchpriority="high">{mond}{flammen}</div></div>
</div></section>

<section class="abschnitt" id="geschenke" aria-labelledby="geschenke-titel"><div class="rahmen">
  <div class="titel"><h2 id="geschenke-titel">Was die Fee hier zaubert</h2><p>{w['liste']}. Jedes Stück bekommt sein eigenes Motiv aus deinem Wunsch.</p></div>
  <div class="regal" data-anzahl="{len(w['artikel'])}">
{regal}
  </div>
</div></section>

<section class="abschnitt hauch" aria-labelledby="stimme-titel"><div class="rahmen stimme">
  <div><h2 class="unsichtbar" id="stimme-titel">Ein Wunsch aus dieser Welt</h2><blockquote>{w['wunsch']}</blockquote><p class="hinweis">Aus diesem Satz wurde das Geschenk daneben.</p></div>
  <figure><img src="bilder/artikel/{w['wunsch_bild']}.webp" alt="{html.escape(w['wunsch_alt'])}" width="{masse(w['wunsch_bild'])[0]}" height="{masse(w['wunsch_bild'])[1]}" loading="lazy"></figure>
</div></section>

{wunschkasten(f'Dein Wunsch für {w["anlass"].split(",")[0]}', 'Erzähl der Fee, für wen es ist und was diesen Menschen ausmacht. Du kannst tippen oder einsprechen.', w['beispiel'])}

<section class="abschnitt" aria-labelledby="weiter-titel"><div class="rahmen weiter">
  {tor(nach, artikel=False)}
  <div class="titel"><h2 id="weiter-titel">Weiter zur nächsten Welt</h2><p>{nach['name']}: Geschenke für {nach['anlass']}.</p>
    <ul class="welten-liste" aria-label="Alle Feenwelten">{liste}</ul>
  </div>
</div></section>
</main>
{fuss()}
<script src="fee.js" defer></script>
</body>
</html>
'''

if __name__ == '__main__':
    s = startseite()
    open(os.path.join(HIER, 'index.html'), 'w', encoding='utf8').write(s)
    # Fuer den Blick im eigenen Browser: dieselbe Seite mit dem Geruest, das der Veroeffentlicher drumlegt
    open(os.path.join(HIER, 'vorschau-index.html'), 'w', encoding='utf8').write(
        '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
        '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>'
        + s + '</body></html>')
    for i, w in enumerate(WELTEN):
        open(os.path.join(HIER, f'welt-{w["slug"]}.html'), 'w', encoding='utf8').write(weltseite(i))
    print('gebaut:', 1 + len(WELTEN), 'Seiten')
