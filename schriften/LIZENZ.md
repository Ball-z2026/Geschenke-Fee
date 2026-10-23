# Schriften

Zwei Schriften liegen hier als Datei, damit die Karten auf JEDEM Server gleich aussehen -
Liberation Sans (ein Arial-Klon) sah nach PowerPoint aus, und Adobe Fonts kann ein Server nicht
drucken. Beide stehen unter der SIL Open Font License 1.1: frei verwendbar, auch kommerziell,
auch eingebettet in Druckdateien. Verkauft werden duerfen die Schriftdateien selbst nicht - das
tun wir auch nicht.

- **Archivo** (Omnibus-Type, Hector Gatti u. a.) - Bold und Medium, fuer Headline und Zwischenzeile.
  Eine Grotesk mit engerem Lauf und kraeftigen Formen; haelt grosse Groessen, ohne aufdringlich zu
  wirken. https://fonts.google.com/specimen/Archivo
- **Inter** (Rasmus Andersson) - SemiBold und Regular, fuer kleine Zeilen (Ort, Datum, Adresse).
  Auf kleine Groessen hin gezeichnet, sehr gut lesbar. https://fonts.google.com/specimen/Inter

Der Server macht sie ueber eine eigene fontconfig-Datei bekannt (schriften/fonts.conf, gesetzt in
server.js ueber FONTCONFIG_FILE) - ohne Installation, ohne Root, ohne Netz.
