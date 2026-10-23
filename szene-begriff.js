// Szene nach Begriff (7. Okt., Markus).
// Ausloeser: ein Spruch-Shirt "Ich kann nicht, ich hab Ruecken" mit einem Maurer drauf - getragen von einer Frau im
// Strassencafe, danach von einem Mann in einer Tischlerwerkstatt. Markus: "Maurer ist doch nicht in einer
// Tischlerwerkstatt?" und "Das muessen wir schon genau machen, und wenn du den Begriff nicht kennst, musst du ihn halt
// jedes Mal recherchieren."
//
// Ablauf je Design (nur Mottos ohne eigenen Anlass oder mit Gewerk: Sprueche, Freestyle, Handwerk):
//   1. Die Text-KI liest aus den Texten des Designs den EINEN Begriff, um den es geht (Beruf, Hobby, Sport, Taetigkeit)
//      und wer es traegt (Maurer -> mann, Maurerin -> frau). Kein klarer Begriff -> keine eigene Szene.
//   2. Je Begriff einmal: nachschlagen (deutsche Wikipedia), dann schreibt die Text-KI den Bestellzettel der Szene -
//      wo genau dieser Mensch arbeitet oder sein Hobby macht (Maurer: Rohbau mit Mauerwerk, Geruest, Mischmaschine;
//      in der Hand die Maurerkelle). Liegt in storage/szenen/begriffe/<schluessel>.json und gilt fuer jedes weitere
//      Design mit diesem Begriff.
//   3. Das Foto: Bilddienst wie bei den Motto-Szenen (Person in weissem Shirt, Magenta-Platzhalter auf der Brust), die
//      schwarze Fassung als Bearbeitung DESSELBEN Fotos (nur das Shirt umgefaerbt - damit laesst sie sich auch in Orange &
//      Co. einfaerben), Flaeche am Platzhalter gemessen, Platzhalter entfernt, auf 1024 px. Ablage als Vorlage
//      tee-szene-thema-b-<schluessel>_<farbe>.png im templates-Ordner, Flaeche in boxen.json (merkeBox).
//   4. Bis das Foto da ist, zeigt die Getragen-Ansicht die bisherige Wahl (Schlagwort-Szene oder Person nach Inhalt).
// Gezeichnet wird im Hintergrund und nur einmal je Begriff (laeuft schon -> nicht noch einmal).
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { generateViaBallz, editViaBallz } from './ballz.js';
import { wikiSummary } from './research.js';
import { szeneThemaAuftrag, szeneSchwarzAuftrag, flaecheAusMagenta, magentaEntfernen, boxNachCover } from './vorlagen.js';
import { merkeBox, templateReady } from './mockups.js';

const BEGRIFF_LESEN = 'You read the texts printed on a German t-shirt design. Decide whether the design is clearly about ONE concrete '
  + 'profession, trade, hobby, sport or activity that has a typical real-world place (e.g. "Maurer", "Krankenschwester", "Angler", '
  + '"Imker", "Feuerwehrmann", "Gamer", "Kegeln"). Generic jokes, moods, food or drinks alone, names and dates are NOT a term. '
  + 'Also decide who wears it: "mann" if the term or text is clearly male (Maurer, Opa, Papa), "frau" if clearly female (Maurerin, '
  + 'Krankenschwester, Oma), otherwise "". Answer ONLY as JSON: {"begriff": "the term in German singular, as a person if it is a '
  + 'profession (Maurer, not Mauern)" or null, "wer": "mann"|"frau"|""}';

const ZETTEL_SCHREIBEN = 'Write the scene for a realistic photo of a person who IS the given term (a profession, hobby or sport), '
  + 'in the place where this person really works or does it in Germany - researched, specific and correct (a bricklayer is on a '
  + 'construction site with brick walls, scaffolding and a cement mixer - never in a carpentry workshop). Use the facts given. '
  + 'Answer ONLY as JSON: {"satz": "English, one sentence: who (age, man/woman as given) and where, with 3-4 typical concrete things '
  + 'of that place behind them, e.g. \'A bricklayer around forty on a residential construction site: half-built brick walls, '
  + 'scaffolding, pallets of bricks and a cement mixer behind him\'", "haelt": "English: ONE typical hand tool or object of the term held '
  + 'low at the side, e.g. \'holding a brick trowel low at his side\' - nothing in front of the chest", "ort": "German, 2-4 words, '
  + 'the place, e.g. \'Auf der Baustelle\'"}. Rules: the person wears a plain t-shirt (work trousers are fine, no jacket, no vest, '
  + 'no apron over the chest), no readable text, no signs, no brand names, no logos anywhere.';

