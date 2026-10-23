// Nimmt video/konsens.html als Video auf - der Bildschirmteil des Erklaervideos.
//
//   cd /pfad/zu/motto-otto
//   npm i -D playwright-core          (einmalig, falls nicht da)
//   node video/aufnahme.cjs
//
// Ergebnis: video/konsens.webm, 1080x1920, rund 58 s. In CapCut laesst sich das direkt einsetzen;
// wer MP4 braucht: ffmpeg -i konsens.webm -c:v libx264 -crf 18 -pix_fmt yuv420p konsens.mp4
//
// Chromium wird dort gesucht, wo Playwright ihn ablegt (PLAYWRIGHT_BROWSERS_PATH) - mit CHROME=<pfad>
// laesst sich ein anderer Browser vorgeben.
const path = require('path');
const fs = require('fs');

const DAUER_MS = 59000;         // etwas laenger als die 57 s der Animation, damit das Ende steht
const BREITE = 1080, HOEHE = 1920;

(async () => {
  const { chromium } = require('playwright-core');
  const datei = 'file://' + path.resolve(__dirname, 'konsens.html') + '?aufnahme=1';  // 1:1, ohne Bedienleiste
  const ziel = path.resolve(__dirname);

  const start = {
    args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required']
  };
  if (process.env.CHROME) start.executablePath = process.env.CHROME;

  const browser = await chromium.launch(start);
  const ctx = await browser.newContext({
    viewport: { width: BREITE, height: HOEHE },
    recordVideo: { dir: ziel, size: { width: BREITE, height: HOEHE } }
  });
  const page = await ctx.newPage();
  await page.goto(datei, { waitUntil: 'load' });
  await page.waitForTimeout(DAUER_MS);
  const video = page.video();
  await ctx.close();                 // erst beim Schliessen wird das Video geschrieben
  const roh = await video.path();
  const fertig = path.join(ziel, 'konsens.webm');
  fs.renameSync(roh, fertig);
  await browser.close();
  console.log('fertig:', fertig, '·', Math.round(fs.statSync(fertig).size / 1024), 'KB');
})().catch(e => { console.error(e); process.exit(1); });
