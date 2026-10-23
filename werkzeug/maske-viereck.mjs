// Rechteckige Flaeche (Fussmatte): die vier Ecken der Weiss-Maske als Viereck fuellen - ein
// angebissener Eckbereich (dunkler Stein im Foto) bleibt so trotzdem bedruckbar.
import sharp from 'sharp';
import fs from 'node:fs/promises';
const MK = await import('../mockups.js');
const [,, eingabe, ausgabe] = process.argv;
const k = await MK.maskeKanten(await fs.readFile(eingabe));
const [TL, TR, BR, BL] = k.ecken;
const svg = `<svg width="1024" height="1024"><rect width="1024" height="1024" fill="#000"/><polygon points="${TL.x},${TL.y} ${TR.x},${TR.y} ${BR.x},${BR.y} ${BL.x},${BL.y}" fill="#fff"/></svg>`;
await sharp(Buffer.from(svg)).png().toFile(ausgabe);
console.log(JSON.stringify({ ecken: k.ecken, box: k.box }));
