// Wer steckt hinter einem Vornamen - eine Frau oder ein Mann?
//
// 27. Sept., Markus (Screenshot "Anne · 65", getragen von einem Mann): "Am Namen ist zu
// erkennen, dass es sich um eine Frau handelt. Dann sollte es auch als Frau als Beispiel kommen."
// Die Getragen-Ansicht zeigt das Shirt an einer Person. Steht ein Name auf dem Design, soll die
// Person dazu passen. Dafuer braucht es keine Statistik und keinen Dienst - die Vornamen, die
// in Deutschland wirklich vorkommen, sind ueberschaubar. Wer hier nicht drinsteht oder beides
// sein kann (Kim, Toni, Alex, Luca, Robin, Eike ...), bekommt bewusst KEINE Antwort: dann bleibt
// es bei der allgemeinen Vorlage. Lieber neutral als falsch.
//
// Geschrieben ohne Umlaute (juergen, joerg, bjoern), der Vergleich normalisiert genauso.

const FRAUEN = new Set(`
alexandra alina amelie amira andrea angela angelika anja anke anna anne annegret annette annika antje astrid ayse
barbara beate bettina bianca birgit brigitte britta
carina carla carmen carolin caroline charlotte christa christiane christina christine claudia clara cornelia
dagmar daniela diana doris dorothea
edith elena elfriede elisabeth elke ella ellen elsa emilia emily emma erika erna esther eva evelyn
fatma franziska frauke frieda friederike
gabi gabriele gerda gertrud gisela greta gudrun
hanna hannah hannelore hedwig heidi heike helena helene helga henrike hilde hildegard
ilona ilse ina inge ingeborg ingrid irene iris irmgard isabel isabell isabella
jana janina janine jasmin jennifer jessica johanna josefine josephine julia juliane jutta
karin karina karla karoline katharina kathrin katja katrin kerstin kirsten klara kristina
laura lea leah lena leni leonie lieselotte lilli lilly lina linda lisa liselotte lotta lotte louisa luisa luise lydia
magdalena maike manuela mareike margarete margit margot maria marianne marie marina marion marlene marlies marta martha martina mathilda mathilde meike melanie melina merle mia michaela mila miriam monika monique
nadine nadja natalie nathalie nele nicole nina nora
olga
paula pauline petra pia
rebecca regina renate rita romy rosa rosemarie ruth
sabine sabrina sandra sara sarah saskia selina silke silvia simone sina sofia sofie sonja sophia sophie stefanie stephanie susanne svenja sybille
tanja tatjana theresa therese
ulla ulrike ursula ute
valentina vanessa vera verena veronika victoria viktoria
waltraud wiebke
yvonne
zoe
`.split(/\s+/).filter(Boolean));

const MAENNER = new Set(`
achim adrian alexander alfred andreas anton armin arne arno axel
ben benedikt benjamin bernd bernhard bjoern bodo boris bruno burkhard
carsten christian christoph christopher claus clemens
daniel david dennis detlef dieter dirk dominik
eberhard eckhard edgar egon elias emil erich erik ernst erwin
fabian felix ferdinand finn florian frank franz fred friedrich fritz
georg gerd gerhard gernot gregor guenter guenther gunnar gustav
hagen hannes hans harald hartmut heiko heiner heinrich heinz helmut hendrik henning henry herbert hermann holger horst hubert
ingo
jakob jan jannik jens joachim jochen joerg johann johannes jonas jonathan josef juergen julian julius justus
kai karl karsten kevin klaus konrad konstantin kurt
lars leon leonard leopold linus lorenz lothar ludwig lukas lucas
malte manfred manuel marc marcel marco marcus mario mark markus martin mathias matthias matteo max maximilian mehmet michael mike moritz murat
nico niklas nils norbert norman
olaf oliver oskar otto
pascal patrick paul peter philipp
rainer ralf ralph reiner reinhard rene richard robert roland rolf roman ruediger rudolf
sascha sebastian siegfried simon stefan steffen stephan sven
theo theodor thilo thomas thorsten tim timo tobias tom torsten
udo ulf ulrich uwe
valentin victor viktor vincent volker
walter werner wilfried wilhelm willi wolfgang
yannick yusuf
`.split(/\s+/).filter(Boolean));

function normal(s) {
  return String(s || '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s\-·,/&+]/g, '');
}

/**
 * 'frau' | 'mann' | '' - nur wenn der ERSTE Vorname eindeutig ist. "Anne-Marie" zaehlt als
 * Anne, "Anne und Paul" als Anne (der erste Name steht vorn, weil er gemeint ist).
 * @param {string} name  Eingabe des Kunden, z. B. "Anne", "Jürgen", "Anna-Lena"
 */
export function werVomNamen(name) {
  const erst = normal(name).split(/[\s\-·,/&+]+/).filter(Boolean)[0] || '';
  if (!erst) return '';
  if (FRAUEN.has(erst)) return 'frau';
  if (MAENNER.has(erst)) return 'mann';
  return '';
}

/** Fuer die Abnahme: wie viele Namen kennen wir? */
export function vornamenStand() {
  return { frauen: FRAUEN.size, maenner: MAENNER.size };
}
