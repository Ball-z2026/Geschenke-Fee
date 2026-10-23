# Welche Shopify-Lösung und welches Theme

Recherchiert am 23. September 2026, weil Markus gefragt hat: *„Recherchiere bitte, welche Shopify
Lösung wir nehmen und welches Theme."*

## Kurz vorweg

- **Lösung: Draft Orders über die Admin API.** Nicht die Storefront-API-Cart, nicht Cart-Permalinks.
- **Theme: Dawn, das kostenlose Standard-Theme. Kein gekauftes Theme.**
- **Tarif: Basic** zum Start; der Wechsel auf Grow lohnt erst ab rund 20.000 € Monatsumsatz.
- **Kein Hydrogen, kein Headless-Umbau.**

Warum – und was die Entscheidung erzwingt, steht unten. Zwei Befunde geben den Ausschlag, beide
aus unserem eigenen Code.

## Was unsere Seite schon festlegt

**1. Wir sind die Storefront.** Der Kunde gestaltet auf motto-otto.de. Shopify soll Kasse,
Zahlung und Bestellverwaltung sein – nicht der Laden. Damit ist die Frage „welches Theme" fast
schon beantwortet.

**2. Das Fulfillment erwartet Eigenschaften je Bestellzeile.** `fulfillment.js` liest
`_designId`, `_produkt`, `_groesse`, `_printUrl` (siehe `FULFILLMENT.md`). Ohne die kann keine
Bestellzeile einem Design zugeordnet werden. Jede Lösung muss das können.

**3. Wir haben eine Mengenstaffel, die Shopify nicht kennt.** `preise.cjs`: bis **28 % Rabatt**,
gestaffelt ab 5/10/20/25/50 Stück, **nur für Textilien** – eine Tasse hebt die Stufe nicht. Dazu
drei Qualitätsstufen je Textil und die Regel, dass der Stückpreis **erst gerundet und dann
multipliziert** wird (sonst geht die Gegenrechnung 25 × (19,42 + 4,90) = 608,00 nicht auf).

Punkt 3 ist der Knackpunkt.

## Die vier Wege, und warum drei ausfallen

### Cart-Permalink (`/cart/<variante>:<menge>?properties=…`)
Der einfachste Weg: ein Link, kein Schlüssel auf unserem Server. **Fällt aus.**
Eigenschaften lassen sich nur an das **erste Produkt** im Permalink hängen, und sie müssen als
Base64-kodiertes JSON in die URL. Eine Abi-Bestellung mit 30 Shirts und 30 verschiedenen Namen
ist damit nicht abbildbar – genau unser Hauptfall.

### Buy Button
Noch weniger Möglichkeiten als der Permalink. **Fällt aus**, gleicher Grund.

### Storefront API (`cartCreate` → `checkoutUrl`)
Der moderne Standard, und technisch sauber: `CartLineInput` hat ein `attributes`-Feld
(Key-Value je Zeile, bis 250 Einträge), die Attribute landen als Line-Item-Properties in der
Bestellung, und ein führender Unterstrich blendet sie im Checkout aus, ohne sie zu verlieren –
genau unsere `_designId`-Konvention. Der Cart liefert eine `checkoutUrl` zum Weiterleiten.

**Fällt trotzdem aus – wegen des Preises.** Bei diesem Weg rechnet **Shopify** den Preis aus der
Variante. Unsere Staffel müsste dort ein zweites Mal existieren. Dafür gäbe es Shopify Functions,
aber: **eine selbst gebaute, private Discount Function setzt Shopify Plus voraus** (ab ca.
2.100 €/Monat). Bleibt eine Rabatt-App aus dem App Store – dann steht die Preislogik an zwei
Stellen, und die zweite kennt unsere Rundungsregel nicht. Genau diese doppelte Wahrheit hat uns
heute schon einmal Stunden gekostet.

### Draft Orders (Admin API) — **das nehmen wir**
Wir rechnen den Preis wie bisher mit `preise.cjs`, legen eine Draft Order an und schicken den
Kunden auf die `invoice_url` zum Bezahlen. Je Zeile möglich:

- `properties` – beliebige Name/Wert-Paare → unsere `_designId`, `_produkt`, `_groesse`, `_printUrl`
- `price` – unser gerechneter Stückpreis
- `applied_discount` – der Staffelrabatt, als Betrag oder Prozent, je Zeile **oder** für die ganze Bestellung

