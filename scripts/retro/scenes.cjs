// Fondos pixel-art provisionales del estilo «Retro 16-bit» (320×320, paleta limitada y tramado).
// Mantienen las ideas de los pósteres (ocaso, bosque, cumbres, abismo, mar, mazmorra, ciudadela, cripta).
// Se sustituyen por las imágenes de IA con scripts/retro/import-ai-art.cjs (mismos nombres).
// Uso: node scripts/retro/scenes.cjs [nombre…]   → public/design/retro/<nombre>.png
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Código que se ejecuta en el navegador: pinta la escena en un canvas de 320×320
const painter = `
const W = 320, H = 320;
const BAYER = [[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
let seed = 1;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const hex = (h) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
function paint(cfg) {
  seed = cfg.seed;
  const c = document.createElement('canvas'); c.width = W; c.height = H; document.body.appendChild(c);
  const g = c.getContext('2d');
  const img = g.createImageData(W, H);
  const px = (x, y, col) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 4; img.data[i] = col[0]; img.data[i+1] = col[1]; img.data[i+2] = col[2]; img.data[i+3] = 255; };
  // Cielo en bandas con tramado ordenado
  const sky = cfg.sky.map(hex);
  for (let y = 0; y < H; y++) {
    const t = Math.pow(y / (H * cfg.horizon), 1) * (sky.length - 1);
    for (let x = 0; x < W; x++) {
      const k = Math.min(sky.length - 1, Math.max(0, t + (BAYER[y % 4][x % 4] / 16 - 0.5)));
      px(x, y, sky[Math.floor(k)] );
    }
  }
  // Estrellas
  for (let i = 0; i < (cfg.stars || 0); i++) { const x = Math.floor(rnd() * W), y = Math.floor(rnd() * H * cfg.horizon * 0.8); px(x, y, rnd() > 0.8 ? [255,255,220] : [200,200,240]); }
  // Astro (sol o luna) con halo tramado
  if (cfg.orb) {
    const [ox, oy, r] = cfg.orb; const col = hex(cfg.orbColor), halo = hex(cfg.haloColor || cfg.orbColor);
    for (let y = -r * 2; y <= r * 2; y++) for (let x = -r * 2; x <= r * 2; x++) {
      const d = Math.sqrt(x * x + y * y);
      if (d <= r) px(ox + x, oy + y, col);
      else if (d <= r * 1.9 && (BAYER[(oy + y + 64) % 4][(ox + x + 64) % 4] / 16) < (1 - (d - r) / (r * 0.9)) * 0.55) px(ox + x, oy + y, halo);
    }
    if (cfg.moonShadow) for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (Math.hypot(x - r * 0.45, y - r * 0.2) <= r * 0.9 && Math.hypot(x, y) <= r) px(ox + x, oy + y, sky[1]);
  }
  // Aurora
  if (cfg.aurora) { const col = hex(cfg.aurora); for (let x = 0; x < W; x++) { const yc = 60 + Math.sin(x / 23) * 14 + Math.sin(x / 9) * 4; for (let y = 0; y < 26; y++) if (BAYER[(y) % 4][x % 4] / 16 < 0.7 - y / 40) px(x, Math.floor(yc + y), col); } }
  // Cordilleras por capas (desplazamiento del punto medio)
  const ridge = (base, rough, col, peaks) => {
    let pts = [base + (rnd() - 0.5) * rough, base + (rnd() - 0.5) * rough]; let span = rough;
    while (pts.length < W + 1) { const n = []; for (let i = 0; i < pts.length - 1; i++) { n.push(pts[i]); n.push((pts[i] + pts[i+1]) / 2 + (rnd() - 0.5) * span); } n.push(pts[pts.length - 1]); pts = n; span *= 0.55; }
    const sc = pts.length / W; const color = hex(col);
    for (let x = 0; x < W; x++) { let top = Math.floor(pts[Math.floor(x * sc)]); if (peaks) top -= Math.floor(Math.max(0, Math.sin(x / peaks.w) * peaks.h)); for (let y = top; y < H; y++) px(x, y, color); if (cfg.snow && top < base - 6) for (let y = top; y < top + 3; y++) px(x, y, [235, 240, 255]); }
  };
  (cfg.ridges || []).forEach((r) => ridge(r[0], r[1], r[2], r[3]));
  g.putImageData(img, 0, 0);
  // Siluetas de primer plano (formas simples)
  const fill = (col) => { g.fillStyle = col; };
  for (const s of cfg.shapes || []) {
    fill(s.c);
    if (s.t === 'rect') g.fillRect(s.x, s.y, s.w, s.h);
    if (s.t === 'tri') { g.beginPath(); g.moveTo(s.x, s.y + s.h); g.lineTo(s.x + s.w / 2, s.y); g.lineTo(s.x + s.w, s.y + s.h); g.fill(); }
    if (s.t === 'pines') for (let i = 0; i < s.n; i++) { const x = Math.floor(rnd() * W), hgt = s.h * (0.6 + rnd() * 0.6), y = s.y + rnd() * 8; for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(x - (hgt / 5) * (5 - k) * 0.45, y - k * hgt / 6 + hgt * 0.15); g.lineTo(x, y - hgt + k * 2 - k * hgt / 8); g.lineTo(x + (hgt / 5) * (5 - k) * 0.45, y - k * hgt / 6 + hgt * 0.15); g.fill(); } g.fillRect(x - 1, y, 3, 30); }
    if (s.t === 'castle') { const { x, y, w } = s; g.fillRect(x, y, w, 60); for (let i = 0; i < w; i += 8) g.fillRect(x + i, y - 5, 4, 5); [[x - 8, 30], [x + w - 6, 34], [x + w / 2 - 7, 48]].forEach(([tx, th]) => { g.fillRect(tx, y - th, 14, th + 60); for (let i = 0; i < 14; i += 4) g.fillRect(tx + i, y - th - 4, 2, 4); }); g.fillStyle = s.win; [[x + 10, y + 14], [x + w - 18, y + 20], [x + w / 2 - 2, y - 30], [x + 30, y + 26]].forEach(([wx, wy]) => g.fillRect(wx, wy, 3, 5)); }
    if (s.t === 'waves') { for (let y = s.y; y < H; y += 4) for (let x = (y / 4) % 2 ? 0 : 6; x < W; x += 12) { g.fillStyle = (y + x) % 3 ? s.c : s.c2; g.fillRect(x, y, 6, 1); } }
    if (s.t === 'ship') { const { x, y } = s; g.fillRect(x, y, 46, 6); g.fillRect(x + 4, y + 6, 38, 4); g.fillRect(x + 20, y - 40, 2, 40); g.fillRect(x + 8, y - 34, 14, 22); g.fillRect(x + 23, y - 30, 14, 18); }
    if (s.t === 'bricks') { for (let y = 0; y < H; y += 10) for (let x = (y / 10) % 2 ? -10 : 0; x < W; x += 20) { g.fillStyle = (x * 7 + y * 3) % 5 ? s.c : s.c2; g.fillRect(x, y, 19, 9); } }
    if (s.t === 'torch') { const { x, y } = s; g.fillStyle = '#3a2412'; g.fillRect(x, y, 4, 16); for (let r = 14; r > 0; r -= 2) { g.fillStyle = r > 9 ? 'rgba(255,140,40,0.10)' : r > 4 ? '#ff9a2e' : '#ffe27a'; g.fillRect(x + 2 - r, y - r - 4, r * 2, r * 2); } }
    if (s.t === 'door') { const { x, y, w, h } = s; g.fillRect(x, y, w, h); g.fillStyle = s.c2; for (let i = 4; i < w; i += 8) g.fillRect(x + i, y + 4, 2, h - 4); g.fillRect(x + w - 10, y + h / 2, 4, 4); }
    if (s.t === 'graves') for (let i = 0; i < s.n; i++) { const x = 10 + Math.floor(rnd() * (W - 30)), y = s.y + Math.floor(rnd() * 30); const w = 10 + Math.floor(rnd() * 8); g.fillRect(x, y, w, 18); g.fillRect(x + 2, y - 3, w - 4, 3); if (rnd() > 0.5) { g.fillRect(x + w / 2 - 1, y - 12, 2, 12); g.fillRect(x + w / 2 - 5, y - 9, 10, 2); } }
    if (s.t === 'tree') { const { x, y } = s; g.fillRect(x, y - 90, 8, 90); const br = (bx, by, len, ang, d) => { if (d === 0) return; const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len; g.lineWidth = d; g.strokeStyle = s.c; g.beginPath(); g.moveTo(bx, by); g.lineTo(ex, ey); g.stroke(); br(ex, ey, len * 0.72, ang - 0.5, d - 1); br(ex, ey, len * 0.7, ang + 0.45, d - 1); }; br(x + 4, y - 88, 26, -1.57, 5); }
    if (s.t === 'crystals') for (let i = 0; i < s.n; i++) { const x = Math.floor(rnd() * W), y = s.y + rnd() * 60, h = 8 + rnd() * 18; g.fillStyle = s.c; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 4, y - h); g.lineTo(x + 8, y); g.fill(); g.fillStyle = s.glow; g.fillRect(x + 3, y - h + 4, 1, h - 6); }
    if (s.t === 'fog') for (let y = s.y; y < s.y + 40; y++) for (let x = 0; x < W; x++) if (BAYER[y % 4][x % 4] / 16 < 0.35 - (y - s.y) / 140 + Math.sin(x / 17) * 0.06) { g.fillStyle = s.c; g.fillRect(x, y, 1, 1); }
    if (s.t === 'sparks') for (let i = 0; i < s.n; i++) { g.fillStyle = s.c; g.fillRect(Math.floor(rnd() * W), Math.floor(s.y + rnd() * s.h), 1, 1); }
  }
  // Paleta limitada: cuantiza a 5 niveles por canal para el aspecto 16-bit
  const d = g.getImageData(0, 0, W, H);
  for (let i = 0; i < d.data.length; i += 4) for (let k = 0; k < 3; k++) d.data[i + k] = Math.round(d.data[i + k] / 51) * 51 * 0.25 + d.data[i + k] * 0.75;
  g.putImageData(d, 0, 0);
  return c.toDataURL('image/png');
}
`;

