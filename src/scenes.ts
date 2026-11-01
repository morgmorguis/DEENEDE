// Fondos pixel art de cada paleta de colores, generados como SVG (nítidos a cualquier tamaño):
//  · Básico: bosque otoñal al atardecer con un castillo en la colina
//  · Verdoso: bosque encantado de noche con luciérnagas y setas
//  · Grises: montañas nevadas con pinos, luna y nieve
//  · Azules: lago nocturno bajo la luna con montañas y su reflejo
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

function castle(out: Rect[], x: number, ground: number, c: string, window: string) {
  out.push([x, ground - 16, 8, 16, c], [x + 8, ground - 10, 14, 10, c], [x + 22, ground - 22, 10, 22, c], [x + 32, ground - 10, 12, 10, c], [x + 44, ground - 14, 7, 14, c]);
  for (const [cx, cy, n] of [[x, ground - 18, 3], [x + 22, ground - 24, 4], [x + 44, ground - 16, 3], [x + 8, ground - 12, 4], [x + 32, ground - 12, 4]] as const) {
    for (let i = 0; i < n; i++) out.push([cx + i * 3, cy, 2, 2, c]);
  }
  out.push([x + 26, ground - 30, 1, 6, c], [x + 27, ground - 30, 4, 2, window]);
  out.push([x + 3, ground - 11, 2, 3, window], [x + 26, ground - 16, 2, 3, window], [x + 46, ground - 9, 2, 2, window]);
}

interface Scene { sky: string; layers: string; sparkles: string; moon: string }

function autumn(): Scene {
  const r = rng(7); const o: Rect[] = [];
  ridge(o, 70, 14, 2, 0.4, '#4a2a2e');
  castle(o, 210, 66, '#3a2026', '#f0b44a');
  ridge(o, 86, 8, 3, 1.3, '#3a2024');
  for (let x = 4; x < W; x += 9 + Math.floor(r() * 8)) oak(o, x, 104, 6 + Math.floor(r() * 4), r() > 0.5 ? '#6b2e1c' : '#7a4a1c', '#2a1610', r() > 0.6 ? '#a8582a' : undefined);
  ridge(o, 108, 3, 4, 2.1, '#21130f');
  for (let x = 0; x < W; x += 13 + Math.floor(r() * 10)) pine(o, x, 120, 16 + Math.floor(r() * 10), '#170d0a');
  return {
    sky: 'linear-gradient(180deg, #120b12 0%, #2a1520 35%, #6b2f26 70%, #b0592c 100%)',
    layers: url(svg(o)),
    moon: 'none',
    sparkles: url(svg([[12, 30, 1, 1, '#ffd38a'], [70, 12, 1, 1, '#fff'], [140, 22, 1, 1, '#ffd38a'], [190, 8, 1, 1, '#fff'], [250, 26, 1, 1, '#fff'], [300, 14, 1, 1, '#ffd38a'], [96, 40, 2, 1, '#c06030'], [222, 44, 2, 1, '#c06030']], W, 60)),
  };
}

function forest(): Scene {
  const r = rng(21); const o: Rect[] = [];
  ridge(o, 62, 10, 2, 2.0, '#123524');
  for (let x = 2; x < W; x += 6 + Math.floor(r() * 6)) pine(o, x, 84, 18 + Math.floor(r() * 12), '#0f2c1e');
  for (let x = 6; x < W; x += 10 + Math.floor(r() * 8)) oak(o, x, 104, 7 + Math.floor(r() * 4), '#0c2418', '#081a10', r() > 0.5 ? '#1c4a30' : undefined);
  ridge(o, 110, 3, 5, 0.7, '#06140c');
  // Setas
  for (let x = 20; x < W; x += 37 + Math.floor(r() * 20)) o.push([x, 106, 3, 2, '#b8433a'], [x + 1, 106, 1, 1, '#f3e7c9'], [x + 1, 108, 1, 2, '#e8dcc0']);
  for (let x = 0; x < W; x += 11 + Math.floor(r() * 9)) pine(o, x, 120, 20 + Math.floor(r() * 10), '#04100a');
  return {
    sky: 'linear-gradient(180deg, #040a07 0%, #0a1d14 45%, #133a28 80%, #1f5238 100%)',
    layers: url(svg(o)),
    moon: 'none',
    sparkles: url(svg([[20, 20, 2, 2, '#d9ff6b'], [64, 44, 1, 1, '#d9ff6b'], [118, 30, 2, 2, '#f6ffb0'], [170, 50, 1, 1, '#d9ff6b'], [230, 18, 2, 2, '#d9ff6b'], [280, 40, 1, 1, '#f6ffb0'], [300, 10, 1, 1, '#fff']], W, 60)),
  };
}

