// Rechtstexte: Impressum, Datenschutz, Nutzungsbedingungen, Widerruf. Firmendaten lassen sich
// weiterhin ueber Umgebungsvariablen (IMPRESSUM_* in Railway) ueberschreiben.
// Fassung 66 (Markus, 16. Sept.): Die Angaben des Betreibers sind hier fest hinterlegt, wie sie
// auf ball-z.de stehen - so sind Impressum und Datenschutz auch ohne gesetzte Variablen vollstaendig.
// 20. Sept.: die Huelle der Textseiten auch fuer andere schlichte Seiten (Event) - dieselbe
// Kopfzeile, dieselbe Fusszeile, derselbe Widerruf-Knopf.
export function seitenHuelle(title, body) {
  return legalPages({}).shell(title, body);
}

export function legalPages(env) {
  const firma = env.IMPRESSUM_FIRMA || 'RASANDO International GmbH';
  const anschrift = env.IMPRESSUM_ANSCHRIFT || 'Elbuferstraße 134, 21436 Marschacht, Deutschland';
  const vertreter = env.IMPRESSUM_VERTRETER || 'Denis Zühlke und Michael Oenning (Geschäftsführer)';
  // Fassung 67 (Markus, 16. Sept.): Kontakt fuer Motto Otto ist otto@motto-otto.de, nicht die
  // Adresse der Schwesterseite - die Firmendaten dahinter bleiben dieselben.
  const mail = env.IMPRESSUM_MAIL || 'otto@motto-otto.de';
  const telefon = env.IMPRESSUM_TELEFON || '+49 4176 949 80 62';
  const ustid = env.IMPRESSUM_USTID || 'DE 308510303';
  const register = env.IMPRESSUM_REGISTER || 'Amtsgericht Lüneburg';
  const aufsicht = env.DATENSCHUTZ_AUFSICHT || 'Die Niedersächsische Landesbeauftragte für den Datenschutz, Prinzenstraße 5, 30159 Hannover, Telefon +49 511 120-4500, poststelle@lfd.niedersachsen.de';

  const shell = (title, body) => `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} – Motto Otto</title>
<link rel="preload" href="/fonts/archivo-v1.woff2" as="font" type="font/woff2" crossorigin><style>@font-face{font-family:"Archivo";src:url("/fonts/archivo-v1.woff2") format("woff2");font-weight:400 900;font-style:normal;font-display:swap}</style><link rel="icon" href="/favicon-64.png" type="image/png"><link rel="apple-touch-icon" href="/apple-touch-icon.png">
<!-- 1. Okt.: gemeinsames Farbblatt aller Kundenseiten (Logo-Farben, Schriften, Kopf) --><link rel="preload" href="/fonts/anton-v1.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/marke.css"><style>:root{--bg:#14131a;--card:#1d1c25;--card2:#26242f;--ink:#f4f2f7;--ink2:#b6b1c2;--ink3:#8b8598;--line:#35323f;--accent:#ffc542}body{margin:0;background:var(--bg);color:var(--ink);font-family:"Archivo",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;font-size:16px;line-height:1.6}.wrap{max-width:760px;margin:0 auto;padding:30px 20px 80px}a{color:var(--beere)}h1{font-size:44px}h2{font-size:28px;margin-top:32px}p,li{color:var(--text2)}footer.site{margin:44px 0 0;color:var(--ink3);font-size:13px;border-top:1px solid var(--line);padding-top:18px;line-height:1.6}footer.site a{color:inherit}
.box{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin:18px 0}
.box h2{margin-top:0}
label{display:block;font-size:13px;font-weight:700;color:var(--ink2);margin:14px 0 6px}
input,textarea,select{width:100%;box-sizing:border-box;background:#14131a;border:1px solid var(--line);border-radius:10px;color:var(--ink);font:inherit;font-size:15px;padding:11px 12px}
textarea{min-height:90px;resize:vertical}
button.knopf{margin-top:18px;background:var(--accent);color:#1a1712;border:0;border-radius:999px;font:inherit;font-weight:800;font-size:16px;padding:13px 26px;cursor:pointer}
button.knopf:disabled{opacity:.55;cursor:default}
.hinweis{font-size:13px;color:var(--ink3);margin-top:8px}
.melde{margin-top:14px;padding:12px 14px;border-radius:10px;display:none}
.melde.ok{display:block;background:#17301f;border:1px solid #2e6b41;color:#c9f0d6}
.melde.fehler{display:block;background:#33191c;border:1px solid #7b3239;color:#f3c9cd}
/* Fassung 73: der Widerruf gehoert sichtbar auf jede Seite, nicht als kleiner Link in der Fusszeile */
.wruf-zeile{margin:16px 0 6px;text-align:center}
.wruf{display:inline-block;background:#ffc542;color:#1a1712;border:2px solid #ffc542;border-radius:999px;font-weight:800;font-size:15px;line-height:1.2;padding:12px 26px;text-decoration:none;box-shadow:0 2px 10px rgba(255,197,66,.25)}
.wruf:hover,.wruf:focus{background:#ffd775;border-color:#ffd775;text-decoration:none;outline:none}
/* 1. Okt.: Rechtstexte und Event in den Logo-Farben (marke.css) */
.mo-seite .box{background:#fff;border:var(--kontur);border-radius:14px}
.mo-seite label{color:var(--tinte);font-size:15px;font-weight:800}
.mo-seite button.knopf{background:var(--gruen);color:var(--tinte);border:var(--kontur);box-shadow:var(--stempel)}
.mo-seite .hinweis{color:var(--text3)}
.mo-seite .melde.ok{background:#E8F5D6;border:2px solid var(--ok-text);color:var(--tinte)}
.mo-seite .melde.fehler{background:#FDECEA;border:2px solid var(--warn-text);color:var(--tinte)}
.mo-seite footer.site{border-top:var(--kontur)}</style></head>
<body class="mo-seite"><header class="mo-kopf"><div class="mo-in">
  <a class="mo-marke" href="/"><img src="/logo.png" alt="" width="36" height="42">Motto Otto</a>
  <nav class="mo-nav" aria-label="Hauptmenü">
    <a href="/mottos">Mottos</a>
    <a href="/so-gehts">So geht’s</a>
    <a href="/firma">Firmen</a>
    <a href="/partner">Partner</a>
    <a href="/event">Event</a>
  </nav>
  <a class="mo-knopf hell mo-konto" href="/konto">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8.5" r="4"/><path d="M4 21c1.4-4 4.4-6 8-6s6.6 2 8 6"/></svg>
    Konto
  </a>
</div></header><div class="wrap">${body}<footer class="site">Motto Otto · Jedes Produkt wird auf Bestellung gefertigt und in Deutschland veredelt. · <a href="/impressum">Impressum</a> · <a href="/datenschutz">Datenschutz</a> · <a href="/agb">AGB</a></footer><div class="wruf-zeile"><a class="wruf" href="/widerruf">Vertrag widerrufen oder kündigen</a></div></div></body></html>`;

  const impressum = shell('Impressum', `
<h1>Impressum</h1>
<h2>Angaben gemäß § 5 DDG</h2>
<p><b>${firma}</b><br>${anschrift.split(',').map(s => s.trim()).join('<br>')}</p>
<p>Telefon: ${telefon}<br>E-Mail: <a href="mailto:${mail}">${mail}</a></p>
<h2>Geschäftsführung</h2>
<p>${vertreter}</p>
<h2>Registereintrag und Steuern</h2>
<p>Handelsregister: ${register}${ustid ? `<br>Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: ${ustid}` : ''}</p>
<p>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV: ${vertreter}, ${anschrift}</p>
<p>Motto Otto ist ein Angebot der ${firma}.</p>
<h2>Streitbeilegung</h2>
<p>Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: <a href="https://ec.europa.eu/consumers/odr/" rel="noopener">https://ec.europa.eu/consumers/odr/</a>. Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>`);

  const datenschutz = shell('Datenschutzerklärung', `
<h1>Datenschutzerklärung</h1>
<p>Verantwortlicher im Sinne der DSGVO ist:</p>
<p><b>${firma}</b><br>${anschrift.split(',').map(s => s.trim()).join('<br>')}<br>Telefon: ${telefon}<br>E-Mail: <a href="mailto:${mail}">${mail}</a><br>Geschäftsführung: ${vertreter}<br>Handelsregister: ${register}<br>Umsatzsteuer-ID: ${ustid}</p>
<h2>1. Was Motto Otto tut</h2>
<p>Motto Otto erstellt aus deinen Eingaben (Motto, Namen, Anlass, Farben, optional ein hochgeladenes Logo oder Foto) Design-Vorschläge für Textilien. Dafür werden deine Eingaben an einen KI-Bilddienst übermittelt und die fertigen Druckdateien gespeichert.</p>
<h2>2. Welche Daten wir verarbeiten</h2>
<ul>
<li><b>Eingaben im Konfigurator</b> (Texte, Namen, Farben, Stil) und <b>Uploads</b> (Logos, Fotos). Rechtsgrundlage: Vertragserfüllung bzw. Vertragsanbahnung, Art. 6 Abs. 1 lit. b DSGVO. Für Fotos, auf denen Personen zu sehen sind, gilt zusätzlich Abschnitt 4.</li>
<li><b>Erzeugte Designs und Druckdateien</b>, verknüpft mit einer zufälligen Design-Nummer und – falls du dich anmeldest – mit deinem Konto.</li>
<li><b>Konto</b>: E-Mail-Adresse, Anmeldezeitpunkt, Zähler für erstellte Designs und gebuchte Kontingente. Anmeldung erfolgt per E-Mail-Link ohne Passwort.</li>
<li><b>Technische Daten</b>: IP-Adresse, Zeitpunkt, Browser – in Server-Protokollen unseres Hosters, zur Sicherstellung des Betriebs (Art. 6 Abs. 1 lit. f DSGVO).</li>
<li><b>Cookies</b>: ein technisch notwendiges Gast-Cookie (ordnet deine Entwürfe deinem Browser zu) und nach Anmeldung ein Sitzungs-Cookie. Keine Werbe- oder Tracking-Cookies.</li>
<li><b>Abstimmung über Designs</b>: Lädt das Orga-Team eine Teilnehmerliste hoch, verarbeiten wir <b>Namen sowie – sofern angegeben – E-Mail-Adressen und Handynummern</b> der Teilnehmer ausschließlich, um Einladungs-, Erinnerungs- und Ergebnis-Nachrichten zu einer Abstimmung zu versenden (Art. 6 Abs. 1 lit. f DSGVO; das Orga-Team bestätigt beim Upload das Einverständnis der Personen). Diese Kontaktdaten fließen nie in ein Design, nie in einen KI-Prompt und nie in die Druckdaten-Ablage. Abstimmungen und die zugehörigen Teilnehmerdaten werden spätestens <b>90 Tage nach Ende der Abstimmung</b> automatisch gelöscht.</li>
</ul>
<h2>3. Empfänger und Auftragsverarbeiter</h2>
<ul>
<li><b>Hosting</b>: Railway Corp., USA (Server-Region EU-West). Auftragsverarbeitung mit Standardvertragsklauseln.</li>
<li><b>KI-Bilderzeugung und Textprüfung</b>: OpenAI, L.L.C., USA. Übermittelt werden die Eingaben des Konfigurators und ggf. das hochgeladene Bild. Daten werden dort nicht zum Training verwendet (API-Nutzung).</li>
<li><b>Recherche zu Mottos</b>: Abfragen bei der Wikipedia-API der Wikimedia Foundation (nur der Motto-Begriff, keine personenbezogenen Daten).</li>
<li><b>Druckdateien-Ablage</b>: Google Drive (Google Ireland Ltd.) zur Übergabe an die Produktion.</li>
<li><b>E-Mail-Versand</b> (Anmelde-Links): Brevo (Sendinblue SAS, Frankreich).</li>
<li><b>Bezahlung</b>: Stripe Payments Europe Ltd., Irland. Zahlungsdaten werden ausschließlich bei Stripe verarbeitet; wir erhalten keine Kartendaten.</li>
</ul>
<h2>4. Fotos von Personen – wir speichern sie nicht</h2>
<p>Wenn du ein Foto hochlädst, auf dem Personen zu sehen sind, behandeln wir es anders als alle übrigen Daten:</p>
<ul>
<li>Das Foto wird <b>nur im Arbeitsspeicher</b> unseres Servers gehalten. Es wird zu keinem Zeitpunkt auf eine Festplatte, in unser Dateiablage-Volume oder in eine Cloud-Ablage geschrieben.</li>
<li>Nachdem dein Design fertig ist, fragen wir dich, ob es dir gefällt. <b>Sobald du bestätigst, wird dein Originalfoto sofort gelöscht.</b> Wir bauen davor die Druckdatei fertig – danach hat das Foto bei uns keinen Zweck mehr.</li>
<li>Antwortest du nicht, wird das Foto <b>spätestens nach einer Stunde automatisch gelöscht</b>. Bei jedem Neustart unseres Dienstes ist es ebenfalls weg.</li>
<li>Was bleibt, ist dein <b>fertiges Design</b>. Darin ist das Foto enthalten – sonst könnten wir es nicht drucken. Für dieses Design gilt die Speicherdauer aus Abschnitt 5.</li>
<li>Wählst du „im gewählten Stil nachzeichnen“, wird das Foto einmalig an unseren KI-Bilddienst übermittelt (siehe Abschnitt 3). Auch dort wird es nicht zum Training verwendet. Möchtest du das nicht, wähle „mein Foto so einsetzen“ – dann verlässt das Foto unseren Server nicht.</li>
<li>Du sicherst beim Hochladen zu, dass du die Rechte am Foto hast und alle abgebildeten Personen mit der Verwendung einverstanden sind. Diese Zusicherung speichern wir zusammen mit dem Auftrag.</li>
</ul>
<h2>5. Speicherdauer</h2>
<p>Uploads und Druckdateien bewahren wir auf, solange sie für Bestellung, Produktion und Nachbestellungen benötigt werden, längstens jedoch drei Jahre nach dem letzten Zugriff. Konten kannst du jederzeit per E-Mail löschen lassen. Server-Protokolle werden nach 30 Tagen gelöscht.</p>
<h2>6. Deine Rechte</h2>
<p>Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch (Art. 15–21 DSGVO). Schreib uns an <a href="mailto:${mail}">${mail}</a> oder rufe an unter ${telefon}.</p>
<p>Du hast außerdem das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren. Für uns zuständig ist: ${aufsicht}</p>
<h2>7. Hochgeladene Bilder</h2>
<p>Lade nur Logos und Fotos hoch, an denen du die nötigen Rechte hast. Für Fotos mit Personen gilt Abschnitt 4: das Original wird nicht gespeichert und nicht veröffentlicht.</p>
<p style="color:#8b8598;font-size:13px">Stand: September 2026</p>`);

  // Fassung 75 (Markus, 17. Sept.: "die AGBs hast du gestern nicht eingesetzt"): Die Allgemeinen
  // Geschaeftsbedingungen von ball-z.de sind uebernommen und auf Motto Otto zugeschnitten - dieselbe
  // Firma, dieselben Grundsaetze (Vorkasse bei Anfertigung, Stornofrist, Mustergebuehr,
  // Gerichtsstand Lueneburg), erweitert um das, was es nur hier gibt: erzeugte Designs,
  // Kontingente, Mitgliedschaft und die Rechte am Design.
  const agb = shell('Allgemeine Geschäftsbedingungen', `
<h1>Allgemeine Geschäftsbedingungen (AGB)</h1>
<h2>1. Geltungsbereich und Vertragspartner</h2>
<p>Diese Allgemeinen Geschäftsbedingungen gelten für alle Bestellungen und Leistungen von Motto Otto. Mit der Bestellung erkennst du diese AGB an.</p>
<p><b>Vertragspartner:</b><br>${firma}<br>${anschrift.split(',').map(s => s.trim()).join('<br>')}<br>Telefon: ${telefon}<br>E-Mail: <a href="mailto:${mail}">${mail}</a></p>
<h2>2. Leistung</h2>
<p>Motto Otto erzeugt auf Basis deiner Eingaben Design-Vorschläge und Druckdateien für Textilien und andere Artikel und veredelt diese auf Wunsch. Die Vorschau ist ein Mockup; Farben und Größen auf dem echten Textil können leicht abweichen. Bildschirmfarben und Druckfarben lassen sich nicht vollständig zur Deckung bringen.</p>
<h2>3. Kontingente, Mitgliedschaft und Preise</h2>
<p>Ein erstes Design kann ohne Konto erstellt werden. Die ersten fünf Designs je Konto sind darüber hinaus kostenfrei. Eine Mitgliedschaft umfasst ein monatliches Kontingent an Designs: 100 Designs im Monat für 29 € inkl. USt. oder 400 Designs im Monat für 49 € inkl. USt. Mitgliedschaften sind monatlich kündbar und verlängern sich automatisch um einen Monat, sofern nicht vor Ablauf gekündigt wird. Nicht genutzte Designs verfallen am Monatsende. Es gelten die Preise, die im Bestellvorgang ausgewiesen sind.</p>
<p><b>Was die Mitgliedschaft umfasst:</b> Sie berechtigt dazu, Designs zu <b>entwerfen</b> – also im Konfigurator erzeugen, ansehen, verwerfen und neu erzeugen zu lassen. Sie berechtigt nicht dazu, ein Design zu <b>verwenden</b>. Dafür gilt Abschnitt 4.</p>
<h2>4. Rechte an den Designs</h2>
<p>Bis zur vollständigen Bezahlung eines Designs bleiben alle Rechte daran bei uns. Du kannst das Design in deinem Konto ansehen; die Vorschau trägt einen Wasserzeichen-Hinweis, und die Druckdatei wird nicht herausgegeben.</p>
<p><b>Mit der vollständigen Bezahlung</b> des jeweiligen Designs erhältst du daran ein einfaches, zeitlich und räumlich unbegrenztes Nutzungsrecht: Textildruck, eigene Zwecke und die Verwendung für dein Team, deinen Verein oder deinen Betrieb. Vorher ist jede Verwendung, Weitergabe, Veröffentlichung oder Vervielfältigung des Designs unzulässig – auch dann, wenn es im Rahmen einer Mitgliedschaft entstanden ist.</p>
<p>Die Preise für die Nutzung eines Designs werden gesondert ausgewiesen und im Bestellvorgang angezeigt.</p>
<p>Von dir hochgeladene Logos und Bilder bleiben dein Eigentum; du versicherst, die nötigen Rechte daran zu haben.</p>
<h2>5. Unzulässige Inhalte</h2>
<p>Unzulässig sind Eingaben und Uploads, die Rechte Dritter verletzen, beleidigend, volksverhetzend oder sonst rechtswidrig sind. Solche Aufträge können ohne Erstattung abgebrochen werden.</p>
<h2>6. Fan-Designs (Lieblingsverein)</h2>
<p>Beim Motto „Lieblingsverein“ entstehen ausschließlich inoffizielle, eigenständige Fan-Designs. Es werden keine offiziellen Vereinswappen, Logos, Maskottchen, Sponsoren- oder Ligalogos und keine geschützten Wortmarken verwendet oder nachgeahmt; die Gestaltung greift nur frei verwendbare Angaben wie Stadt und Vereinsfarben sowie allgemeine Fan-Motive auf. Es besteht keine Verbindung zu den genannten Vereinen und kein Lizenz- oder Sponsoringverhältnis.</p>
<h2>7. Bestellung, Freigabe und Produktion</h2>
<p><b>Designfreigabe:</b> Vor der Produktion gibst du dein Design frei. Damit bestätigst du Motiv, Texte, Schreibweise der Namen, Größen und Platzierung. Änderungen nach der Freigabe sind nur möglich, solange die Produktion noch nicht begonnen hat; sie können zu Verzögerungen und Zusatzkosten führen.</p>
<p><b>Muster:</b> Ein Muster ist gegen Gebühr möglich. Die Mustergebühr wird bei einer anschließenden Bestellung zu mindestens 50 Prozent angerechnet. Ohne Bestellung verfällt der Anspruch auf Anrechnung.</p>
<p><b>Stornierung:</b> Bestellungen kannst du bis 48 Stunden nach der Bestellung kostenlos stornieren. Danach ist eine Stornierung nur mit unserer Zustimmung möglich, und je nach Produktionsfortschritt können Kosten bis zur vollen Höhe des Kaufpreises anfallen. Bei bereits angefertigten personalisierten Stücken ist eine Stornierung ausgeschlossen.</p>
<h2>8. Zahlung, Preise und Versand</h2>
<p><b>Zahlungsarten:</b> Überweisung (Vorkasse), PayPal, Kreditkarte und Sofortüberweisung. Die Zahlung wickeln wir über Stripe ab; Kartendaten erhalten wir nicht.</p>
<p><b>Zahlungszeitpunkt:</b> Digitale Designs und Kontingente werden vor der Nutzung bezahlt. Bei individuell angefertigten Artikeln gilt Vorkasse; die Produktion beginnt nach deiner Designfreigabe und dem Zahlungseingang. Lagerware wird vor dem Versand bezahlt.</p>
<p><b>Preise:</b> Es gilt der Preis, der zum Zeitpunkt der Bestellung ausgewiesen ist. Alle Preise verstehen sich inklusive der gesetzlichen Umsatzsteuer. Wir behalten uns vor, Preise für künftige Bestellungen zu ändern.</p>
<p><b>Versand:</b> Versand erfolgt mit DHL, DPD oder UPS. Die Versandkosten werden im Bestellvorgang ausgewiesen. Angegebene Liefer- und Produktionszeiten sind Richtwerte; bei Verzögerungen informieren wir dich.</p>
<p><b>Zahlungsverzug:</b> Bei ausbleibender Zahlung können wir die Produktion anhalten und Verzugszinsen nach den gesetzlichen Vorschriften berechnen.</p>
<h2>9. Deine Designs und Vertraulichkeit</h2>
<p>Deine Designs behandeln wir vertraulich. Für Werbung – etwa auf unserer Website, in der Galerie oder in sozialen Netzwerken – verwenden wir ein Design nur, wenn du dem ausdrücklich zustimmst. Im Konfigurator kannst du diese Zustimmung für jedes einzelne Design geben und jederzeit widerrufen. Designs mit deinem eigenen Logo oder mit Fotos von Personen kommen nie ohne deine Zustimmung in die Galerie.</p>
<p>Persönliche Daten verarbeiten wir nach der Datenschutz-Grundverordnung; Einzelheiten stehen in unserer <a href="/datenschutz">Datenschutzerklärung</a>.</p>
<h2>10. Widerruf, Rückgabe und Mängel</h2>
<p>Bei digitalen Inhalten, die nach deinen Vorgaben individuell erzeugt werden, erlischt das Widerrufsrecht mit Beginn der Erzeugung, wenn du dem ausdrücklich zugestimmt und deine Kenntnis vom Erlöschen bestätigt hast (§ 356 Abs. 5 BGB).</p>
<p>Bei personalisierten, individualisierten oder maßgefertigten Waren – also jedem Textil mit deinem Design, deinen Namen oder deinem Logo – besteht nach § 312g Abs. 2 Nr. 1 BGB kein Widerrufsrecht; eine Rückgabe ist ausgeschlossen, weil diese Stücke eigens für dich gefertigt werden. Für nicht personalisierte Lagerware gilt das gesetzliche Widerrufsrecht von vierzehn Tagen ab Lieferung; die Ware muss ungetragen, mit Etikett und in Originalverpackung zurückkommen, die Kosten der Rücksendung trägst du.</p>
<p>Mängel wie Druck- oder Verarbeitungsfehler und deutliche Farbabweichungen meldest du bitte innerhalb von vierzehn Tagen nach Lieferung. Wir prüfen den Mangel und bieten eine Lösung an, in der Regel Nachbesserung oder Ersatz.</p>
<p>Die vollständige Belehrung, das Muster-Widerrufsformular und die Möglichkeit, den Widerruf direkt zu erklären, findest du unter <a href="/widerruf">Widerruf</a>.</p>
<h2>11. Haftung</h2>
<p>Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie nach dem Produkthaftungsgesetz. Bei einfacher Fahrlässigkeit haften wir nur bei Verletzung wesentlicher Vertragspflichten, begrenzt auf den vorhersehbaren, vertragstypischen Schaden.</p>
<h2>12. Verfügbarkeit und höhere Gewalt</h2>
<p>Alle Angebote sind freibleibend. Ist ein Artikel nicht verfügbar, informieren wir dich und du kannst die Bestellung stornieren. Für Verzögerungen oder Nichterfüllung durch Ereignisse höherer Gewalt – etwa Naturkatastrophen, Pandemien, Krieg oder Streik – haften wir nicht.</p>
<h2>13. Anwendbares Recht und Gerichtsstand</h2>
<p>Es gilt deutsches Recht. Gerichtsstand ist Lüneburg. Für Verbraucher gelten die gesetzlichen Gerichtsstände.</p>
<p>Sollte eine Bestimmung dieser AGB unwirksam sein, bleiben die übrigen Bestimmungen gültig.</p>
<h2>14. Kontakt</h2>
<p>Bei Fragen und Beschwerden erreichst du uns unter:<br>${firma}<br>${anschrift.split(',').map(s => s.trim()).join('<br>')}<br>Telefon: ${telefon}<br>E-Mail: <a href="mailto:${mail}">${mail}</a></p>
<p style="color:#8b8598;font-size:13px">Stand: September 2026</p>`);

  // Fassung 66 (Markus, 16. Sept.): eigene Widerrufsseite mit Knopf. Die Regelung von ball-z.de ist
  // uebernommen und auf das Angebot von Motto Otto zugeschnitten: hier entsteht praktisch jedes Stueck
  // erst nach Bestellung und nach den Vorgaben des Kunden - fuer diese Waren gibt es nach
  // § 312g Abs. 2 Nr. 1 BGB kein Widerrufsrecht, und fuer die Designs selbst gilt § 356 Abs. 5 BGB.
  // Ein Widerrufsrecht besteht dagegen bei Mitgliedschaften und bei nicht personalisierter Lagerware -
  // genau dafuer ist der Knopf da. Was der Kunde absendet, geht als Mail an den Betreiber; die
  // Erklaerung gilt mit dem Absenden als abgegeben, unabhaengig davon, ob sie berechtigt ist.
  const widerruf = shell('Widerruf', `
<h1>Widerrufsbelehrung</h1>
<p>Anbieter und Vertragspartner: <b>${firma}</b>, ${anschrift}, Telefon ${telefon}, E-Mail <a href="mailto:${mail}">${mail}</a>.</p>

<div class="box">
<h2>Wann du widerrufen kannst</h2>
<p>Du hast das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag,</p>
<ul>
<li>an dem du oder ein von dir benannter Dritter, der nicht der Beförderer ist, die Ware in Besitz genommen hat – bei einer Lieferung in mehreren Teilen ab der letzten Teillieferung,</li>
<li>des Vertragsabschlusses – bei Mitgliedschaften, Design-Kontingenten und anderen Dienstleistungen.</li>
</ul>
<p>Um dein Widerrufsrecht auszuüben, musst du uns mittels einer eindeutigen Erklärung (zum Beispiel per Post, Telefon oder E-Mail) über deinen Entschluss informieren. Du kannst dafür das Formular weiter unten auf dieser Seite benutzen, das ist aber nicht vorgeschrieben. Zur Wahrung der Frist reicht es, dass du die Mitteilung vor Ablauf der Frist absendest.</p>
</div>

<div class="box">
<h2>Wann das Widerrufsrecht nicht besteht</h2>
<p>Bei Motto Otto entsteht fast jedes Stück erst nach deiner Bestellung und nach deinen eigenen Vorgaben – Motto, Namen, Farben, dein Logo. Für solche Waren gibt es von Gesetzes wegen kein Widerrufsrecht:</p>
<ul>
<li><b>Personalisierte und angefertigte Ware.</b> Das Widerrufsrecht besteht nicht bei Waren, die nicht vorgefertigt sind und für deren Herstellung eine individuelle Auswahl oder Bestimmung durch dich maßgeblich ist oder die eindeutig auf deine persönlichen Bedürfnisse zugeschnitten sind (§ 312g Abs. 2 Nr. 1 BGB). Dazu gehört jedes bedruckte, bestickte oder veredelte Textil mit deinem Design, deinen Namen oder deinem Logo. Solche Stücke lassen sich nicht weiterverkaufen.</li>
<li><b>Digitale Inhalte.</b> Bei den erzeugten Designs und Druckdateien erlischt das Widerrufsrecht, wenn wir mit der Erstellung begonnen haben, nachdem du ausdrücklich zugestimmt und bestätigt hast, dass du dadurch dein Widerrufsrecht verlierst (§ 356 Abs. 5 BGB). Diese Zustimmung holen wir vor dem Start des Designs ein.</li>
</ul>
<p>Dein <b>Widerrufsrecht bleibt</b> zum Beispiel bei einer Mitgliedschaft oder einem Design-Kontingent und bei nicht personalisierter Lagerware.</p>
</div>

<div class="box">
<h2>Folgen des Widerrufs</h2>
<p>Wenn du diesen Vertrag widerrufst, zahlen wir dir alle Zahlungen, die wir von dir erhalten haben, einschließlich der Lieferkosten (mit Ausnahme der zusätzlichen Kosten, die sich daraus ergeben, dass du eine andere Art der Lieferung als die von uns angebotene günstigste Standardlieferung gewählt hast), unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurück, an dem die Mitteilung über deinen Widerruf bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das du bei der ursprünglichen Transaktion eingesetzt hast, es sei denn, mit dir wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden dir wegen dieser Rückzahlung Entgelte berechnet.</p>
<p>Bei einem Warenkauf können wir die Rückzahlung verweigern, bis wir die Ware zurückerhalten haben oder bis du den Nachweis erbracht hast, dass du die Ware zurückgesandt hast, je nachdem, welches der frühere Zeitpunkt ist. Du hast die Ware unverzüglich und in jedem Fall spätestens binnen vierzehn Tagen ab dem Tag, an dem du uns über den Widerruf unterrichtest, an uns zurückzusenden oder zu übergeben. Die Frist ist gewahrt, wenn du die Ware vor Ablauf der Frist von vierzehn Tagen absendest. Du trägst die unmittelbaren Kosten der Rücksendung der Waren. Du musst für einen etwaigen Wertverlust der Waren nur aufkommen, wenn dieser Wertverlust auf einen zur Prüfung der Beschaffenheit, Eigenschaften und Funktionsweise der Waren nicht notwendigen Umgang mit ihnen zurückzuführen ist.</p>
<p>Hast du verlangt, dass eine Dienstleistung während der Widerrufsfrist beginnen soll, so hast du uns einen angemessenen Betrag zu zahlen, der dem Anteil der bis zum Widerruf bereits erbrachten Leistung entspricht.</p>
</div>

<div class="box">
<h2>Mängel</h2>
<p>Unabhängig vom Widerrufsrecht gilt die gesetzliche Gewährleistung. Mängel wie Druckfehler, Verarbeitungsfehler oder deutliche Farbabweichungen meldest du uns bitte innerhalb von vierzehn Tagen nach Lieferung. Wir prüfen den Mangel und bieten dir eine Lösung an, in der Regel Nachbesserung oder Ersatz. Auch dafür kannst du das Formular unten benutzen und als Grund den Mangel angeben.</p>
</div>

<div class="box">
<h2>Mitgliedschaft kündigen</h2>
<p>Eine Mitgliedschaft läuft monatlich und kann jederzeit zum Ende des laufenden Monats gekündigt werden. Dafür brauchst du kein Konto und keinen Grund: Das Formular unten genügt, wähle dort „Mitgliedschaft kündigen“. Wir bestätigen dir den Eingang und den Zeitpunkt, zu dem die Mitgliedschaft endet, per E-Mail. Bis dahin kannst du dein Kontingent weiter nutzen.</p>
</div>

<div class="box" id="formular">
<h2>Widerruf erklären oder kündigen</h2>
<p>Du kannst deinen Widerruf oder deine Kündigung hier direkt erklären. Wir bestätigen dir den Eingang per E-Mail.</p>
<form id="wf" autocomplete="on">
<label for="w-name">Dein Name *</label>
<input id="w-name" name="name" required maxlength="120" placeholder="Vor- und Nachname">
<label for="w-mail">Deine E-Mail-Adresse *</label>
<input id="w-mail" name="email" type="email" required maxlength="160" placeholder="name@beispiel.de">
<label for="w-adresse">Deine Anschrift</label>
<input id="w-adresse" name="adresse" maxlength="200" placeholder="Straße, PLZ, Ort">
<label for="w-nummer">Auftrags- oder Designnummer</label>
<input id="w-nummer" name="nummer" maxlength="80" placeholder="z. B. MO-ABI-20260916-AB12">
<label for="w-datum">Bestellt am / erhalten am</label>
<input id="w-datum" name="datum" maxlength="40" placeholder="z. B. 12.09.2026">
<label for="w-was">Worum geht es? *</label>
<select id="w-was" name="was">
<option value="kuendigung">Mitgliedschaft kündigen</option>
<option value="mitgliedschaft">Mitgliedschaft oder Design-Kontingent widerrufen</option>
<option value="lagerware">Nicht personalisierte Ware widerrufen</option>
<option value="mangel">Mangel / Reklamation</option>
<option value="sonstiges">Etwas anderes</option>
</select>
<label for="w-zeitpunkt">Zum nächstmöglichen Zeitpunkt oder zu einem bestimmten Datum?</label>
<input id="w-zeitpunkt" name="zeitpunkt" maxlength="60" placeholder="z. B. nächstmöglich oder 31.12.2026">
<label for="w-text">Nachricht (optional)</label>
<textarea id="w-text" name="text" maxlength="2000" placeholder="Wenn du magst, schreib uns kurz, worum es geht."></textarea>
<button class="knopf" id="w-knopf" type="submit">Jetzt absenden</button>
<div class="melde" id="w-melde"></div>
<p class="hinweis">Mit dem Absenden geht deine Erklärung bei uns ein. Deine Angaben verwenden wir ausschließlich zur Bearbeitung des Widerrufs.</p>
</form>
</div>

<div class="box">
<h2>Muster-Widerrufsformular</h2>
<p class="hinweis">Wenn du den Vertrag lieber schriftlich widerrufen möchtest, kannst du dieses Muster verwenden und an die oben genannte Anschrift oder E-Mail senden.</p>
<p>An ${firma}, ${anschrift}, E-Mail ${mail}:</p>
<p>Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren (*) / die Erbringung der folgenden Dienstleistung (*)<br>
_______________________________________<br><br>
Bestellt am (*) / erhalten am (*): ______________<br>
Name des/der Verbraucher(s): ______________<br>
Anschrift des/der Verbraucher(s): ______________<br>
Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier): ______________<br>
Datum: ______________</p>
<p class="hinweis">(*) Unzutreffendes streichen.</p>
</div>
<p style="color:#8b8598;font-size:13px">Stand: September 2026</p>
<script>
(function () {
  var f = document.getElementById('wf'), k = document.getElementById('w-knopf'), m = document.getElementById('w-melde');
  if (!f) return;
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    var daten = {};
    ['name', 'email', 'adresse', 'nummer', 'datum', 'was', 'zeitpunkt', 'text'].forEach(function (n) {
      var el = f.querySelector('[name="' + n + '"]'); if (el) daten[n] = el.value.trim();
    });
    if (!daten.name || !daten.email) { m.className = 'melde fehler'; m.textContent = 'Bitte Name und E-Mail-Adresse angeben.'; return; }
    k.disabled = true; k.textContent = 'Wird gesendet …'; m.className = 'melde'; m.textContent = '';
    fetch('/api/mo/widerruf', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(daten) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (a) {
        if (a.ok) {
          m.className = 'melde ok';
          m.textContent = 'Deine Erklärung ist bei uns eingegangen. Wir haben dir eine Bestätigung an ' + daten.email + ' geschickt.';
          k.textContent = 'Gesendet ✓';
          f.querySelectorAll('input,textarea,select').forEach(function (el) { el.disabled = true; });
        } else {
          m.className = 'melde fehler';
          m.textContent = (a.j && a.j.hinweis) || 'Das hat gerade nicht geklappt. Bitte schreib uns an ${mail}.';
          k.disabled = false; k.textContent = 'Jetzt absenden';
        }
      })
      .catch(function () {
        m.className = 'melde fehler';
        m.textContent = 'Keine Verbindung. Bitte schreib uns an ${mail}.';
        k.disabled = false; k.textContent = 'Jetzt absenden';
      });
  });
})();
</script>`);

  return { impressum, datenschutz, agb, widerruf, firma, anschrift, mail, telefon, shell };
}
