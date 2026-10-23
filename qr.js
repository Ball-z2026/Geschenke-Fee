// QR-Code als PNG - fuer den Tisch-QR des Partner-Tors (/api/mo/bei/<slug>/qr.png).
import QRCode from 'qrcode';

/** QR als PNG in der gewuenschten Kantenlaenge, dunkel auf hellem Grund, mit Ruhezone. */
export async function qrPng(text, seite, { dunkel = '#111111', hell = '#F7F1E4' } = {}) {
  const s = Math.max(120, Math.round(seite));
  return QRCode.toBuffer(text, { type: 'png', errorCorrectionLevel: 'M', margin: 2, width: s, color: { dark: dunkel, light: hell } });
}
