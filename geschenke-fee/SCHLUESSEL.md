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
| `GEMINI_IMAGE_MODEL` | `gemini-3-pro-image` | Bildmodell Nano Banana Pro (seit 28. Mai 2026 GA, frueher `-preview`). |
| `GEMINI_IMAGE_SIZE` | `4K` | Hoechste Stufe: rund 16 Megapixel (1:1 4096 x 4096, 4:3 4800 x 3584, 3:2 5056 x 3392). 2K = rund 4 MP. |
| `BALLZ_MCP_URL` | leer | Adresse des Bilddienstes (ballz-image-mcp, Endpunkt `/mcp`). Der Bilddienst braucht dort ebenfalls `GEMINI_API_KEY`. |

So arbeitet Gemini hier (Code auf Zweig `gemini`; Markus, 25. Okt.: "alles auf Gemini entwerfen und wenn etwas
ausdruecklich per DTF gewuenscht ist, das Motiv ... nachbauen mit OpenAI in hoechster Druckstufe"):
- Texte: derselbe Client wie bisher, ueber Googles OpenAI-kompatible Schnittstelle.
- Jedes Bild entwirft Gemini (Werkzeug `nano_banana`, 4K). Kundenfotos gehen als Daten mit (keine Adresse im Netz).
- Flachware, Szenen, Fotos: das Gemini-Bild ist die Datei.
- DTF (jedes transparente Motiv, also Textil): Gemini malt den Entwurf auf ruhigem Grund, danach baut das bisherige
  Bildmodell (OpenAI ueber den Bilddienst) GENAU diesen Entwurf transparent nach - Stufe max, Entwurf als Bild 1,
  input_fidelity high. Kein Freistellen. Kostet zwei Bildaufrufe.
- Nur Auftraege mit Maske (ein Logo bleibt pixelgenau stehen) gehen direkt an OpenAI - Gemini kennt keine Maske.

Was 4K fuer den Druck heisst (bei 300 dpi): 4096 px = 34,7 cm. Tasse 20 x 8,9 cm braucht 2362 x 1051 px (2K reicht),
Kissen 40 x 40 cm bekommt rund 260 dpi, Poster A3 (2:3, 3392 x 5056) rund 290 dpi.
Quellen: ai.google.dev/gemini-api/docs/image-generation, docs.cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-pro-image.

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
