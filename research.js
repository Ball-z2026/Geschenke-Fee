import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

// Motto-Recherche (Abi-Motto, Schulmotto): Wortspiel aufloesen, Quelle nachschlagen, Bildwelt festlegen.
// Analog zur Orts-Recherche bei kiezfashion: erst Fakten holen, dann daraus den Prompt bauen.

const SYS = `You are the art director of a German T-shirt print shop. Students send you their class motto (Abi-Motto / Schulmotto).
Most mottos are puns that hide the word ABI (or a year, school type or class) inside a known word, title, brand, film, game, place or phrase - for example "ABIkropolis" (Akropolis), "HABIbi", "ABInauten" (astronauts), "ABIos Amigos", "KABIverse", "ABIgail", "ABI Vegas", "FABIulous".
Your job: explain the pun, name the source it plays on, and define a picture for a shirt print.
Answer ONLY with JSON:
{
 "pun_source": "the word/title/thing the motto plays on, or null if it is not a pun",
 "wiki_title": "German Wikipedia article title for the source, or null",
 "theme": "one sentence: what world the design lives in",
 "motifs": ["4-7 concrete visual elements that clearly evoke the source, most important first"],
 "palette": "3-4 colors that fit the source, light lettering-friendly",
 "lettering": "what kind of lettering fits (e.g. Greek-temple capitals, space-age chrome, neon script)",
 "avoid": ["things not to draw: real logos, trademarks, recognizable persons, copyrighted characters"],
 "tagline": "an optional short German secondary line that fits the pun, or null"
}
Rules: never suggest drawing a real trademark, brand logo or a copyrighted character - describe the style and generic elements instead (a superhero silhouette, not a specific one). Keep motifs printable as bold flat vector shapes.`;

export async function wikiSummary(title) {
  if (!title) return null;
  try {
    const r = await fetch('https://de.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(String(title).replace(/ /g, '_')), {
      headers: { 'user-agent': 'motto-otto/1.0 (kontakt@motto-otto.de)' }, signal: AbortSignal.timeout(10000)
    });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j.extract) return null;
    return { title: j.title, extract: String(j.extract).slice(0, 700), url: j.content_urls && j.content_urls.desktop ? j.content_urls.desktop.page : null };
  } catch (e) { return null; }
}

export async function researchMotto({ openai, model, storeDir, motto, context, bezug }) {
  const ref = String(bezug || '').trim();
  const key = crypto.createHash('sha1').update(String(motto).toLowerCase().trim() + '|' + ref.toLowerCase() + '|' + String(context || '')).digest('hex').slice(0, 16);
  const dir = path.join(storeDir, 'research');
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, key + '.json');
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch (e) { /* neu */ }
  if (!openai) return null;

  const ask = async (extra) => {
    const res = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYS },
        { role: 'user', content: `Motto: "${motto}"${ref ? `\nThe customer explicitly states what the motto plays on: "${ref}". Treat THIS as the definitive source - do not guess a different one. Set pun_source to it and build motifs, palette and lettering strongly and specifically from it.` : ''}${context ? `\nContext: ${context}` : ''}${extra ? `\n${extra}` : ''}` }
      ]
    });
    const raw = String(res.choices[0].message.content || '').replace(/```json|```/g, '').trim();
    return JSON.parse(raw);
  };

  // Wenn der Kunde einen Bezug angibt, diesen direkt bei Wikipedia validieren und
  // dem Modell als Grundlage geben (statt das Wortspiel nur zu raten).
  let wiki = ref ? await wikiSummary(ref) : null;
  let card = await ask(wiki ? `Wikipedia says about "${wiki.title}": ${wiki.extract}\nUse these facts as the truth about the source.` : '');
  if (!wiki) wiki = await wikiSummary(card.wiki_title || card.pun_source);
  if (wiki) {
    // Wenn wir die Quelle erst nach dem ersten Durchgang gefunden haben, noch einmal verfeinern.
    if (!ref) {
      try { card = await ask(`Wikipedia says about "${wiki.title}": ${wiki.extract}\nRefine motifs and palette so they match this source precisely. Keep the JSON format.`); }
      catch (e) { /* erste Karte behalten */ }
    }
    card.wiki = wiki;
  }
  if (ref && !card.pun_source) card.pun_source = ref;
  card.bezug = ref || null;
  card.motto = motto;
  card.created = new Date().toISOString();
  await fs.writeFile(file, JSON.stringify(card, null, 2));
  return card;
}

