// Ottos Stimme (Regel 47): Markus spricht ALLE Saetze aus otto-stimme/saetze.json der Reihe nach in EINE Aufnahme,
// mit rund 2 Sekunden Pause dazwischen. Dieses Werkzeug schneidet an den Pausen, bereitet jeden Satz auf und legt
// otto-stimme/<schluessel>.mp3 ab: Trittschall raus (Hochpass 80 Hz), Rauschen leiser (afftdn), Stille vorn/hinten weg,
// gleiche Lautheit (loudnorm -16 LUFS), Mono 44,1 kHz, 128 kbit/s.
// Aufruf: node werkzeug/stimme-aufbereiten.mjs <aufnahme.(m4a|wav|ogg|mp3)> [ffmpeg-pfad]
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const [ein, ff = 'ffmpeg'] = process.argv.slice(2);
if (!ein) { console.error('Aufruf: node werkzeug/stimme-aufbereiten.mjs <aufnahme> [ffmpeg]'); process.exit(1); }
const wurzel = new URL('..', import.meta.url).pathname;
const saetze = Object.keys(JSON.parse(fs.readFileSync(path.join(wurzel, 'otto-stimme/saetze.json'), 'utf8')).saetze);
// 1. Pausen finden (leiser als -38 dB, mindestens 1,2 s) - ffmpeg meldet sie auf stderr
const lauf = spawnSync(ff, ['-hide_banner', '-i', ein, '-af', 'highpass=f=80,silencedetect=noise=-38dB:d=1.2', '-f', 'null', '-'], { encoding: 'utf8' });
const text = String(lauf.stderr || '');
const starts = [...text.matchAll(/silence_start: ([\d.]+)/g)].map(m => +m[1]);
const ends = [...text.matchAll(/silence_end: ([\d.]+)/g)].map(m => +m[1]);
// Sprech-Stuecke = zwischen Ende einer Pause und Beginn der naechsten
const stuecke = []; let von = 0;
for (let i = 0; i < starts.length; i++) { if (starts[i] - von > 0.4) stuecke.push([von, starts[i]]); von = ends[i] ?? starts[i]; }
const dauer = +((text.match(/Duration: (\d+):(\d+):([\d.]+)/) || []).slice(1).reduce((a, x, i) => a + (+x) * [3600, 60, 1][i], 0));
if (dauer && dauer - von > 0.4) stuecke.push([von, dauer]);
console.log('gefunden:', stuecke.length, 'Saetze · erwartet:', saetze.length);
if (stuecke.length !== saetze.length) console.log('ACHTUNG: Anzahl stimmt nicht - bitte Pausen pruefen (Liste unten), nichts wird ueberschrieben.');
stuecke.forEach((s, i) => console.log(String(i + 1).padStart(2), (saetze[i] || '?').padEnd(18), s[0].toFixed(2) + ' - ' + s[1].toFixed(2) + ' s'));
if (stuecke.length !== saetze.length) process.exit(2);
// 2. Je Satz ausschneiden und aufbereiten
for (let i = 0; i < saetze.length; i++) {
  const [a, b] = stuecke[i], ziel = path.join(wurzel, 'otto-stimme', saetze[i] + '.mp3');
  execFileSync(ff, ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(Math.max(0, a - 0.15)), '-to', String(b + 0.25), '-i', ein,
    '-af', 'highpass=f=80,afftdn=nf=-25,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse,loudnorm=I=-16:TP=-1.5:LRA=11',
    '-ac', '1', '-ar', '44100', '-b:a', '128k', ziel]);
  console.log('fertig:', path.relative(wurzel, ziel));
}
