// Iconos de la app:
// - build/icons/app.ico      → «Di en Di.exe» (el goblin de la app)
// - build/icons/server.ico   → «Di en Di - Servidor.exe» (el goblin con un icono de conexión tipo wifi en la esquina)
// - public/design/retro/icon-*.png → icono del estilo «Retro 16-bit» (un d20 en pixel art)
// Uso: node scripts/icons/make-icons.cjs   (necesita Playwright y ImageMagick: «magick» o «convert»)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '../..');
const out = path.join(root, 'build/icons');
const retro = path.join(root, 'public/design/retro');
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(retro, { recursive: true });
const goblin = `data:image/png;base64,${fs.readFileSync(path.join(root, 'public/icon-512.png')).toString('base64')}`;

// Insignia de conexión (ondas de wifi en pixel art) para el servidor
const wifiBadge = (size) => {
  const u = size / 16; // rejilla de 16×16 «píxeles»
  const px = (x, y, c) => `<rect x="${x * u}" y="${y * u}" width="${u}" height="${u}" fill="${c}"/>`;
  const cells = [];
  const arc = (r, c) => { for (let a = 0; a <= 180; a += 4) { const x = Math.round(8 + Math.cos((a * Math.PI) / 180) * r); const y = Math.round(12 - Math.sin((a * Math.PI) / 180) * r); if (a >= 30 && a <= 150) cells.push([x, y, c]); } };
  arc(7, '#7ef0a0'); arc(4.6, '#7ef0a0'); arc(2.3, '#7ef0a0');
  const uniq = [...new Map(cells.map((c) => [`${c[0]},${c[1]}`, c])).values()];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">
    <rect x="${u}" y="${u}" width="${14 * u}" height="${14 * u}" fill="#0e2a1a" stroke="#000" stroke-width="${u}"/>
    ${uniq.map(([x, y, c]) => px(x, y, c)).join('')}
    ${px(7, 12, '#7ef0a0')}${px(8, 12, '#7ef0a0')}${px(7, 11, '#7ef0a0')}${px(8, 11, '#7ef0a0')}
  </svg>`;
};

// d20 pixel art para el estilo retro
const d20 = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" shape-rendering="crispEdges">
  <rect width="32" height="32" fill="#1b1030"/>
  <polygon points="16,2 29,9 29,23 16,30 3,23 3,9" fill="#8a1b22"/>
  <polygon points="16,2 29,9 16,11 3,9" fill="#c8323a"/>
  <polygon points="16,11 29,9 29,23 23,21" fill="#6a1219"/>
  <polygon points="16,11 3,9 3,23 9,21" fill="#a8242c"/>
  <polygon points="16,11 23,21 9,21" fill="#e04650"/>
  <polygon points="9,21 23,21 16,30" fill="#7a1820"/>
  <g fill="#ffe066">${['111', '001', '111', '100', '111'].map((r, y) => [...r].map((v, x) => (v === '1' ? `<rect x="${12 + x}" y="${14 + y}" width="1" height="1"/>` : '')).join('')).join('')}${['111', '101', '101', '101', '111'].map((r, y) => [...r].map((v, x) => (v === '1' ? `<rect x="${17 + x}" y="${14 + y}" width="1" height="1"/>` : '')).join('')).join('')}</g>
  <path d="M16 2l13 7v14l-13 7-13-7V9z" fill="none" stroke="#000" stroke-width="1"/>
</svg>`;

const magick = () => { for (const cmd of ['magick', 'convert']) { try { execFileSync(cmd, ['-version'], { stdio: 'ignore' }); return cmd; } catch { /* siguiente */ } } throw new Error('Falta ImageMagick'); };

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 512, height: 512 } });
  // Servidor: goblin + insignia wifi abajo a la derecha
  await p.setContent(`<html><body style="margin:0;background:transparent">
    <div style="position:relative;width:512px;height:512px">
      <img src="${goblin}" style="width:512px;height:512px;image-rendering:pixelated">
      <div style="position:absolute;right:0;bottom:0;width:224px;height:224px">${wifiBadge(224)}</div>
    </div></body></html>`);
  await p.waitForTimeout(150);
  await p.screenshot({ path: path.join(out, 'server-512.png'), omitBackground: true, clip: { x: 0, y: 0, width: 512, height: 512 } });
  // d20 retro
  await p.setContent(`<html><body style="margin:0">${d20.replace('width="32" height="32"', 'width="512" height="512"')}</body></html>`);
  await p.waitForTimeout(100);
  await p.screenshot({ path: path.join(retro, 'icon-512.png'), clip: { x: 0, y: 0, width: 512, height: 512 } });
  await b.close();

  const m = magick();
  fs.copyFileSync(path.join(root, 'public/icon-512.png'), path.join(out, 'app-512.png'));
  const ico = (src, dst) => execFileSync(m, [src, '-filter', 'point', '-define', 'icon:auto-resize=256,128,64,48,32,16', dst]);
  ico(path.join(out, 'app-512.png'), path.join(out, 'app.ico'));
  ico(path.join(out, 'server-512.png'), path.join(out, 'server.ico'));
  for (const s of [64, 192]) execFileSync(m, [path.join(retro, 'icon-512.png'), '-filter', 'point', '-resize', `${s}x${s}`, path.join(retro, `icon-${s}.png`)]);
  console.log('Iconos listos:', fs.readdirSync(out).join(', '), '·', fs.readdirSync(retro).filter((f) => f.startsWith('icon')).join(', '));
})();
