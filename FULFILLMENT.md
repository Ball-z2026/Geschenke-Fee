# Bestellungen aus Shopify an die Dienstleister weiterleiten

Modul `fulfillment.js` (`mountFulfillment`). Shopify schickt bei jeder Bestellung einen Webhook →
wir teilen jede Bestellzeile nach **Route** auf und leiten sie weiter.

## Routen
- **eigendruck** – Textilien (T-Shirt, Hoodie, Zip, Beutel): wird als Druckauftrag erfasst, mit
  Link zur Druckdatei in **echter Größe (max. 36 × 46 cm, 300 dpi)**.
- **pod** – Print-on-Demand (Tasse, Strandtuch, Kissen, Poster, Sticker): Bestellung geht per API
  an den Anbieter (Gelato / Printful / Printify). Gesendet wird nur, wenn API-Key **und**
  Produkt-Mapping vorhanden sind – sonst Status `ausstehend` (nichts geht verloren).

Routing ist über `storage/fulfillment-routes.json` überschreibbar (Volume), Standard sonst:
Textil = eigendruck, Rest = pod (Anbieter `POD_PROVIDER`, Standard `gelato`).

## Shopify-Seite: so muss jede Variante uns die Kennung mitgeben
Entweder als **Line-Item-Properties** (bevorzugt):
`_designId`, `_produkt`, `_groesse`, optional `_printUrl`
oder als **SKU**: `MO-<designId>__<produkt>__<groesse>` (z. B. `MO-ABI-20260907-AB12__tee__L`).
`produkt` = eines von: tee, hoodie, zip, tasse, beutel, strandtuch, kissen, poster, sticker
(Synonyme wie „T-Shirt", „mug", „Tasche" werden erkannt).

## Webhook einrichten (Shopify Admin → Notifications/Webhooks, oder App)
- Topic: **orders/create** (oder orders/paid)
- URL: `https://www.motto-otto.de/api/mo/shopify/webhook`
- Format: JSON. Signatur wird per HMAC-SHA256 geprüft.

## Umgebungsvariablen (Railway)
| Variable | Zweck |
|---|---|
| `SHOPIFY_WEBHOOK_SECRET` | HMAC-Prüfung des Webhooks (Pflicht, sonst 503) |
| `POD_PROVIDER` | Standard-POD-Anbieter (`gelato` / `printful`) |
| `GELATO_API_KEY` | Gelato-Bestellungen aktiv |
| `PRINTFUL_API_KEY` | Printful-Bestellungen aktiv |
| `PRINTIFY_API_KEY` + `PRINTIFY_SHOP_ID` | Printify (Payload folgt) |

Ohne Anbieter-Key bleibt die POD-Zeile `ausstehend` – Store & Eigendruck laufen trotzdem.

## Produkt-Mapping (pro Anbieter) in `storage/fulfillment-routes.json`
```json
{
  "tasse":  { "route": "pod", "provider": "gelato",  "map": { "gelato":  { "productUid": "<gelato-product-uid>" } } },
  "kissen": { "route": "pod", "provider": "printful", "map": { "printful": { "variant_id": 0 } } }
}
```

## Backend / Test
- `GET  /api/admin/fulfillment/config?token=…` – Routen, aktive Anbieter, Webhook-Status
- `GET  /api/admin/fulfillment?token=…` – letzte weitergeleitete Bestellungen + Status
- `POST /api/mo/fulfillment/test?token=…` – Beispiel-Order ohne Shopify durchspielen
- Druckdatei (signiert, für Anbieter): `GET /api/mo/druck/<designId>.png?exp=…&sig=…`