const SCENES = {
  ocaso: { seed: 11, horizon: 0.72, sky: ['#1b0f2e', '#3d1a4a', '#7a2a4f', '#c2453f', '#ef8a3c', '#ffcc66'], orb: [160, 168, 26], orbColor: '#ffd37a', haloColor: '#ff9a4a',
    ridges: [[190, 50, '#5a2340'], [222, 40, '#3a1630'], [258, 30, '#1e0b1c']], shapes: [{ t: 'castle', x: 200, y: 200, w: 70, c: '#140812', win: '#ffcf5a' }, { t: 'sparks', n: 40, y: 230, h: 90, c: '#ffb04a' }] },
  bosque: { seed: 23, horizon: 0.8, stars: 70, sky: ['#08121c', '#0f2a2c', '#1c4434', '#2f5e3e', '#4b7a4a'], orb: [240, 60, 14], orbColor: '#e9f2c4', moonShadow: true,
    ridges: [[200, 30, '#173a2c'], [235, 24, '#0f2a20']], shapes: [{ t: 'pines', n: 26, y: 250, h: 70, c: '#0b1f17' }, { t: 'pines', n: 18, y: 300, h: 90, c: '#06120d' }, { t: 'sparks', n: 60, y: 200, h: 110, c: '#d6ff7a' }] },
  cumbres: { seed: 37, horizon: 0.7, stars: 120, sky: ['#05070f', '#0d1430', '#1b2752', '#2e4473', '#4c6a98'], aurora: '#5effc2', orb: [70, 70, 10], orbColor: '#f2f4ff', moonShadow: true, snow: true,
    ridges: [[150, 120, '#3c4a6e', { w: 22, h: 40 }], [205, 90, '#262f4e'], [255, 40, '#141a30']], shapes: [{ t: 'castle', x: 120, y: 236, w: 46, c: '#0b0f1e', win: '#ffd76a' }] },
  abismo: { seed: 41, horizon: 1.0, sky: ['#02030a', '#060b1e', '#0b1636', '#10214a', '#173062'],
    ridges: [[60, 80, '#0a1028'], [270, 30, '#070b1c']], shapes: [{ t: 'crystals', n: 40, y: 230, c: '#3fa7ff', glow: '#bfe6ff' }, { t: 'crystals', n: 20, y: 40, c: '#7a5cff', glow: '#d7ccff' }, { t: 'fog', y: 180, c: '#2a4a8a' }, { t: 'sparks', n: 80, y: 60, h: 220, c: '#9fd8ff' }] },
  mar: { seed: 53, horizon: 0.62, stars: 90, sky: ['#060a18', '#0e1a36', '#1d2f5a', '#2e4a7c', '#4a6ea0'], orb: [90, 80, 18], orbColor: '#f4f1d0', haloColor: '#8fa8d0',
    ridges: [[196, 16, '#1a2a4e']], shapes: [{ t: 'rect', x: 0, y: 200, w: 320, h: 120, c: '#0f1d3c' }, { t: 'waves', y: 204, c: '#2e4a7c', c2: '#d8e2ff' }, { t: 'ship', x: 200, y: 214, c: '#070b16' }] },
  mazmorra: { seed: 67, horizon: 1.0, sky: ['#120c0a', '#1e1510', '#2a1d14', '#35251a'],
    shapes: [{ t: 'bricks', c: '#2c2119', c2: '#3a2c21' }, { t: 'door', x: 130, y: 170, w: 60, h: 150, c: '#1a110b', c2: '#3a2614' }, { t: 'torch', x: 90, y: 180 }, { t: 'torch', x: 226, y: 180 }, { t: 'rect', x: 0, y: 300, w: 320, h: 20, c: '#120c08' }] },
  ciudadela: { seed: 79, horizon: 0.75, sky: ['#170f24', '#2c1c3e', '#4a2a52', '#7a3e58', '#b8605a'], orb: [250, 90, 20], orbColor: '#ffe6a8', haloColor: '#ff9a6a',
    ridges: [[230, 20, '#2a1730'], [270, 16, '#1a0e1e']], shapes: [{ t: 'castle', x: 40, y: 170, w: 110, c: '#120a18', win: '#ffd56a' }, { t: 'castle', x: 190, y: 190, w: 80, c: '#160c1c', win: '#ffd56a' }] },
  cripta: { seed: 97, horizon: 0.78, stars: 60, sky: ['#05060a', '#0d0f1a', '#1a1c2c', '#2a2c3e', '#3e3f52'], orb: [230, 70, 16], orbColor: '#dfe6c8', moonShadow: true,
    ridges: [[230, 24, '#15171f']], shapes: [{ t: 'tree', x: 60, y: 260, c: '#07080c' }, { t: 'graves', n: 9, y: 252, c: '#2a2d3a' }, { t: 'fog', y: 262, c: '#5a6074' }] },
};

(async () => {
  const out = path.join(__dirname, '../../public/design/retro');
  fs.mkdirSync(out, { recursive: true });
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SCENES);
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.setContent('<html><body style="margin:0"></body></html>');
  await p.addScriptTag({ content: painter });
  for (const n of names) {
    const url = await p.evaluate((cfg) => window.paint(cfg), SCENES[n]);
    fs.writeFileSync(path.join(out, `${n}.png`), Buffer.from(url.split(',')[1], 'base64'));
    console.log(n, `${Math.round(fs.statSync(path.join(out, `${n}.png`)).size / 1024)} KB`);
  }
  await b.close();
})();
