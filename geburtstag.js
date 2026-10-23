// Geburtstag: das Alter entscheidet, welche Motive in Frage kommen.
// "Champagnerflasche bei U18 waere ziemlich doof." Genau. Das Alter kommt aus dem Feld
// {alter} oder, wenn das leer ist, aus dem Jahrgang. Daraus eine Altersgruppe, und die
// bringt eigene Motiv-Variationen und eine harte Regel fuer den Prompt mit.

export const GRUPPEN = {
  // bis 12: verspielt, freundlich, bunt - nichts, was nach Party fuer Grosse aussieht
  kind: {
    label: 'Kind',
    regel: 'AUDIENCE: the birthday person is a CHILD. Playful, friendly, colorful, wholesome. '
      + 'Absolutely NO alcohol of any kind - no bottles, glasses, champagne, beer, cocktails, bars, corks, bubbles that read as sparkling wine. '
      + 'No cigarettes, no gambling, no weapons, nothing edgy, dark, sexy or scary.',
    variationen: [
      'the number as candles on a big birthday cake',
      'the number carried by a bunch of party balloons',
      'the number on a superhero shield with a cape flying behind it',
      'the number painted on a rocket blasting off into a starry sky',
      'the number held up by a friendly cartoon dinosaur or animal',
      'the number as a racing number on a rounded shield',
      'the number inside a starburst like a sale sticker',
      'the number as a gold crown with confetti raining down',
      'the number built from colorful building blocks',
      'the number as a treasure-map milestone with a big X',
      'the number spelled with fireworks'
    ]
  },
  // 13 bis 17: cool, modern, energisch - immer noch ohne Alkohol
  jugend: {
    label: 'Jugendliche/r',
    regel: 'AUDIENCE: the birthday person is a TEENAGER (under 18). Cool, energetic, modern - neon, street, gaming, sports. '
      + 'Absolutely NO alcohol - no bottles, glasses, champagne, beer, cocktails, bars, corks. No cigarettes, no gambling, nothing suggestive.',
    variationen: [
      'the number as a neon sign on a dark panel-free glow',
      'the number as a jersey back number with the name above it',
      'the number as a license plate',
      'the number inside a starburst like a sale sticker',
      'the number spelled with fireworks',
      'the number as a racing number on a rounded shield',
      'the number as a milestone road sign',
      'the number as a LEVEL UP badge in a retro gaming style',
      'the number as a graffiti tag with drips and arrows',
      'the number as chunky 3D block numerals with a metallic bevel and confetti',
      'the number on a vintage concert ticket'
    ]
  },
  // 18 bis 39: alles aus dem Original erlaubt
  erwachsen: {
    label: 'Erwachsene/r',
    regel: '',
    variationen: null   // null = die Variationen des Mottos unveraendert
  },
  // ab 40: runde Geburtstage, ein Hauch Vintage und Legende
  reif: {
    label: 'Jubilar/in',
    regel: 'AUDIENCE: an adult milestone birthday. Classy, a little vintage, "legendary" tone - proud, not mocking old age.',
    variationen: [
      'the number on a vintage concert ticket',
      'the number as a rubber stamp with LEGENDARY feel',
      'the number inside a laurel wreath with a crown',
      'the number as a license plate',
      'the number as an ESTABLISHED badge like a whisky label, without any bottle or glass',
      'the number as chunky 3D block numerals with a metallic bevel and confetti',
      'the number built from champagne bubbles and stars',
      'the number as a milestone road sign',
      'the number as a classic car number plate on a chrome bumper',
      'the number spelled with fireworks'
    ]
  }
};

// Alter aus den Eingaben: erst das Feld "alter" (erste Zahl darin), sonst aus dem Jahrgang.
export function alterAus(values, jetzt = new Date()) {
  const v = values || {};
  const a = String(v.alter || '').match(/\d{1,3}/);
  if (a && +a[0] > 0 && +a[0] < 130) return +a[0];
  const j = String(v.jahrgang || '').match(/(19|20)\d{2}/);
  if (j) { const alter = jetzt.getFullYear() - +j[0]; if (alter >= 0 && alter < 130) return alter; }
  return null;
}

export function gruppeFuer(alter) {
  if (alter == null) return 'erwachsen';   // ohne Angabe: die sichere Mitte, kein Kindermotiv fuer einen 50er
  if (alter <= 12) return 'kind';
  if (alter < 18) return 'jugend';
  if (alter < 40) return 'erwachsen';
  return 'reif';
}

// Fuer runJob: welches Motto-Objekt an pickVariation geht und welche Regel an den Prompt haengt.
export function geburtstagRegeln(motto, values) {
  if (!motto || motto.slug !== 'geburtstag') return null;
  const alter = alterAus(values);
  const gruppe = gruppeFuer(alter);
  const g = GRUPPEN[gruppe];
  return {
    alter, gruppe,
    motto: g.variationen ? { ...motto, variations: g.variationen.join('\n') } : motto,
    regel: g.regel ? '\n\n' + g.regel : ''
  };
}

// Fuer die Klick-Vorschlaege: was unter 18 nicht angeboten wird.
// \bbar\b, nicht bar\b - sonst trifft es "Unbezahlbar".
export const U18_TABU = /trink|prost|\bbier|\bwein\b|\bsekt|schnaps|\bbar\b|kater/i;