const flach = (s) => String(s || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
export const schluesselVon = (begriff, wer) => (flach(begriff).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) + (wer ? '-' + wer : '')) || '';

export function szenenBegriff({ STORE, openai, env, schnell, gruendlich }) {
  const DIR = path.join(STORE, 'szenen');
  const BEGRIFFE = path.join(DIR, 'begriffe'), DESIGNS = path.join(DIR, 'designs');
  const laeuft = new Map();   // schluessel -> Promise (ein Foto je Begriff, nie doppelt)
  const liest = new Set();    // designId, deren Begriff gerade gelesen wird
  let kette = Promise.resolve();
  const tmpl = path.join(STORE, 'templates');

  const lesenJson = async (f) => { try { return JSON.parse(await fs.readFile(f, 'utf8')); } catch (e) { return null; } };
  const schreiben = async (f, d) => { await fs.mkdir(path.dirname(f), { recursive: true }); await fs.writeFile(f, JSON.stringify(d, null, 2)); };
  const kiJson = async (system, user, extra) => {
    const r = await openai.chat.completions.create({ model: env.QA_MODEL, ...(extra || {}), messages: [{ role: 'system', content: system }, { role: 'user', content: user }] });
    return JSON.parse(String(r.choices[0].message.content || '').trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
  };

  // 1. Begriff des Designs (gemerkt je Design; leer = kein Begriff)
  async function begriffLesen(designId, texte) {
    const f = path.join(DESIGNS, designId + '.json');
    const da = await lesenJson(f); if (da) return da;
    const t = texte.filter(Boolean).join(' | ').slice(0, 1500);
    if (!t || !openai || !env.QA_MODEL || process.env.ABNAHME) return null;
    let j = null;
    try { j = await kiJson(BEGRIFF_LESEN, t, gruendlich()); } catch (e) { console.error('Szene/Begriff lesen:', e && e.message ? e.message : e); return null; }
    const begriff = j && typeof j.begriff === 'string' && j.begriff.trim().length > 1 ? j.begriff.trim().slice(0, 40) : '';
    const wer = j && ['mann', 'frau'].includes(j.wer) ? j.wer : '';
    const out = { begriff, wer: begriff ? (wer || 'mann') : '', schluessel: begriff ? schluesselVon(begriff, wer || 'mann') : '', gelesen: new Date().toISOString() };
    await schreiben(f, out);
    if (begriff) console.log('Szene nach Begriff:', designId, '->', begriff, '(' + out.wer + ')');
    return out;
  }

  // 2. Bestellzettel je Begriff - nachgeschlagen
  async function zettel(begriff, wer, schluessel) {
    const f = path.join(BEGRIFFE, schluessel + '.json');
    const da = await lesenJson(f); if (da && da.satz) return da;
    const wiki = await wikiSummary(begriff);
    const user = 'TERM: ' + begriff + '\nPERSON: ' + (wer === 'frau' ? 'a woman' : 'a man') + ' around thirty to fifty'
      + (wiki ? '\nFACTS (German Wikipedia, "' + wiki.title + '"): ' + wiki.extract : '\nFACTS: none found - use what is generally true for this term in Germany.');
    const j = await kiJson(ZETTEL_SCHREIBEN, user, gruendlich());
    if (!j || !j.satz || !j.haelt) throw new Error('kein Zettel fuer ' + begriff);
    const out = { begriff, wer, schluessel, satz: String(j.satz).replace(/\.\s*$/, ''), haelt: String(j.haelt), ort: String(j.ort || '').slice(0, 40),
      quelle: wiki ? wiki.url : null, stand: 'zettel', erstellt: new Date().toISOString() };
    await schreiben(f, out);
    return out;
  }

  // 3. Das Foto in Weiss und Schwarz, vermessen und abgelegt
  async function fotoBauen(z) {
    const key = 'tee-szene-thema-b-' + z.schluessel;
    if (await templateReady(key, 'white')) throw new Error(key + ' liegt schon da - wird nicht ueberschrieben');
    const prompt = szeneThemaAuftrag('', { zettel: z });
    const weiss = await generateViaBallz(env.BALLZ_MCP_URL, { prompt, size: '1024x1024', task: 'general', background: 'opaque' });
    const schwarz = await editViaBallz(env.BALLZ_MCP_URL, { prompt: szeneSchwarzAuftrag, size: '1024x1024', imageBase64: weiss.png.toString('base64'), mimeType: 'image/png', background: 'opaque', inputFidelity: 'high' });
    const fertig = {};
    for (const [farbe, roh] of [['white', weiss.png], ['black', schwarz.png]]) {
      const { width, height } = await sharp(roh).metadata();
      const box = await flaecheAusMagenta(roh);
      if (!box || !(box.w > 20) || box.w > width * 0.6) throw new Error('Platzhalter nicht sauber gefunden (' + farbe + ')');
      const sauber = await magentaEntfernen(roh, box, { farbe });
      fertig[farbe] = { png: await sharp(sauber).flatten({ background: '#ffffff' }).resize({ width: 1024, height: 1024, fit: 'cover', position: 'centre' }).png().toBuffer(), box: boxNachCover(box, width, height) };
    }
    // Schwarz ist dasselbe Foto - die Flaeche darf nur wenig wandern, sonst passt das Einfaerben nicht
    const a = fertig.white.box, b = fertig.black.box;
    if (Math.abs(a.x - b.x) > 40 || Math.abs(a.y - b.y) > 40 || Math.abs(a.w - b.w) > 50) throw new Error('schwarze Fassung weicht ab');
    await fs.mkdir(tmpl, { recursive: true });
    for (const farbe of ['white', 'black']) {
      await fs.writeFile(path.join(tmpl, key + '_' + farbe + '.png'), fertig[farbe].png);
      await merkeBox(STORE, key + '_' + farbe, fertig[farbe].box);
    }
    await schreiben(path.join(BEGRIFFE, z.schluessel + '.json'), { ...z, stand: 'fertig', fertig: new Date().toISOString(), box: fertig.white.box });
    console.log('Szene nach Begriff fertig:', z.begriff, '->', key);
  }

  // Fuer ein Design: gibt es die Szene schon? Sonst im Hintergrund lesen/nachschlagen/zeichnen. Antwort sofort.
  async function szeneFuer(designId, texte) {
    const id = String(designId || '').replace(/[^A-Za-z0-9_-]/g, '');
    if (!id) return '';
    const d = await lesenJson(path.join(DESIGNS, id + '.json'));
    if (d && d.schluessel && await templateReady('tee-szene-thema-b-' + d.schluessel, 'white') && await templateReady('tee-szene-thema-b-' + d.schluessel, 'black')) return 'b-' + d.schluessel;
    anstossen(id, texte, d);
    return '';
  }
  function anstossen(id, texte, schonGelesen) {
    if (!openai || !env.QA_MODEL || process.env.ABNAHME || liest.has(id)) return;
    if (schonGelesen && !schonGelesen.schluessel) return;   // kein Begriff - nichts zu tun
    liest.add(id);
    // nacheinander, nie viele zugleich (Band und Schaufenster fragen viele Designs auf einmal an)
    kette = kette.then(() => (async () => {
      const d = schonGelesen || await begriffLesen(id, texte);
      if (!d || !d.schluessel) return;
      if (laeuft.has(d.schluessel)) return laeuft.get(d.schluessel);
      // Liegt die Szene schon (mitgeliefert aus dem Repo oder frueher erzeugt), wird NIE neu fotografiert - sonst
      // laege ein ungeprueftes Foto ueber einem angesehenen (7. Okt., live: Maurer-Szene ueberschrieben).
      if (await templateReady('tee-szene-thema-b-' + d.schluessel, 'white') && await templateReady('tee-szene-thema-b-' + d.schluessel, 'black')) return;
      const st = await lesenJson(path.join(BEGRIFFE, d.schluessel + '.json'));
      if (st && (st.stand === 'fertig' || (st.fehler && Date.now() - Date.parse(st.fehlerZeit || 0) < 6 * 3600e3))) return;
      const p = (async () => {
        try { await fotoBauen(await zettel(d.begriff, d.wer, d.schluessel)); }
        catch (e) {
          console.error('Szene nach Begriff (' + d.begriff + '):', e && e.message ? e.message : e);
          const alt = (await lesenJson(path.join(BEGRIFFE, d.schluessel + '.json'))) || { begriff: d.begriff, wer: d.wer, schluessel: d.schluessel };
          await schreiben(path.join(BEGRIFFE, d.schluessel + '.json'), { ...alt, fehler: String(e && e.message ? e.message : e).slice(0, 200), fehlerZeit: new Date().toISOString() });
        } finally { laeuft.delete(d.schluessel); }
      })();
      laeuft.set(d.schluessel, p);
      return p;
    })().catch(e => console.error('Szene nach Begriff:', e && e.message ? e.message : e)).finally(() => liest.delete(id)));
  }
  async function liste() {
    const out = [];
    try { for (const f of await fs.readdir(BEGRIFFE)) if (f.endsWith('.json')) out.push(await lesenJson(path.join(BEGRIFFE, f))); } catch (e) { /* noch keine */ }
    return out.filter(Boolean);
  }
  return { szeneFuer, begriffLesen, zettel, liste, laeuft };
}
