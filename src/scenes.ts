// Fondos pixel art de cada paleta de colores al estilo de los RPG de fantasía de los 90, generados
// como SVG (nítidos a cualquier tamaño). Cielo por bandas, nubes, y un paisaje con detalles:
//  · Básico: atardecer otoñal con castillo con banderas, torre del mago y un dragón volando
//  · Verdoso: bosque encantado de noche con cabaña de bruja, setas que brillan y luciérnagas
//  · Grises: montañas nevadas con aurora, puerta enana iluminada y pinos nevados
//  · Azules: lago nocturno con faro, barco de vela y el reflejo de la luna
import type { Theme } from './store';

const W = 320;
const H = 120;

/** Aleatorio con semilla: el paisaje sale siempre igual */
function rng(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

type Rect = [number, number, number, number, string];
const svg = (rects: Rect[], w = W, h = H) =>
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}' shape-rendering='crispEdges'>${rects.map(([x, y, rw, rh, c]) => `<rect x='${x}' y='${y}' width='${rw}' height='${rh}' fill='${c}'/>`).join('')}</svg>`;
const url = (s: string) => `url("data:image/svg+xml;utf8,${s.replace(/#/g, '%23')}")`;

/** Cordillera que encaja por los lados (se repite en horizontal) */
function ridge(out: Rect[], base: number, amp: number, freq: number, phase: number, color: string, step = 2, snow?: string) {
  for (let x = 0; x < W; x += step) {
    const t = (x / W) * Math.PI * 2;
    const y = Math.round(base - amp * (0.6 * Math.sin(t * freq + phase) + 0.4 * Math.sin(t * freq * 2.3 + phase * 1.7)) - amp * 0.2);
    out.push([x, y, step, H - y, color]);
    if (snow && y < base - amp * 0.45) out.push([x, y, step, Math.max(2, Math.round((base - amp * 0.45 - y) * 0.45) + 2), snow]);
  }
}

/** Pino escalonado */
function pine(out: Rect[], x: number, ground: number, h: number, color: string, snow?: string) {
  out.push([x - 1, ground - 3, 2, 3, color]);
  for (let i = 0; i < h; i += 2) {
    const w = 1 + Math.floor(((i / h) * h) / 2.2) * 2;
    out.push([x - Math.floor(w / 2), ground - 3 - h + i, w, 2, color]);
    if (snow && i % 6 === 2) out.push([x - Math.floor(w / 2), ground - 3 - h + i, w, 1, snow]);
  }
}

/** Árbol frondoso redondeado */
function oak(out: Rect[], x: number, ground: number, r: number, leaf: string, trunk: string, light?: string) {
  out.push([x - 1, ground - r, 3, r, trunk]);
  for (let dy = -r; dy <= r; dy += 2) {
    const w = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)) * 2);
    out.push([x - Math.floor(w / 2), ground - r * 2 + dy, w, 2, leaf]);
    if (light && dy < -r / 3) out.push([x - Math.floor(w / 2) + 1, ground - r * 2 + dy, Math.max(1, Math.floor(w / 3)), 1, light]);
  }
}

/** Cielo por bandas de color sin degradado, como las paletas limitadas de los 90 */
function bands(colors: string[]) {
  const step = 100 / colors.length;
  return `linear-gradient(180deg, ${colors.map((c, i) => `${c} ${(i * step).toFixed(2)}% ${((i + 1) * step).toFixed(2)}%`).join(', ')})`;
}

interface Scene { sky: string; layers: string; sparkles: string; moon: string }

/** Dibuja un sprite a partir de filas de texto: cada letra es un color de la paleta, '.' es vacío */
function sprite(out: Rect[], x: number, y: number, rows: string[], pal: Record<string, string>, flip = false) {
  rows.forEach((row, j) => {
    const r = flip ? [...row].reverse().join('') : row;
    let i = 0;
    while (i < r.length) {
      const ch = r[i];
      if (ch === '.' || !pal[ch]) { i++; continue; }
      let k = i;
      while (k < r.length && r[k] === ch) k++;
      out.push([x + i, y + j, k - i, 1, pal[ch]]);
      i = k;
    }
  });
}