// ---------------- Lieblingsverein (lizenzfrei) ----------------
// Recherchiert NUR Fakten (Heimatstadt, traditionelle Vereinsfarben) und generische
// Fan-Bildwelt. Es wird bewusst KEIN Wappen, Logo, Maskottchen, keine Wortmarke und kein
// Sponsor uebernommen - so entsteht originelle Fan-Kunst ohne Lizenzproblem.
const SYS_CLUB = `You are the art director of a German T-shirt print shop making UNOFFICIAL fan art for someone's favourite sports club (mostly football).
You must build an ORIGINAL, licence-safe design. Use only FACTS that are free to use (the club's home city/region and its traditional team colours) plus GENERIC fan imagery.
You must NEVER reproduce anything protected: no official club crest/badge/coat of arms, no club logo or logo-style wordmark, no mascot, no sponsor logos, no league logos, no player likenesses, no copyrighted slogans.
Answer ONLY with JSON:
{
 "club": "the club as understood",
 "city": "home city or district the club belongs to",
 "region": "region/state, or null",
 "colors": ["2-3 traditional team colours in plain English, e.g. black, yellow"],
 "palette": "the traditional colours as a printable, lettering-friendly palette",
 "landmarks": ["2-4 REAL, recognizable, freely depictable landmarks of the city that make a fitting skyline silhouette - historic towers, churches, gates, town hall, TV/olympic tower etc. (e.g. Munich: the twin onion-dome towers of the Frauenkirche, the neo-gothic town hall tower, the Olympic Tower; avoid modern buildings with special image rights). NEVER the club's stadium name or anything trademarked."],
 "motifs": ["4-6 GENERIC fan elements that evoke the club WITHOUT any protected mark: e.g. a plain fan scarf in the team colours, a generic football, a stylised silhouette of the city's real landmarks, the founding year, striped bars in the team colours"],
 "lettering": "what lettering fits (a bold sporty block, a vintage jersey serif, etc.) - NOT the club's real logo font",
 "avoid": ["official crest / badge", "club logo or wordmark styling", "mascot", "sponsor logos", "league logos", "player faces"],
 "tagline": "an optional short GENERIC German fan line (no protected slogan), or null"
}
Rules: the design must be recognizable to fans through CITY + COLOURS + generic football culture only, never through a protected mark. Keep motifs printable as bold flat vector shapes.`;

export async function researchClub({ openai, model, storeDir, club, extra }) {
  const name = String(club || '').trim();
  if (!name) return null;
  const wish = String(extra || '').trim().slice(0, 80);
  const key = 'club_' + crypto.createHash('sha1').update(name.toLowerCase() + '|' + wish.toLowerCase()).digest('hex').slice(0, 16);
  const dir = path.join(storeDir, 'research');
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, key + '.json');
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch (e) { /* neu */ }
  if (!openai) return null;

  const wiki = await wikiSummary(name);
  const res = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: SYS_CLUB },
      { role: 'user', content: `Favourite club: "${name}"${wiki ? `\nWikipedia says about "${wiki.title}": ${wiki.extract}\nUse these facts for city and colours.` : ''}${wish ? `\nThe fan especially wants these worked in as licence-safe motifs (e.g. a district, a stadium as a generic silhouette, a fan nickname vibe): "${wish}". Reflect this in the motifs/landmarks, but never as a real logo, sponsor name or trademark.` : ''}` }
    ]
  });
  const raw = String(res.choices[0].message.content || '').replace(/```json|```/g, '').trim();
  let card; try { card = JSON.parse(raw); } catch (e) { return null; }
  if (wiki) card.wiki = wiki;
  card.kind = 'verein';
  card.club = card.club || name;
  card.created = new Date().toISOString();
  await fs.writeFile(file, JSON.stringify(card, null, 2));
  return card;
}