Beim Bezahlen wird daraus eine **ganz normale Bestellung**, die den `orders/create`-Webhook
auslöst – also genau das, was `fulfillment.js` bereits verarbeitet. **Unsere Preisberechnung
bleibt die einzige Wahrheit.**

**Was wir dafür in Kauf nehmen, ehrlich benannt:**
- Der Admin-API-Schlüssel liegt bei uns auf dem Server (bei der Storefront API wäre es ein
  öffentlicher Token). Gehört damit zu den Schlüsseln, die nie in Chat, Commit oder Log landen.
- Reine Custom-Positionen tauchen nicht in den Produkt-Verkaufsberichten auf. **Lösung:** echte
  Varianten verwenden (Artikel × Stufe) und den Rabatt per `applied_discount` setzen, statt
  freie Positionen zu bauen. Dann stimmt auch die Auswertung.
- Der Weg zur Kasse ist ein Rechnungslink, kein klassischer Warenkorb. Für uns passt das: der
  Kunde hat vorher alles auf unserer Seite konfiguriert und bestätigt.

## Was in Shopify angelegt werden muss

Kein Produkt je Design – sonst hätten wir nach einem Jahr zehntausende Karteileichen. Stattdessen
**ein Produkt je Artikel, eine Variante je Stufe**:

| Produkt | Varianten |
|---|---|
| Shirt | Starter 19,90 · Liebling 24,90 · Deluxe 32,90 |
| Hoodie | Starter 39,90 · Liebling 49,90 · Deluxe 64,90 |
| Zip-Jacke | Starter 42,90 · Liebling 52,90 · Deluxe 69,90 |
| Polo | 24,90 / 29,90 / 39,90 € (steht in `preise.cjs`, siehe `PREISE.md`) |
| Tasse, Beutel | je 14,90 |
| Kissen | 24,90 |
| Poster A2 | 16,90 |
| Strandtuch | 32,90 |
| Sticker-Pack | 7,90 |

Die **Größe kommt nicht als Variante**, sondern als Eigenschaft `_groesse` an der Zeile – sonst
wären es 10 Artikel × 3 Stufen × 22 Größen = weit über 600 Varianten, und der Lagerbestand wäre
Unsinn, weil jedes Stück ohnehin auf Bestellung gefertigt wird.

## Tarif

| Plan | Monat (jährlich – monatlich) | Karte | Fremdes Gateway |
|---|---|---|---|
| **Basic** | 27 – 38 € | 2,2 % + 0,30 € | + 2,0 % |
| Grow | 79 – 105 € | 1,9 % + 0,30 € | + 1,0 % |
| Advanced | 289 – 384 € | 1,7 % + 0,30 € | + 0,6 % |
| Plus | ab 2.100 € | – | + 0,2 % |

**Basic reicht.** Draft Orders, Admin API, Webhooks und Line-Item-Properties sind in jedem Tarif
enthalten – Plus bräuchten wir nur für eine eigene Discount Function, und die umgehen wir gerade.
Der Wechsel auf Grow rechnet sich erst ab rund **20.000 € Monatsumsatz**, Advanced ab rund
100.000 €. Jährliche Zahlung spart etwa 25 %.

## Theme

**Dawn, das kostenlose Standard-Theme von Shopify. Kein gekauftes Theme, kein Hydrogen.**

Weil unsere Storefront motto-otto.de ist, sieht der Kunde den Shopify-Shop praktisch nie – er
landet nur auf der Kassenseite, und die wird **nicht** vom Theme gestaltet, sondern im Admin unter
Checkout-Branding. Das Theme trägt bei uns nur:

- die Rechtstexte, die auf der Shopify-Domain erreichbar sein müssen (Impressum, Datenschutz, AGB,
  Widerruf) – auf unserer Seite stehen sie schon, aber der Checkout läuft auf Shopifys Domain,
- eine schlichte Startseite, falls jemand die Shop-Adresse direkt aufruft.

Dawn ist Shopifys Referenz-Theme, kostenlos, schnell und wird laufend gepflegt. Ein gekauftes
Theme (150–350 €) würde nichts davon verbessern.

**Hydrogen/Headless wäre ein Rückschritt.** Hydrogen ist dafür da, eine Storefront in React zu
bauen – wir haben unsere Storefront schon, sie läuft auf Node und kann Dinge, die kein Theme kann.
Hydrogen hieße, den Konfigurator neu zu bauen, mit höherem Aufwand und laufender Pflege, ohne
einen einzigen Vorteil für uns.