/** Nube pixel con luz arriba y sombra abajo */
function cloud(out: Rect[], x: number, y: number, w: number, body: string, light: string, dark: string) {
  const h = Math.max(4, Math.round(w / 5));
  for (let j = 0; j < h; j++) {
    const t = j / (h - 1);
    const inset = Math.round(Math.abs(t - 0.6) * w * 0.35);
    out.push([x + inset, y + j, w - inset * 2, 1, j === 0 ? light : j >= h - 1 ? dark : body]);
  }
  // Bultos de la parte de arriba
  out.push([x + Math.round(w * 0.2), y - 2, Math.round(w * 0.25), 2, light], [x + Math.round(w * 0.5), y - 3, Math.round(w * 0.22), 3, light]);
}

/** Dragón volando (silueta con ala alzada) */
const DRAGON = [
  '...........a......a.......',
  '..........aa.....aa.......',
  '.........aaa....aaa.......',
  '........aaaa...aaaa.......',
  '..dd...aaaaaaaaaaaa.......',
  '.dddd.dddddddddddddd......',
  'ddeddddddddddddddd.dddd...',
  '..dd....ddddddd......ddd..',
  '.........d...d.........dd.',
  '........................d.',
];

/** Murciélago o pájaro lejano */
const BAT = ['a...a', '.aaa.', '..a..'];

function castle(out: Rect[], x: number, ground: number, c: string, light: string, window: string, flags: string[]) {
  // Murallas, torres y torre del homenaje con almenas
  out.push([x, ground - 18, 9, 18, c], [x + 9, ground - 11, 14, 11, c], [x + 23, ground - 26, 11, 26, c], [x + 34, ground - 11, 12, 11, c], [x + 46, ground - 16, 8, 16, c]);
  for (const [cx, cy, n] of [[x, ground - 20, 3], [x + 23, ground - 28, 4], [x + 46, ground - 18, 3], [x + 9, ground - 13, 5], [x + 34, ground - 13, 4]] as const) {
    for (let i = 0; i < n; i++) out.push([cx + i * 3, cy, 2, 2, c]);
  }
  // Luz del sol poniente en un lado de las torres
  out.push([x, ground - 18, 1, 18, light], [x + 23, ground - 26, 1, 26, light], [x + 46, ground - 16, 1, 16, light]);
  // Tejado cónico de la torre izquierda y de la derecha
  for (let i = 0; i < 5; i++) { out.push([x + i, ground - 21 - i * 2, 9 - i * 2, 2, c]); out.push([x + 46 + i, ground - 19 - i * 2, 8 - i * 2, 2, c]); }
  // Banderas
  const pole = (px: number, py: number, f: string) => out.push([px, py - 8, 1, 8, c], [px + 1, py - 8, 4, 2, f], [px + 1, py - 6, 2, 1, f]);
  pole(x + 4, ground - 30, flags[0]); pole(x + 28, ground - 28, flags[1]); pole(x + 49, ground - 28, flags[2] ?? flags[0]);
  // Ventanas iluminadas y la puerta
  out.push([x + 3, ground - 13, 2, 3, window], [x + 27, ground - 20, 2, 3, window], [x + 27, ground - 14, 2, 3, window], [x + 49, ground - 10, 2, 2, window], [x + 14, ground - 7, 1, 2, window], [x + 39, ground - 7, 1, 2, window]);
  out.push([x + 26, ground - 6, 5, 6, '#140a08'], [x + 27, ground - 7, 3, 1, '#140a08']);
}

/** Torre de mago: alta, con tejado puntiagudo y ventana con luz mágica */
function wizardTower(out: Rect[], x: number, ground: number, c: string, roof: string, glow: string) {
  out.push([x, ground - 34, 8, 34, c], [x - 1, ground - 36, 10, 2, c]);
  for (let i = 0; i < 9; i++) out.push([x - 1 + Math.floor(i / 2), ground - 38 - i * 2, 10 - Math.floor(i / 2) * 2, 2, roof]);
  out.push([x + 4, ground - 58, 1, 2, glow]);
  out.push([x + 3, ground - 30, 2, 3, glow], [x + 3, ground - 20, 2, 3, glow], [x + 2, ground - 31, 4, 1, glow]);
  out.push([x + 8, ground - 26, 3, 1, c], [x + 10, ground - 27, 1, 2, c]); // balconcillo
}

