// Pinta los pósteres a JPEG en public/posters (uso: node scripts/posters/render.cjs [nombre…])
// Necesita Playwright con Chromium; los JPEG resultantes se guardan en el repositorio.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const posters = require('./posters.cjs');

(async () => {
  const out = process.env.POSTER_OUT || path.join(__dirname, '../../public/posters');
  fs.mkdirSync(out, { recursive: true });
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(posters);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1400, height: 1400 } });
  for (const n of names) {
    const t = Date.now();
    await p.setContent(`<html><body style="margin:0;background:#000">${posters[n]()}</body></html>`);
    await p.waitForTimeout(200);
    await p.screenshot({ path: path.join(out, `${n}.jpg`), type: 'jpeg', quality: 80, clip: { x: 0, y: 0, width: 1400, height: 1400 } });
    console.log(n, `${Date.now() - t} ms`, `${Math.round(fs.statSync(path.join(out, `${n}.jpg`)).size / 1024)} KB`);
  }
  await b.close();
})();