## Gibt es andere Lösungen? (Markus, 23. Sept.)

Nachgesehen, ob Shopify überhaupt die richtige Klasse ist. Die ehrliche Frage lautet: **was
brauchen wir eigentlich noch?** Wir haben den Laden (motto-otto.de), die Preise (`preise.cjs`),
die Designs und das Fulfillment (`fulfillment.js`). Offen ist nur:

1. Zahlung abwickeln
2. Eine Kasse, die in Deutschland rechtssicher ist (Button-Lösung, Widerruf, AGB, Bestell­bestätigung mit vollem Vertragsinhalt)
3. Rechnung nach § 14 UStG
4. Umsatzsteuer, auch über die Grenze (OSS)
5. Bestellverwaltung, Erstattungen, Buchhaltungs-Export

Daran gemessen:

| Lösung | Was sie kann | Was fehlt / was sie kostet | Urteil |
|---|---|---|---|
| **Shopify Basic + Draft Orders** | alles fünf, sofort | 27–38 €/Monat + 2,2 %; US-Anbieter, AVV und EU-Server nötig | **empfohlen** |
| **Nur Stripe** (Checkout/Elements) | Zahlung, Steuer (Stripe Tax) | **Stripe stellt keine Rechnung nach § 14 UStG aus.** Kasse, Widerruf, Bestellbestätigung, Bestellverwaltung, Erstattungen, Buchhaltung müssten wir bauen und rechtlich verantworten | für später, nicht jetzt |
| **Mollie** statt Stripe | in DACH stärker: Giropay, Sofort, Klarna Rechnung; SEPA 0,35 € fest statt 0,8 % | dasselbe Loch wie bei Stripe – es ist ein Zahlungsdienst, kein Shop | als PSP eine echte Option |
| **Snipcart / Foxy** (Warenkorb für eigene Seiten) | genau unsere Bauform: eigene Seite, fremder Warenkorb | Snipcart **2 % vom Umsatz** *zusätzlich* zu den Zahlungsgebühren – teurer als Shopify, sobald wir über ca. 1.900 € Monatsumsatz kommen; deutsches Recht nicht eingebaut | nein |
| **Shopware 6** (Community) | DSGVO und deutsches Recht von Haus aus, Server in der EU, B2B stark | Community kostenlos, aber selbst gehostet und gepflegt; kommerzielle Editionen ab 600 €/Monat; PHP-Stack neben unserem Node-Stack | überdimensioniert |
| **WooCommerce + Germanized** | günstig (ab ~30 €/Monat Hosting), deutsches Recht per Plugin, volle Kontrolle | WordPress-Stack daneben, Updates und Sicherheit sind unsere Sache | möglich, aber ein zweites System |
| **Medusa** (Node, quelloffen) | passt technisch am besten zu uns, läuft auf Railway, keine Plattformgebühr | wir hosten und pflegen Kasse und Bestellverwaltung selbst, inklusive Sicherheit; deutsches Recht ist nicht eingebaut | reizvoll, aber der falsche Zeitpunkt |

**Das Argument, das den Ausschlag gibt, ist nicht technisch.** Alles, was billiger ist als
Shopify, verlagert **Recht und Steuer zu uns**: rechtssichere Bestellbestätigung, Widerruf,
Rechnung nach § 14 UStG, Umsatzsteuer über die Grenze, Aufbewahrung. Das sind keine
Programmieraufgaben, das ist Haftung. 30 € im Monat sind dafür nicht der Rede wert – ein einziger
Fehler in der Widerrufsbelehrung kostet mehr.

**Wann sich das ändert:** Shopify nimmt 2,2 % plus die Monatsgebühr. Ab etwa 20.000 € Monats­umsatz
lohnt der Wechsel auf Grow (1,9 %), ab rund 100.000 € Advanced. Ein eigener Stack auf Medusa oder
Woo spart erst dann wirklich Geld, wenn der Umsatz so hoch ist, dass sich auch ein Steuerberater
und eine laufende Rechtsprüfung tragen. **Bis dahin ist Shopify die günstigere Lösung, auch wenn
es nach außen teurer aussieht.**

