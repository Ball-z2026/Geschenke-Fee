// Vektorisierung der Druckdateien: aus dem freigestellten PNG-Master wird eine mehrfarbige SVG.
// Werkzeug: vtracer (VisionCortex) ueber sein Python-Paket - im Docker-Image installiert (siehe Dockerfile).
// Transparente Pixel behandelt vtracer als Hintergrund (Keying), die SVG hat also keinen Hintergrund.
//
// Einbindung in server.js:
//   import { vectorizeMaster, vectorReady } from './vectorize.js';
//   - Route  GET /api/mo/master/:id.svg   (siehe Code-Block)
//   - in pushToDrive zusaetzlich die SVG hochladen
//   - auf /druck einen SVG-Link anzeigen
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import sharp from 'sharp';

const PY = `
import sys, vtracer
src, dst = sys.argv[1], sys.argv[2]
vtracer.convert_image_to_svg_py(
    src, dst,
    colormode='color',        # mehrfarbig
    hierarchical='stacked',   # Flaechen uebereinander (sauberer Druck, keine Luecken)
    mode='spline',            # Kurven statt Polygone
    filter_speckle=int(sys.argv[3]),   # Kruemel unter n Pixeln weg
    color_precision=6,        # Farbtiefe der Cluster
    layer_difference=24,      # Mindestabstand zwischen Farbschichten
    corner_threshold=60,
    length_threshold=4.0,
    max_iterations=10,
    splice_threshold=45,
    path_precision=3
)
`;

let ready = null;
export async function vectorReady() {
  if (ready !== null) return ready;
  ready = await new Promise((resolve) => {
    const p = spawn('python3', ['-c', 'import vtracer; print("ok")']);
    let out = '';
    p.stdout.on('data', d => { out += d; });
    p.on('error', () => resolve(false));
    p.on('close', () => resolve(out.includes('ok')));
  });
  return ready;
}

// pngBuffer: freigestellter Master (RGBA). Liefert die SVG als String.
// width: Arbeitsbreite fuer die Vektorisierung (Standard 2048 px - reicht fuer saubere Kurven und ist schnell)
export async function vectorizeMaster(pngBuffer, opts = {}) {
  if (!(await vectorReady())) throw new Error('vtracer nicht installiert');
  const width = Math.min(Math.max(+opts.width || +process.env.VECTOR_WIDTH || 2048, 512), 4096);
  const speckle = Math.max(+opts.speckle || 8, 1);
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'mo-vec-'));
  const src = path.join(tmp, 'in.png'), dst = path.join(tmp, 'out.svg');
  try {
    const meta = await sharp(pngBuffer).metadata();
    let img = sharp(pngBuffer).ensureAlpha();
    if (meta.width > width) img = img.resize({ width, kernel: 'lanczos3' });
    // halbtransparente Kanten hart machen, sonst entstehen Saum-Cluster
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    for (let i = 3; i < data.length; i += 4) data[i] = data[i] < 128 ? 0 : 255;
    await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(src);

    await new Promise((resolve, reject) => {
      const p = spawn('python3', ['-c', PY, src, dst, String(speckle)], { stdio: ['ignore', 'ignore', 'pipe'] });
      let err = '';
      p.stderr.on('data', d => { err += d; });
      const t = setTimeout(() => { p.kill('SIGKILL'); reject(new Error('vtracer Zeitueberschreitung')); }, 180000);
      p.on('error', e => { clearTimeout(t); reject(e); });
      p.on('close', code => { clearTimeout(t); code === 0 ? resolve() : reject(new Error('vtracer Fehler ' + code + ': ' + err.slice(0, 300))); });
    });

    let svg = await fs.readFile(dst, 'utf8');
    // Echte Druckmasse in die SVG schreiben: Masterbreite bei 300 dpi
    // Fassung 35: die dpi stehen im PNG (pHYs) - dieselbe Zahl wie in der PNG- und PDF-Druckdatei
    const dpi = meta.density && meta.density >= 72 ? Math.round(meta.density) : (+process.env.PRINT_DPI || 300);
    const wIn = meta.width / dpi, hIn = meta.height / dpi;
    svg = svg.replace(/<svg([^>]*?)\swidth="[^"]*"\s+height="[^"]*"/, (m, a) => `<svg${a} width="${wIn.toFixed(3)}in" height="${hIn.toFixed(3)}in"`);
    if (!/viewBox=/.test(svg)) svg = svg.replace('<svg', `<svg viewBox="0 0 ${info.width} ${info.height}"`);
    svg = svg.replace('<svg', '<!-- Motto Otto Druckdatei (Vektor) -->\n<svg');
    return svg;
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}