function autumn(): Scene {
  const r = rng(7); const o: Rect[] = [];
  ridge(o, 64, 18, 2, 0.4, '#4f2b33', 2);
  ridge(o, 72, 10, 3, 2.2, '#432330');
  castle(o, 206, 70, '#33191f', '#6b3530', '#f6c25a', ['#c23a2a', '#e0a83a', '#3a6bc2']);
  wizardTower(o, 60, 74, '#2e1820', '#4a2038', '#9ff0ff');
  ridge(o, 86, 8, 3, 1.3, '#3a2024');
  // Camino que serpentea hasta el castillo
  for (let y = 86; y < 104; y += 2) o.push([226 + Math.round(Math.sin(y / 5) * 6) - Math.floor((y - 86) / 3), y, 3 + Math.floor((y - 86) / 4), 2, '#5a3424']);
  for (let x = 4; x < W; x += 9 + Math.floor(r() * 8)) oak(o, x, 104, 6 + Math.floor(r() * 4), r() > 0.5 ? '#6b2e1c' : '#7a4a1c', '#2a1610', r() > 0.4 ? '#b8662a' : '#9a3a20');
  ridge(o, 108, 3, 4, 2.1, '#21130f');
  // Hojas caídas en el suelo
  for (let i = 0; i < 40; i++) o.push([Math.floor(r() * W), 108 + Math.floor(r() * 5), 1, 1, r() > 0.5 ? '#a8582a' : '#7a3a1c']);
  for (let x = 0; x < W; x += 13 + Math.floor(r() * 10)) pine(o, x, 120, 16 + Math.floor(r() * 10), '#170d0a');
  // Cielo: nubes rosadas, un dragón y pájaros
  const sky: Rect[] = [];
  [[18, 44, 46], [120, 30, 36], [206, 52, 54], [276, 22, 30]].forEach(([x, y, w]) => cloud(sky, x, y, w, '#8a3f4a', '#d27a5a', '#5a2a3a'));
  sprite(sky, 150, 64, DRAGON, { a: '#2a1418', d: '#2a1418', e: '#f6c25a' });
  [[70, 20], [90, 26], [250, 70], [262, 74]].forEach(([x, y]) => sprite(sky, x, y, BAT, { a: '#3a1a20' }));
  [[12, 8], [70, 4], [140, 12], [190, 6], [250, 10], [300, 4], [40, 16], [230, 18]].forEach(([x, y]) => sky.push([x, y, 1, 1, '#ffd9a8']));
  return {
    sky: bands(['#140b16', '#1f1020', '#2c1424', '#41182a', '#5a1f2c', '#782a2c', '#93382c', '#b0502e', '#c86a34']),
    layers: url(svg(o)),
    moon: url(svg([[5, 0, 10, 20, '#f6c25a'], [2, 2, 16, 16, '#f6c25a'], [0, 5, 20, 10, '#f6c25a'], [3, 3, 6, 4, '#ffe39a'], [0, 12, 20, 1, '#c86a34'], [1, 15, 18, 1, '#c86a34'], [3, 18, 14, 1, '#c86a34']], 20, 20)),
    sparkles: url(svg(sky, W, 160)),
  };
}

/** Cabaña de bruja con chimenea humeante y ventana iluminada */
function hut(out: Rect[], x: number, ground: number) {
  out.push([x, ground - 10, 16, 10, '#2a1c12']);
  for (let i = 0; i < 6; i++) out.push([x - 2 + i, ground - 11 - i * 2, 20 - i * 2, 2, i % 2 ? '#3d4a1c' : '#4a5a22']);
  out.push([x + 12, ground - 20, 3, 6, '#3a2a20'], [x + 4, ground - 7, 3, 3, '#ffcf5a'], [x + 5, ground - 7, 1, 3, '#a8641a'], [x + 9, ground - 8, 4, 8, '#140c08']);
  [[13, 23], [12, 26], [14, 29], [13, 32]].forEach(([dx, dy], i) => out.push([x + dx, ground - dy, 2 + (i % 2), 2, '#5a6a6a']));
}

/** Seta que brilla en la oscuridad */
function glowShroom(out: Rect[], x: number, ground: number, cap: string, glow: string, big = false) {
  const w = big ? 7 : 4;
  out.push([x - 1, ground - (big ? 9 : 6), w + 2, big ? 5 : 3, glow]);
  out.push([x, ground - (big ? 8 : 5), w, big ? 3 : 2, cap], [x + Math.floor(w / 2) - 1, ground - (big ? 5 : 3), 2, big ? 5 : 3, '#e8f0d0']);
  out.push([x + 1, ground - (big ? 8 : 5), 1, 1, '#ffffff']);
}

