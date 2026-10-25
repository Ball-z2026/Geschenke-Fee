# Geschenke-Fee: Schlüssel und Einstellungen

Alle Felder sind am 25. Okt. 2026 bei Railway angelegt (Projekt `geschenke-fee`, Dienst
`geschenke-fee-vorschau`, Reiter Variables) - leer, bis der Wert eingetragen wird.
Werte NIE in den Chat oder ins Repo schreiben, nur bei Railway.

Markus, 25. Okt.: "Ich möchte, dass wir bei Geschenke Fee erst mal mit Gemini arbeiten."

## KI (Gemini)

| Feld | Steht schon | Was hinein gehört |
|---|---|---|
| `KI_ANBIETER` | `gemini` | Schaltet Texte und Bilder auf Gemini. Leer = OpenAI wie bei Motto Otto. |
| `GEMINI_API_KEY` | leer | Schlüssel aus Google AI Studio (aistudio.google.com -> Get API key). |
| `QA_MODEL` | `gemini-2.5-flash` | Textmodell für Prüfen, Recherche, Wunsch lesen. |
| `GEMINI_IMAGE_MODEL` | `gemini-3-pro-image-preview` | Bildmodell (Nano Banana Pro). |
| `BALLZ_MCP_URL` | leer | Adresse des Bilddienstes (ballz-image-mcp, Endpunkt `/mcp`). Der Bilddienst braucht dort ebenfalls `GEMINI_API_KEY`. |

So arbeitet Gemini hier (Code auf Zweig `gemini`):
- Texte: derselbe Client wie bisher, über Googles OpenAI-kompatible Schnittstelle.
- Bilder mit Grund (Tasse, Kissen, Poster, Fotobuch, Szenen, Fotos): Werkzeug `nano_banana`, Kundenfotos gehen
  als Daten mit (keine Adresse im Netz), Format aus der bestellten Größe, Auflösung `GEMINI_IMAGE_SIZE` (Standard 2K).
- OFFEN: Gemini liefert keinen Alphakanal. Transparente Motive (Textil) und Aufträge mit Maske (Logo stehen
  lassen) gehen deshalb weiter an das bisherige Bildmodell. Freistellen ist verboten (6. Okt.) - wie Textil-Motive
  mit Gemini entstehen, entscheidet Markus.

## Zugang (neu, eigene Werte - nicht die von Motto Otto)

`ADMIN_TOKEN`, `MASTER_TOKEN`, `SIGN_SECRET` - je eine lange Zufallsfolge.

## Mail

`BREVO_API_KEY`, `MAIL_FROM` (z. B. hallo@geschenke-fee.de), `MAIL_FROM_NAME` (steht: Geschenke-Fee), `ADMIN_EMAIL`.

## Kasse

`STRIPE_SECRET_KEY` und/oder Shopify: `SHOPIFY_SHOP`, `SHOPIFY_ADMIN_TOKEN`, `SHOPIFY_CLIENT_ID`,
`SHOPIFY_CLIENT_SECRET`, `SHOPIFY_WEBHOOK_SECRET`.

## Druck

`POD_PROVIDER` (gelato oder printful), dazu `GELATO_API_KEY` bzw. `PRINTFUL_API_KEY`.

## Impressum

`IMPRESSUM_FIRMA`, `IMPRESSUM_VERTRETER`, `IMPRESSUM_ANSCHRIFT`, `IMPRESSUM_MAIL`, `IMPRESSUM_TELEFON`,
`IMPRESSUM_REGISTER`, `IMPRESSUM_USTID` - offen: verkauft Tammy selbst oder eine Firma?

## Adresse

`PUBLIC_BASE_URL` - steht auf der Vorschau-Adresse; mit eigener Domain auf https://geschenke-fee.de umstellen.