function mountains(): Scene {
  const r = rng(33); const o: Rect[] = [];
  ridge(o, 70, 30, 2, 0.9, '#4b515c', 2, '#cdd3db');
  ridge(o, 86, 16, 3, 2.4, '#343840', 2, '#9aa1ab');
  for (let x = 3; x < W; x += 7 + Math.floor(r() * 7)) pine(o, x, 104, 14 + Math.floor(r() * 8), '#22252b', '#6f7681');
  ridge(o, 108, 2, 6, 1.1, '#7b828d');
  for (let x = 0; x < W; x += 12 + Math.floor(r() * 10)) pine(o, x, 120, 18 + Math.floor(r() * 10), '#15171b', '#4a4f58');
  return {
    sky: 'linear-gradient(180deg, #0b0c0f 0%, #1a1d22 45%, #2e333b 85%, #444a54 100%)',
    layers: url(svg(o)),
    moon: url(svg([[4, 0, 8, 16, '#e8ecf2'], [2, 2, 12, 12, '#e8ecf2'], [0, 4, 16, 8, '#e8ecf2'], [5, 4, 3, 3, '#c9ced6'], [9, 9, 2, 2, '#c9ced6']], 16, 16)),
    sparkles: url(svg([[14, 10, 1, 1, '#fff'], [60, 30, 1, 1, '#dfe4ea'], [110, 6, 1, 1, '#fff'], [160, 40, 1, 1, '#fff'], [200, 20, 1, 1, '#dfe4ea'], [290, 34, 1, 1, '#fff'], [36, 50, 1, 1, '#fff']], W, 60)),
  };
}

function lake(): Scene {
  const r = rng(45); const o: Rect[] = [];
  ridge(o, 66, 22, 2, 1.6, '#1b2f57', 2, '#5a74a6');
  ridge(o, 80, 10, 3, 0.2, '#13234a');
  for (let x = 2; x < W; x += 6 + Math.floor(r() * 7)) pine(o, x, 88, 12 + Math.floor(r() * 8), '#0c1834');
  // Lago con el reflejo de la luna
  o.push([0, 88, W, 32, '#0a1530']);
  for (let y = 90; y < 118; y += 3) o.push([250 + ((y * 7) % 9) - 4, y, 22 - ((y - 90) / 3), 1, '#f4ecc8']);
  for (let i = 0; i < 26; i++) o.push([Math.floor(r() * W), 90 + Math.floor(r() * 28), 4 + Math.floor(r() * 8), 1, '#22407a']);
  for (let x = 0; x < W; x += 30 + Math.floor(r() * 40)) pine(o, x, 120, 14 + Math.floor(r() * 8), '#050b1a');
  return {
    sky: 'linear-gradient(180deg, #03060f 0%, #0a1430 45%, #16295a 85%, #22407a 100%)',
    layers: url(svg(o)),
    moon: url(svg([[4, 0, 8, 16, '#f4ecc8'], [2, 2, 12, 12, '#f4ecc8'], [0, 4, 16, 8, '#f4ecc8'], [5, 4, 3, 3, '#d8cfa6'], [9, 9, 2, 2, '#d8cfa6'], [4, 11, 2, 1, '#d8cfa6']], 16, 16)),
    sparkles: url(svg([[10, 8, 1, 1, '#fff'], [44, 30, 1, 1, '#cfe0ff'], [100, 4, 2, 2, '#fff'], [150, 24, 1, 1, '#fff'], [196, 12, 1, 1, '#cfe0ff'], [240, 36, 1, 1, '#fff'], [284, 6, 2, 2, '#fff'], [310, 26, 1, 1, '#cfe0ff']], W, 60)),
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