function forest(): Scene {
  const r = rng(21); const o: Rect[] = [];
  ridge(o, 58, 12, 2, 2.0, '#143a28');
  for (let x = 2; x < W; x += 6 + Math.floor(r() * 6)) pine(o, x, 84, 18 + Math.floor(r() * 12), '#0f2c1e');
  // Piedras antiguas en círculo, con runas que brillan
  for (const [sx, h] of [[150, 10], [158, 13], [168, 11], [176, 9]] as const) o.push([sx, 86 - h, 5, h, '#2a3a34'], [sx, 86 - h, 5, 1, '#3e5248'], [sx + 2, 86 - h + 3, 1, 2, '#6bffd0']);
  o.push([148, 86, 34, 2, '#0e2418']);
  for (let x = 6; x < W; x += 10 + Math.floor(r() * 8)) if (x < 140 || x > 186) oak(o, x, 104, 7 + Math.floor(r() * 4), '#0c2418', '#081a10', r() > 0.5 ? '#1c4a30' : undefined);
  hut(o, 230, 104);
  ridge(o, 110, 3, 5, 0.7, '#06140c');
  for (let x = 0; x < W; x += 11 + Math.floor(r() * 9)) pine(o, x, 120, 20 + Math.floor(r() * 10), '#04100a');
  // Setas que brillan, delante de todo
  for (let x = 8; x < W; x += 19 + Math.floor(r() * 18)) glowShroom(o, x, 120, r() > 0.5 ? '#c2433a' : '#6a4ad0', r() > 0.5 ? 'rgba(160,255,140,0.25)' : 'rgba(140,200,255,0.25)', r() > 0.6);
  const sky: Rect[] = [];
  [[30, 30, 40], [180, 18, 50], [270, 40, 34]].forEach(([x, y, w]) => cloud(sky, x, y, w, '#12301f', '#1d4a32', '#0a1f14'));
  for (let i = 0; i < 26; i++) { const x = Math.floor(r() * W); const y = 60 + Math.floor(r() * 96); sky.push([x, y, 1, 1, r() > 0.3 ? '#d9ff6b' : '#fff7b0'], [x - 1, y, 3, 1, 'rgba(217,255,107,0.25)']); }
  [[10, 6], [64, 12], [120, 4], [200, 8], [240, 14], [300, 6]].forEach(([x, y]) => sky.push([x, y, 1, 1, '#e8fff0']));
  [[96, 40], [104, 36]].forEach(([x, y]) => sprite(sky, x, y, BAT, { a: '#030805' }));
  return {
    sky: bands(['#030806', '#06110c', '#0a1a12', '#0e2418', '#122e1f', '#163a27', '#1b4630', '#215238']),
    layers: url(svg(o)),
    moon: url(svg([[6, 0, 8, 2, '#f0f6d8'], [3, 2, 7, 3, '#f0f6d8'], [1, 5, 6, 10, '#f0f6d8'], [3, 15, 7, 3, '#f0f6d8'], [6, 18, 8, 2, '#f0f6d8'], [2, 7, 2, 3, '#c9d6b0']], 20, 20)),
    sparkles: url(svg(sky, W, 160)),
  };
}