**Eine Sache sollten wir unabhängig davon prüfen:** Shopify ist ein US-Anbieter. Auftrags­verarbeitungs­vertrag,
EU-Serverstandort und sauber eingebundenes Tracking sind Pflicht, nicht Kür.

## Was noch zu klären ist

1. ~~Polo fehlt in `preise.cjs`.~~ **Erledigt am 23. September:** 24,90 / 29,90 / 39,90 €,
   recherchiert und in `PREISE.md` belegt.
2. **Zahlungsarten:** Shopify Payments plus PayPal und Klarna ist in Deutschland üblich. Ob wir
   Kauf auf Rechnung für Vereine und Firmen wollen, ist eine Geschäftsentscheidung – technisch
   geht es über Klarna oder eine manuelle Zahlungsart.
3. **Gruppenbestellung:** Aufgabe #29 (jeder zahlt selbst) passt nicht zu einer Draft Order, die
   als Ganzes bezahlt wird. Dafür bräuchte es je Person eine eigene Draft Order mit demselben
   Design – lösbar, aber eine eigene Aufgabe.
4. **Rechtstexte** müssen in Shopify ein zweites Mal gepflegt werden, weil der Checkout dort läuft.

## Quellen

- [Shopify – Create cart permalinks](https://shopify.dev/docs/apps/build/checkout/create-cart-permalinks) (Eigenschaften nur am ersten Produkt, Base64-JSON)
- [Shopify Storefront API – CartLineInput](https://shopify.dev/docs/api/storefront/latest/input-objects/CartLineInput) (`attributes` je Zeile, max. 250 Werte)
- [Shopify Storefront API – cartCreate](https://shopify.dev/docs/api/storefront/latest/mutations/cartCreate) (`checkoutUrl`)
- [Shopify Admin API – DraftOrder](https://shopify.dev/docs/api/admin-rest/latest/resources/draftorder) (`properties`, `price` und `applied_discount` je Zeile, `invoice_url`, Abschluss wird echte Bestellung)
- [Shopify – Build a discount function](https://shopify.dev/docs/apps/build/discounts/build-discount-function) und [Function APIs](https://shopify.dev/docs/api/functions/latest) (private Functions nur mit Plus)
- [Hidden Line Item Properties (Unterstrich)](https://www.printitmyway.com/blog/shopify-hidden-line-item-properties-underscore) (im Checkout ausgeblendet, in der Bestellung erhalten)
- [Shopify Preise 2026 – Übersicht](https://www.we-site.de/blog/shopify-kosten) und [Falkeconsulting – Shopify Kosten 2026](https://falkeconsulting.com/blogs/blog/shopify-kosten) (Tarife, Gebühren, Break-even)
- [Hydrogen vs. Liquid, wann welches](https://mgroupweb.com/blogs/shopify-hydrogen-vs-liquid/)

Zu den Alternativen:
- [Snipcart – Preise](https://snipcart.com/blog/foxy-vs-snipcart-review) (2 % vom Umsatz zusätzlich zu den Zahlungsgebühren, mind. 10 $)
- [Stripe – Rechtliche Vorgaben für Onlineshops in Deutschland](https://stripe.com/resources/more/legal-compliance-online-shops-germany) (Widerruf nach §§ 355, 356 BGB, Bestellbestätigung mit vollem Vertragsinhalt)
- [Stripe verbuchen und rechtskonforme Rechnungen](https://striptu.com/de/blog/wie-man-stripe-in-deutschland-verbucht-und-rechtskonforme-rechnungen-ausstellt) (Stripe stellt keine Rechnung nach § 14 UStG aus)
- [Shopsystem-Vergleich 2026](https://www.greenblut.com/ratgeber/shopsystem-vergleich) und [Shopify-Alternativen 2026](https://onlineshops.de/shopify-alternativen-2026/) (Shopware/WooCommerce/Gambio, DSGVO und EU-Server, Kosten)
- [Medusa auf Railway](https://railway.com/deploy/medusa-headless-commerce) und [Medusa vs. Shopify 2026](https://www.buildwithmatija.com/blog/medusa-vs-shopify-2026-cost-b2b-headless-tradeoffs) (selbst gehostet, keine Plattformgebühr, dafür eigener Betrieb)
- [Mollie vs. Stripe](https://toolspick.de/vergleich/stripe-vs-mollie/) (DACH-Zahlungsarten, SEPA 0,35 € fest statt 0,8 %)