export function researchClubPrompt(card, opts = {}) {
  if (!card) return '';
  const col = Array.isArray(card.colors) ? card.colors.join(', ') : (card.palette || '');
  // Fanclub (freigabepflichtig, Nachweis statt Markensperre): Vereinsname und -farben duerfen verwendet werden.
  // Das echte Wappen zeichnet die KI trotzdem NICHT (wuerde nur eine verzerrte Imitation) - es kommt
  // als Original ueber den Logo-Upload in die freie Flaeche.
  if (opts.fanclub) {
    const club = opts.club || card.club || card.name || '';
    const lines = ['FAN CLUB BRIEF (supporters club of a real football club):'];
    if (club) lines.push(`- Supported club: ${club}. Its name may appear as text exactly where the layout asks for it.`);
    if (col) lines.push(`- Club colours (make these the dominant colours of the whole design): ${col}.`);
    if (card.city) lines.push(`- Home city/region: ${card.city}${card.region ? ', ' + card.region : ''}.`);
    if (card.landmarks && card.landmarks.length) lines.push(`- Landmarks that may frame the composition: ${card.landmarks.slice(0, 4).join('; ')}.`);
    if (card.motifs && card.motifs.length) lines.push(`- Fan elements to use: ${card.motifs.slice(0, 6).join('; ')}.`);
    if (card.lettering) lines.push(`- Lettering: ${card.lettering}.`);
    lines.push('- Do NOT draw the club\'s emblem, crest or badge anywhere - the real emblem is placed into the empty area afterwards.');
    return lines.join('\n');
  }
  // Bewusst POSITIV formuliert und ohne Marken-/Logo-Aufzaehlung: eine solche Litanei
  // ("official crest, sponsor logos, player faces" ...) triggert die Content-Filter der
  // Bildmodelle und fuehrt zu Verweigerungen. Wir geben nur freie Fakten weiter.
  const lines = ['FAN DESIGN BRIEF (original artwork built from a city and its sports colours):'];
  if (card.city) lines.push(`- Home city/region: ${card.city}${card.region ? ', ' + card.region : ''}. Feature the CITY name prominently.`);
  if (col) lines.push(`- Team colours (make these the dominant colours of the whole design): ${col}.`);
  if (card.landmarks && card.landmarks.length) lines.push(`- If a city skyline/silhouette appears, build it from these REAL landmarks of the city (not generic skyscrapers): ${card.landmarks.slice(0, 4).join('; ')}.`);
  if (card.motifs && card.motifs.length) lines.push(`- Fan elements to use: ${card.motifs.slice(0, 6).join('; ')}.`);
  if (card.lettering) lines.push(`- Lettering: ${card.lettering}.`);
  lines.push('- Use only original lettering, the city name and the team colours plus generic football imagery. Keep it a fully original artwork.');
  return lines.join('\n');
}

// Text fuer den Prompt
export function researchPrompt(card) {
  if (!card) return '';
  const lines = [`THEME RESEARCH for the motto "${card.motto}" (use this to build the picture):`];
  if (card.bezug) lines.push(`- The customer says the motto plays on: ${card.bezug}. The whole picture world MUST clearly evoke this at first glance.`);
  if (card.pun_source) lines.push(`- The motto is a pun on: ${card.pun_source}${card.wiki ? ` - ${card.wiki.extract.slice(0, 180)}` : ''}`);
  if (card.theme) lines.push(`- World of the design: ${card.theme}`);
  if (card.motifs && card.motifs.length) lines.push(`- Visual elements to use (most important first): ${card.motifs.slice(0, 6).join('; ')}`);
  if (card.palette) lines.push(`- Palette: ${card.palette}`);
  if (card.lettering) lines.push(`- Lettering: ${card.lettering}`);
  if (card.avoid && card.avoid.length) lines.push(`- Do not draw: ${card.avoid.join('; ')}`);
  lines.push('- The motto itself must be written exactly as given, letter by letter, including its unusual capitalization.');
  return lines.join('\n');
}