function mountains(): Scene {
  const r = rng(33); const o: Rect[] = [];
  ridge(o, 60, 34, 2, 0.9, '#4b515c', 2, '#d8dee6');
  ridge(o, 80, 18, 3, 2.4, '#343840', 2, '#a6adb8');
  // Puerta enana tallada en la montaña, con luz de forja dentro
  const gx = 132; const gy = 92;
  o.push([gx - 4, gy - 22, 30, 22, '#2b2f36'], [gx - 2, gy - 24, 26, 2, '#3e434c']);
  for (let i = 0; i < 6; i++) o.push([gx + 4 + i, gy - 16 - i, 14 - i * 2, 1, '#120c08']);
  o.push([gx + 4, gy - 16, 14, 16, '#120c08'], [gx + 7, gy - 12, 8, 12, '#d8742a'], [gx + 9, gy - 9, 4, 9, '#ffc25a']);
  o.push([gx - 2, gy - 18, 3, 18, '#5a606a'], [gx + 21, gy - 18, 3, 18, '#5a606a'], [gx + 8, gy - 24, 6, 2, '#c9a227']);
  for (let s = 0; s < 6; s++) o.push([gx + 2 + s * 3, gy + s * 2, 18 - s * 0, 2, s % 2 ? '#4a4f58' : '#555b64']);
  for (let x = 3; x < W; x += 7 + Math.floor(r() * 7)) if (x < gx - 8 || x > gx + 30) pine(o, x, 104, 14 + Math.floor(r() * 8), '#22252b', '#7a818c');
  ridge(o, 108, 2, 6, 1.1, '#8a919c');
  for (let i = 0; i < 30; i++) o.push([Math.floor(r() * W), 108 + Math.floor(r() * 6), 2, 1, '#c9ced6']);
  for (let x = 0; x < W; x += 12 + Math.floor(r() * 10)) pine(o, x, 120, 18 + Math.floor(r() * 10), '#15171b', '#5a606a');
  // Aurora y estrellas
  const sky: Rect[] = [];
  for (let x = 0; x < W; x += 2) {
    const y = 18 + Math.round(Math.sin(x / 26) * 8 + Math.sin(x / 9) * 3);
    const h = 10 + Math.round((Math.sin(x / 17) + 1) * 6);
    sky.push([x, y, 2, h, 'rgba(90,255,190,0.16)'], [x, y + Math.round(h / 3), 2, Math.round(h / 3), 'rgba(140,255,220,0.18)'], [x, y + h, 2, 4, 'rgba(160,120,255,0.12)']);
  }
  [[10, 4], [44, 50], [80, 8], [120, 60], [160, 6], [210, 54], [250, 2], [290, 40], [30, 70], [180, 80], [300, 76]].forEach(([x, y]) => sky.push([x, y, 1, 1, '#ffffff']));
  [[60, 86, 40], [220, 96, 50]].forEach(([x, y, w]) => cloud(sky, x, y, w, '#3a3f48', '#5a606a', '#2a2e35'));
  return {
    sky: bands(['#07080b', '#0b0d11', '#101318', '#161a20', '#1d2128', '#252a32', '#2e343d', '#3a4049', '#464d57']),
    layers: url(svg(o)),
    moon: url(svg([[4, 0, 8, 16, '#e8ecf2'], [2, 2, 12, 12, '#e8ecf2'], [0, 4, 16, 8, '#e8ecf2'], [5, 4, 3, 3, '#c9ced6'], [9, 9, 2, 2, '#c9ced6']], 16, 16)),
    sparkles: url(svg(sky, W, 160)),
  };
}

const SHIP = [
  '..........f...........',
  '..........ff..........',
  '..........s...........',
  '.........sss..........',
  '........sssss.........',
  '.......sssssss........',
  '......sssssssss.......',
  '.....sssssssssss......',
  '..........m...........',
  '.hhhhhhhhhhhhhhhhhhhh.',
  '..hhhwhhhwhhhwhhhhhh..',
  '...hhhhhhhhhhhhhhhh...',
];

/** Faro sobre una roca, con haces de luz */
function lighthouse(out: Rect[], x: number, ground: number) {
  out.push([x - 8, ground - 4, 22, 6, '#0d1730'], [x - 5, ground - 7, 16, 3, '#0d1730']);
  for (let i = 0; i < 26; i++) { const w = 6 - Math.floor(i / 9); out.push([x + Math.floor((6 - w) / 2), ground - 7 - i, w, 1, Math.floor(i / 4) % 2 ? '#b8c2d8' : '#a23a3a']); }
  out.push([x - 1, ground - 34, 8, 1, '#0d1730'], [x, ground - 39, 6, 5, '#fff2a8'], [x + 1, ground - 38, 4, 3, '#ffffff'], [x, ground - 41, 6, 2, '#0d1730'], [x + 2, ground - 43, 2, 2, '#0d1730']);
  // Haces de luz
  for (let i = 0; i < 40; i++) { out.push([x + 6 + i, ground - 38 - Math.floor(i / 6), 1, 3 + Math.floor(i / 5), 'rgba(255,242,168,0.12)']); out.push([x - 1 - i, ground - 38 - Math.floor(i / 8), 1, 2 + Math.floor(i / 6), 'rgba(255,242,168,0.08)']); }
}

