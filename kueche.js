// Kueche eines Betriebs (OpenStreetMap cuisine=...) -> Land, dessen Flagge das Haus-Textil
// und das Tuch im Partner-Shop tragen (server.js flaggenLandFuer).

// "wenn wir wissen, dass so ein Italiener ist, dass die italienische Flagge drauf kommt. Beim
// Inder die indische, wenn's ein deutsches Restaurant ist, die deutsche - und so weiter."
// OpenStreetMap fuehrt das als cuisine=... . Hier steht, welches LAND dahintersteht
// (englische Namen, server.js FLAGGEN_LAND macht daraus den Schluessel der Flaggentabelle).
// Kuechen ohne ein eindeutiges Land (regional, burger, vegan, international ...) bekommen NICHTS:
// eine erfundene Flagge waere schlimmer als keine.
// 26. Sept., Markus, nachgeschaerft: "Pizza italienisch, und Gyros wuerde ich meistens sagen
// Grieche, Kebab wuerde ich sagen meistens tuerkisch." Also entscheidet bei diesen dreien der
// haeufigste Fall und nicht die Vorsicht - pizza -> Italien, gyros -> Griechenland,
// kebab/doener -> Tuerkei. "Meistens" heisst: es kann im Einzelfall danebenliegen, und das ist
// ihm lieber als gar keine Flagge.
const KUECHE = {
  italian: 'Italy', pizza: 'Italy', pasta: 'Italy', sicilian: 'Italy', tuscan: 'Italy',
  indian: 'India', pakistani: 'Pakistan', bangladeshi: 'Bangladesh', sri_lankan: 'Sri Lanka',
  german: 'Germany', bavarian: 'Germany', franconian: 'Germany', swabian: 'Germany',
  greek: 'Greece', gyros: 'Greece', souvlaki: 'Greece',
  turkish: 'Turkey', kebab: 'Turkey', doner: 'Turkey', doner_kebab: 'Turkey', turkish_pizza: 'Turkey',
  lebanese: 'Lebanon', syrian: 'Syria',
  persian: 'Iran', iranian: 'Iran', moroccan: 'Morocco', egyptian: 'Egypt', ethiopian: 'Ethiopia',
  chinese: 'China', japanese: 'Japan', sushi: 'Japan', korean: 'South Korea', thai: 'Thailand',
  vietnamese: 'Vietnam', indonesian: 'Indonesia', filipino: 'the Philippines', nepalese: 'Nepal',
  spanish: 'Spain', tapas: 'Spain', portuguese: 'Portugal', french: 'France',
  austrian: 'Austria', swiss: 'Switzerland', dutch: 'the Netherlands', belgian: 'Belgium',
  danish: 'Denmark', swedish: 'Sweden', norwegian: 'Norway', finnish: 'Finland',
  polish: 'Poland', czech: 'Czechia', hungarian: 'Hungary', croatian: 'Croatia',
  serbian: 'Serbia', bosnian: 'Bosnia and Herzegovina', romanian: 'Romania', bulgarian: 'Bulgaria',
  russian: 'Russia', ukrainian: 'Ukraine', georgian: 'Georgia',
  mexican: 'Mexico', brazilian: 'Brazil', argentinian: 'Argentina', peruvian: 'Peru',
  cuban: 'Cuba', jamaican: 'Jamaica', american: 'the United States', irish: 'Ireland',
  british: 'the United Kingdom', english: 'the United Kingdom', scottish: 'the United Kingdom',
  australian: 'Australia', israeli: 'Israel',
  african: '', asian: '', international: '', regional: '', local: '',
  burger: '', steak_house: '', seafood: '', fish: '', vegan: '', vegetarian: '', coffee_shop: ''
};
/** cuisine=... -> Land, dessen Flagge das Haus tragen darf. Unbekannt oder uneindeutig: leer. */
export function kuecheLand(kueche) {
  const k = String(kueche || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return Object.prototype.hasOwnProperty.call(KUECHE, k) ? KUECHE[k] : '';
}
