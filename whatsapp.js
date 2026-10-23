// WhatsApp-Nachricht "Dein Motiv ist fertig" (Markus, 2. Okt.: Gaeste beim Partner haben keine
// Moeglichkeit zu sagen, dass sie keine Lust haben zu warten - "WhatsApp und 4").
//
// Weg: WhatsApp Cloud API von Meta (graph.facebook.com). Ein Unternehmen darf einem Kunden nur
// mit einer von Meta FREIGEGEBENEN Vorlage zuerst schreiben. Eingerichtet wird es in Railway:
//   WHATSAPP_TOKEN      dauerhaftes Zugriffstoken (System-Benutzer im Meta Business Manager)
//   WHATSAPP_PHONE_ID   die Telefonnummer-ID des Absenders (nicht die Nummer selbst)
//   WHATSAPP_VORLAGE    Name der Vorlage, Standard "motiv_fertig" (Kategorie Utility, Deutsch)
//   WHATSAPP_SPRACHE    Sprachcode der Vorlage, Standard "de"
// Die Vorlage hat EINEN Platzhalter {{1}} im Text: den Link zum fertigen Motiv.
// Fehlt TOKEN oder PHONE_ID, ist WhatsApp aus und die Seite bietet es nicht an.
//
// Die Nummer ist eine persoenliche Angabe: sie liegt nur am Auftrag, bis die Nachricht raus ist,
// und wird danach geloescht (siehe meldeFertig in server.js).

export function whatsappAn(env) {
  return !!(env && env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_ID);
}

/**
 * Handynummer in die internationale Form ohne "+" (so will sie die Cloud API).
 * Deutsch gedacht: "0171 ..." wird +49, "0049 ..." und "+49 ..." bleiben.
 * Gibt '' zurueck, wenn es keine plausible Handynummer ist.
 */
export function nummerSauber(roh, land = '49') {
  let s = String(roh || '').trim();
  if (!s) return '';
  s = s.replace(/[\s\-\/().]/g, '');
  if (s.startsWith('+')) s = s.slice(1);
  else if (s.startsWith('00')) s = s.slice(2);
  else if (s.startsWith('0')) s = land + s.slice(1);
  if (!/^[1-9]\d{7,14}$/.test(s)) return '';
  return s;
}

/** Fuer Log und Anzeige: nur die letzten drei Ziffern. */
export function nummerVerdeckt(n) {
  const s = String(n || '');
  return s.length > 3 ? '+' + '•'.repeat(Math.max(0, s.length - 3)) + s.slice(-3) : '';
}

export async function whatsappSenden(env, an, link, { fetchFn = fetch } = {}) {
  if (!whatsappAn(env)) throw new Error('WhatsApp ist nicht eingerichtet');
  const nummer = nummerSauber(an);
  if (!nummer) throw new Error('Nummer ungueltig');
  const body = {
    messaging_product: 'whatsapp',
    to: nummer,
    type: 'template',
    template: {
      name: env.WHATSAPP_VORLAGE || 'motiv_fertig',
      language: { code: env.WHATSAPP_SPRACHE || 'de' },
      components: [{ type: 'body', parameters: [{ type: 'text', text: String(link) }] }]
    }
  };
  const r = await fetchFn(`https://graph.facebook.com/v21.0/${encodeURIComponent(env.WHATSAPP_PHONE_ID)}/messages`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.WHATSAPP_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`WhatsApp ${r.status}: ${(j.error && j.error.message) || 'unbekannt'}`.slice(0, 200));
  return { id: j.messages && j.messages[0] ? j.messages[0].id : '' };
}