function lake(): Scene {
  const r = rng(45); const o: Rect[] = [];
  ridge(o, 62, 24, 2, 1.6, '#1b2f57', 2, '#6a84b6');
  ridge(o, 78, 10, 3, 0.2, '#13234a');
  // Torre élfica en la orilla de enfrente
  o.push([94, 62, 6, 22, '#0e1a3a'], [92, 60, 10, 2, '#0e1a3a']);
  for (let i = 0; i < 6; i++) o.push([93 + i, 58 - i * 2, 8 - i * 2, 2, '#0e1a3a']);
  o.push([96, 66, 2, 3, '#9fd0ff'], [96, 74, 2, 3, '#9fd0ff']);
  for (let x = 2; x < W; x += 6 + Math.floor(r() * 7)) pine(o, x, 88, 12 + Math.floor(r() * 8), '#0c1834');
  // Lago con el reflejo de la luna y de la torre
  o.push([0, 88, W, 32, '#0a1530']);
  o.push([94, 90, 6, 12, '#0c1a3c'], [96, 92, 2, 2, '#3a5a8a']);
  for (let y = 90; y < 118; y += 3) o.push([250 + ((y * 7) % 9) - 4, y, 22 - ((y - 90) / 3), 1, '#f4ecc8']);
  for (let i = 0; i < 26; i++) o.push([Math.floor(r() * W), 90 + Math.floor(r() * 28), 4 + Math.floor(r() * 8), 1, '#22407a']);
  sprite(o, 160, 82, SHIP, { f: '#c23a3a', s: '#d8d8e8', m: '#3a2a1a', h: '#2a1c14', w: '#ffcf5a' });
  for (let i = 0; i < 4; i++) o.push([158 + i * 6, 95 + i, 4, 1, '#3a5a9a']);
  lighthouse(o, 40, 104);
  for (let x = 0; x < W; x += 30 + Math.floor(r() * 40)) if (x < 20 || x > 70) pine(o, x, 120, 14 + Math.floor(r() * 8), '#050b1a');
  const sky: Rect[] = [];
  [[20, 40, 44], [140, 26, 36], [210, 60, 48]].forEach(([x, y, w]) => cloud(sky, x, y, w, '#1a2c5a', '#3a5a9a', '#101e44'));
  [[10, 8], [44, 30], [100, 4], [150, 14], [196, 12], [240, 36], [284, 6], [310, 26], [70, 70], [180, 80], [120, 54]].forEach(([x, y], i) => sky.push([x, y, i % 3 ? 1 : 2, i % 3 ? 1 : 2, i % 2 ? '#cfe0ff' : '#ffffff']));
  // Estrella fugaz
  for (let i = 0; i < 10; i++) sky.push([200 + i * 2, 20 + i, 2, 1, `rgba(255,255,255,${0.9 - i * 0.08})`]);
  return {
    sky: bands(['#02040b', '#050a18', '#081024', '#0b1630', '#0f1d3d', '#13254a', '#182e58', '#1e3866', '#244276']),
    layers: url(svg(o)),
    moon: url(svg([[4, 0, 8, 16, '#f4ecc8'], [2, 2, 12, 12, '#f4ecc8'], [0, 4, 16, 8, '#f4ecc8'], [5, 4, 3, 3, '#d8cfa6'], [9, 9, 2, 2, '#d8cfa6'], [4, 11, 2, 1, '#d8cfa6']], 16, 16)),
    sparkles: url(svg(sky, W, 160)),
  };
}

const cache = new Map<Theme, Scene>();
export function sceneFor(theme: Theme): Scene {
  if (!cache.has(theme)) cache.set(theme, theme === 'green' ? forest() : theme === 'gray' ? mountains() : theme === 'blue' ? lake() : autumn());
  return cache.get(theme)!;
}

/** Aplica el fondo de la paleta como variables CSS */
export function applyScene(theme: Theme) {
  const s = sceneFor(theme);
  const root = document.documentElement.style;
  root.setProperty('--scene-sky', s.sky);
  root.setProperty('--scene-layers', s.layers);
  root.setProperty('--scene-sparkles', s.sparkles);
  root.setProperty('--scene-moon', s.moon);
}
