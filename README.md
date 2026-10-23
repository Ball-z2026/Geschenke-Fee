# Motto Otto

Die Seite **www.motto-otto.de**: Kunden waehlen ein Motto (Abi, JGA, Hochzeit, Geburtstag ...)
oder sagen Otto ihren Wunsch, beantworten ein paar Fragen, und die Bild-KI zeichnet daraus ein
Design. Der Server macht daraus eine Druckdatei und zeigt das Design auf T-Shirt, Hoodie, Kissen,
Poster und weiteren Artikeln. Dazu gehoeren Partner-Seiten fuer Betriebe (/bei/<name>) mit
eigenem kleinen Shop und Gruppen-Abstimmungen.

**Vor jeder Arbeit `CLAUDE.md` lesen** - dort stehen die verbindlichen Arbeitsregeln.

## Technik

- Node.js (Express, ES-Module), Einstieg `server.js`
- Bilder: `sharp`; die Bild-KI wird ueber einen eigenen Bilddienst angesprochen (`BALLZ_MCP_URL`)
- Laufzeitdaten (Auftraege, Druckdateien, Vorlagen) liegen im Ordner `storage/` - live auf einem
  Railway-Volume, **nicht** im Repository
- Live-Betrieb: Railway baut bei jedem Push auf `main` neu (Dockerfile) - **jeder Push auf `main`
  ist ein Deploy**

## Starten

```bash
npm install
cp .env.example .env      # Werte eintragen (siehe unten)
node server.js            # oder: npm start
```

Ohne echte Schluessel fuer einen lokalen Test:

```bash
BALLZ_MCP_URL=http://127.0.0.1:1/mcp ADMIN_TOKEN=probe MASTER_TOKEN=probe PORT=4090 node server.js
```

Dann laeuft die Seite unter http://localhost:4090 (Bilder zeichnen geht so nicht).

## Pruefen vor jedem Push

```bash
node abnahme.mjs          # alles, auch Browser auf Laptop, iPhone und Android
node abnahme.mjs 7        # nur Browser
```

Erst wenn alles gruen ist, darf etwas auf `main`. Danach die Testdateien wegraeumen:
`git checkout -- storage/ && git clean -fdq storage/`

## Einstellungen

Alle Namen stehen in `.env.example`. Die echten Werte liegen bei Railway (Reiter "Variables")
und gehoeren nie ins Repository. Zum Start noetig sind:

| Name | Wofuer |
|---|---|
| `PORT` | Port des Servers |
| `PUBLIC_BASE_URL` | Adresse der Seite (live `https://www.motto-otto.de`) |
| `ADMIN_TOKEN`, `MASTER_TOKEN` | Zugang zum Backend (`/admin`) und zur Druckseite |
| `SIGN_SECRET` | signiert Vorschau-Links |
| `BALLZ_MCP_URL` | Adresse des Bilddienstes |

Fuer den vollen Betrieb ausserdem: `OPENAI_API_KEY` (Texte lesen, Bildpruefung), `BREVO_API_KEY`
und `MAIL_FROM` (E-Mails), `STRIPE_SECRET_KEY` (Bezahlen, Lizenz-Auszahlung an Partner), `SHOPIFY_*` (Kasse),
`GDRIVE_*` (Ablage der Druckdateien). Alles Weitere ist freiwillig.
