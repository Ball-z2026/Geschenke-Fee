# Warum Mails im Spam landen — und was dagegen eingestellt sein muss

Markus, 23. September: *"wie war das nochmal, dass die Mail nicht im Spam landet?"* — Es stand
nirgends. Nur ein Halbsatz in `server.js` ("Wenn nichts ankommt: Spam pruefen"). Hier steht es.

## Wie Motto Otto Mails verschickt

| | |
|---|---|
| Versanddienst | **Brevo** (früher Sendinblue), `BREVO_API_KEY` |
| Absender | `otto@motto-otto.de`, Anzeigename **Motto Otto** (`MAIL_FROM`, `MAIL_FROM_NAME` in `server.js`) |
| Was rausgeht | Anmelde-Link, Fertig-Mail, Widerruf/Kündigung, Wappen-Einverständnis, Fanclub-Freigabe, Hinweise an den Betrieb |

Der Empfänger-Posteingang stellt drei Fragen. Alle drei müssen mit Ja beantwortet werden, sonst
wandert die Mail in den Spam:

1. **SPF** — Darf dieser Server überhaupt für `motto-otto.de` senden?
2. **DKIM** — Ist die Mail unterwegs unverändert geblieben, signiert von `motto-otto.de`?
3. **DMARC** — Was soll der Empfänger tun, wenn 1 oder 2 nicht passt?

## Gemessener Stand (23. September 2026)

Abgefragt über DNS-over-HTTPS, nicht aus dem Gedächtnis:

| Eintrag | Ist | Urteil |
|---|---|---|
| `motto-otto.de` TXT (SPF) | `v=spf1 a mx include:secure-mailgate.com ~all` | **FEHLER — Brevo fehlt** |
| `brevo1._domainkey` CNAME | `b1.motto-otto-de.dkim.brevo.com` → echter RSA-Schlüssel | in Ordnung |
| `brevo2._domainkey` CNAME | `b2.motto-otto-de.dkim.brevo.com` → echter RSA-Schlüssel | in Ordnung |
| `_dmarc.motto-otto.de` TXT | `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` | vorhanden, Stufe „nur beobachten" |
| `motto-otto.de` TXT | `brevo-code:c4089…` | Domain bei Brevo bestätigt |

### Der eine Fehler

`include:secure-mailgate.com` ist Alfahostings eigenes Mail-Gateway — dort steht **keine einzige Brevo-Adresse** drin
(nachgesehen: nur `46.243.*`, `128.127.70.*`, `89.22.108.*`, `192.162.87.*`, `81.88.38.*`,
`109.237.142.*`). Brevo verschickt aus ganz anderen Netzen (`spf.brevo.com`: `185.41.28.0/22`,
`94.143.16.0/21`, `185.24.144.0/22`, `153.92.224.0/19`, `213.32.128.0/18` und weitere).

**Also: jede Mail, die Brevo für uns verschickt, fällt bei SPF durch** — `~all` ist Softfail.
Dass trotzdem vieles ankommt, liegt allein an DKIM: die Signatur passt zur Absenderdomain, und
DMARC lässt eine Mail schon durch, wenn EINE der beiden Prüfungen besteht. Es läuft also auf
einem Bein. Gmail ist damit meist gnädig, **Outlook/Hotmail und Firmenfilter sind es nicht** —
genau dort landet die Mail im Spam.

### Die Behebung

Den SPF-Eintrag von `motto-otto.de` ändern auf:

```
v=spf1 a mx include:secure-mailgate.com include:spf.brevo.com ~all
```

- **Nur diese eine Zeile ändern.** Eine Domain darf genau EINEN SPF-Eintrag haben; ein zweiter
  TXT-Eintrag mit `v=spf1` macht beide ungültig.
- `brevo-code:…` bleibt als eigener TXT-Eintrag stehen, der hat mit SPF nichts zu tun.
- Das SPF-Limit von 10 DNS-Abfragen wird nicht gerissen: **nachgezählt 4 vorher, 5 nachher.**
- Wo: beim DNS-Anbieter der Domain — **Alfahosting** (Nameserver `cns1/2/3.alfahosting.info`, nachgesehen),
  nicht bei Railway und nicht bei Brevo. Zwei fertige Texte liegen dafuer bereit:
  `mail-alfahosting-anfrage.txt` (an den Support schicken) und
  `mail-alfahosting-browser-auftrag.txt` (Claude im Browser macht es selbst im Kundenbereich).
- Wirkung frühestens nach der TTL von **3 Stunden** (10800 s).

### Prüfen, ob es gewirkt hat

```
curl -sS "https://dns.google/resolve?name=motto-otto.de&type=TXT"
```
muss `include:spf.brevo.com` enthalten. Danach eine Testmail an eine **Outlook- oder GMX-Adresse**
schicken (nicht an Gmail — Gmail ist zu gnädig, um den Unterschied zu zeigen) und im Kopf der
Mail nachsehen: `spf=pass`, `dkim=pass`, `dmarc=pass`.

## Später, erst wenn SPF steht

`p=none` heißt: der Empfänger beobachtet nur und tut nichts. Das ist für den Anfang richtig.
Wenn die DMARC-Berichte (gehen an `rua@dmarc.brevo.com`, im Brevo-Konto einsehbar) über ein paar
Wochen sauber sind, kann man auf `p=quarantine` und später `p=reject` hochstellen. Das schützt
davor, dass jemand in unserem Namen Mails verschickt. **Nicht vorher** — solange SPF durchfällt,
würde eine schärfere Stufe eigene Mails wegwerfen.

## Was sonst noch in den Spam führt (und hier schon in Ordnung ist)

- **Absenderadresse auf der eigenen Domain**, nicht `…@gmail.com` → `otto@motto-otto.de`, passt.
- **Antwortadresse**, die wirklich jemand liest → `replyTo` wird gesetzt, wo es Sinn ergibt.
- **Keine Massenmails ohne Einwilligung** → steht als Regel in `CLAUDE.md` (§ 7 UWG).
- **Kein Bild-only-Inhalt**: eine Mail, die nur aus einem großen Bild besteht, ist ein klassisches
  Spam-Merkmal. Unsere Mails haben echten Text drumherum.

## Was ich NICHT selbst ändern kann

Den DNS-Eintrag. Der liegt bei Alfahosting und braucht Markus' Zugang.

**Am 23. September einmal falsch geraten:** Ich hatte hier zuerst "All-Inkl" stehen, allein weil
`secure-mailgate.com` im SPF steht. Nachgesehen sind die Nameserver `cns1/2/3.alfahosting.info` —
es ist Alfahosting, und `secure-mailgate.com` ist deren eigenes Gateway. Anbieter nachsehen,
nicht aus einem Hostnamen schliessen.
