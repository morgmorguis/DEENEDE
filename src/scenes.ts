// Fondos de cada paleta al estilo de las ilustraciones de fantasía de los 70: cielos por bandas de
// color, soles y lunas a rayas, nubes alargadas y paisajes por capas con siluetas suaves. Se generan
// como SVG (nítidos a cualquier tamaño) y se aplican como variables CSS.
//  · Básico: atardecer con castillo de agujas en la colina, cipreses y un dragón a lo lejos
//  · Verdoso: bosque encantado al anochecer con árboles-seta, torre del mago y luciérnagas
//  · Grises: cordillera nevada con aurora y una ciudadela en la montaña
//  · Azules: mar nocturno con isla, faro, velero y luna sobre el agua
import type { Theme } from './store';

const W = 400;
const H = 160;

const url = (s: string) => `url("data:image/svg+xml;utf8,${s.replace(/#/g, '%23').replace(/\n/g, '')}")`;
const svg = (body: string, w = W, h = H) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}' preserveAspectRatio='none'>${body}</svg>`;

/** Cielo por bandas de color (sin degradado), como las paletas de las portadas de los 70 */
function bands(colors: string[]) {
  const step = 100 / colors.length;
  return `linear-gradient(180deg, ${colors.map((c, i) => `${c} ${(i * step).toFixed(2)}% ${((i + 1) * step).toFixed(2)}%`).join(', ')})`;
}

/** Línea de colinas o montañas que encaja por los lados (frecuencias enteras) */
function ridge(base: number, amp: number, waves: [number, number, number][], color: string, sharp = false) {
  const pts: [number, number][] = [];
  for (let x = 0; x <= W; x += sharp ? 10 : 8) {
    let y = 0;
    for (const [f, a, p] of waves) y += a * (sharp ? Math.abs(Math.sin((Math.PI * f * x) / W + p)) * 2 - 1 : Math.sin((2 * Math.PI * f * x) / W + p));
    pts.push([x, base - amp * y]);
  }
  let d = `M0,${H} L0,${pts[0][1].toFixed(1)}`;
  if (sharp) for (const [x, y] of pts) d += ` L${x},${y.toFixed(1)}`;
  else for (let i = 0; i < pts.length - 1; i++) { const [x, y] = pts[i]; const [nx, ny] = pts[i + 1]; d += ` Q${x},${y.toFixed(1)} ${((x + nx) / 2).toFixed(1)},${((y + ny) / 2).toFixed(1)}`; }
  d += ` L${W},${pts[pts.length - 1][1].toFixed(1)} L${W},${H} Z`;
  return `<path d='${d}' fill='${color}'/>`;
}

/** Nube alargada en forma de píldora, típica de los 70 */
const streak = (x: number, y: number, w: number, h: number, c: string) => `<rect x='${x}' y='${y}' width='${w}' height='${h}' rx='${h / 2}' fill='${c}'/>`;

/** Sol o luna a rayas */
function stripedDisc(col: string, gaps: string[], craters = false) {
  let s = `<defs><clipPath id='d'><circle cx='50' cy='50' r='48'/></clipPath></defs><circle cx='50' cy='50' r='48' fill='${col}'/>`;
  if (craters) s += `<circle cx='34' cy='36' r='8' fill='${gaps[0]}' opacity='.35'/><circle cx='62' cy='58' r='11' fill='${gaps[0]}' opacity='.3'/>`;
  gaps.forEach((g, i) => { s += `<rect x='0' y='${56 + i * 9}' width='100' height='${2 + i * 1.6}' fill='${g}' clip-path='url(%23d)'/>`; });
  return url(svg(s, 100, 100).replace("preserveAspectRatio='none'", ''));
}

/** Ciprés (silueta de llama) */
const cypress = (x: number, ground: number, h: number, c: string) => `<path d='M${x},${ground} C${x - 5},${ground - h * 0.4} ${x - 3},${ground - h * 0.8} ${x},${ground - h} C${x + 3},${ground - h * 0.8} ${x + 5},${ground - h * 0.4} ${x},${ground} Z' fill='${c}'/>`;

/** Árbol con copa redonda tipo seta */
const shroomTree = (x: number, ground: number, h: number, r: number, c: string, trunk: string) => `<path d='M${x - 2},${ground} Q${x},${ground - h / 2} ${x - 1},${ground - h} L${x + 1},${ground - h} Q${x + 1},${ground - h / 2} ${x + 3},${ground} Z' fill='${trunk}'/><ellipse cx='${x}' cy='${ground - h}' rx='${r}' ry='${r * 0.55}' fill='${c}'/>`;

interface Scene { sky: string; layers: string; sparkles: string; moon: string }

function sunset(): Scene {
  const castle = `<g fill='#3a1830'>
    <path d='M250,92 L250,70 L254,70 L254,58 L257,48 L260,58 L260,70 L266,70 L266,52 L270,38 L274,52 L274,70 L282,70 L282,62 L285,54 L288,62 L288,70 L294,70 L294,92 Z'/>
    <path d='M270,38 L270,30 L278,33 L270,35' fill='#f2b14a'/><path d='M257,48 L257,43 L262,45 L257,46' fill='#f2b14a'/>
  </g><rect x='268.5' y='58' width='3' height='4' rx='1.5' fill='#f6d27a'/><rect x='256' y='74' width='2' height='3' fill='#f6d27a'/><rect x='284' y='72' width='2' height='3' fill='#f6d27a'/>`;
  const body = ridge(92, 12, [[1, 0.6, 0.4], [3, 0.4, 1.3]], '#7a3248')
    + castle
    + ridge(108, 9, [[2, 0.7, 2.1], [5, 0.3, 0.2]], '#5c2440')
    + `<path d='M300,160 C296,140 286,126 272,112 C268,108 264,104 262,100' stroke='#b0583a' stroke-width='4' fill='none' opacity='.7'/>`
    + [30, 44, 120, 132, 190, 206, 330, 344, 372].map((x, i) => cypress(x, 128 + (i % 3) * 3, 26 + (i % 4) * 6, '#2e1228')).join('')
    + ridge(132, 6, [[3, 0.6, 0.7], [7, 0.4, 1.9]], '#3c1630')
    + ridge(148, 4, [[2, 0.5, 2.6], [6, 0.5, 0.5]], '#24091c');
  const sky = streak(30, 40, 120, 6, '#c45a4a') + streak(60, 50, 70, 4, '#d9784e') + streak(240, 22, 140, 7, '#a8484e') + streak(290, 33, 80, 4, '#c45a4a')
    + `<path d='M170,70 q8,-6 14,-2 q6,-10 14,-4 q-6,2 -8,6 q8,2 14,0 q-8,6 -18,4 q-6,4 -16,-4 Z' fill='#3a1830'/>`
    + [[90, 80], [104, 76], [330, 60]].map(([x, y]) => `<path d='M${x},${y} q3,-3 6,0 q3,-3 6,0' stroke='#3a1830' stroke-width='1.4' fill='none'/>`).join('')
    + [[20, 8], [80, 14], [150, 6], [210, 12], [300, 4], [360, 10]].map(([x, y]) => `<circle cx='${x}' cy='${y}' r='.9' fill='#fbe7c6'/>`).join('');
  return {
    sky: bands(['#241433', '#3a1a40', '#56203f', '#7a2a3c', '#9e3a36', '#c25432', '#dd7634', '#ee9a3e', '#f4c063']),
    layers: url(svg(body)),
    moon: stripedDisc('#f9d77e', ['#ee9a3e', '#dd7634', '#c25432', '#9e3a36']),
    sparkles: url(svg(sky)),
  };
}

function forest(): Scene {
  const tower = `<path d='M96,100 L96,58 L100,54 L104,58 L104,100 Z' fill='#1e3324'/><path d='M94,58 L100,38 L106,58 Z' fill='#2f4a2c'/><circle cx='100' cy='36' r='2.2' fill='#c8f0a0'/><rect x='99' y='66' width='2.5' height='4' rx='1' fill='#e9e08a'/><rect x='99' y='80' width='2.5' height='4' rx='1' fill='#e9e08a'/>`;
  const body = ridge(88, 10, [[2, 0.6, 0.9], [5, 0.4, 2.2]], '#3d5a3a')
    + tower
    + [20, 60, 150, 200, 250, 310, 360].map((x, i) => shroomTree(x, 112, 26 + (i % 3) * 8, 16 + (i % 2) * 6, i % 2 ? '#2f4a2c' : '#35532f', '#1e2a18')).join('')
    + ridge(114, 7, [[3, 0.6, 1.1], [7, 0.4, 0.3]], '#243a22')
    + `<rect x='0' y='104' width='400' height='5' fill='#a9c48a' opacity='.18'/><rect x='0' y='112' width='400' height='3' fill='#a9c48a' opacity='.12'/>`
    + [40, 90, 140, 230, 290, 340, 380].map((x, i) => `<g><rect x='${x}' y='${136 - (i % 2) * 4}' width='2' height='6' fill='#e8dcc0'/><ellipse cx='${x + 1}' cy='${136 - (i % 2) * 4}' rx='5' ry='3' fill='${i % 2 ? '#c2433a' : '#d9a53a'}'/><circle cx='${x + 1}' cy='${134 - (i % 2) * 4}' r='9' fill='#e9f59a' opacity='.12'/></g>`).join('')
    + ridge(140, 5, [[2, 0.5, 0.4], [6, 0.5, 1.6]], '#15230f')
    + ridge(152, 3, [[4, 0.6, 2.3], [9, 0.4, 0.8]], '#0c1608');
  let sky = streak(20, 30, 110, 5, '#3c5a3c') + streak(200, 18, 150, 6, '#34503a') + streak(260, 28, 70, 4, '#4a6a42');
  for (let i = 0; i < 26; i++) { const x = (i * 97) % 400; const y = 50 + ((i * 53) % 100); sky += `<circle cx='${x}' cy='${y}' r='3.4' fill='#e9f59a' opacity='.18'/><circle cx='${x}' cy='${y}' r='1' fill='#f2ffb0'/>`; }
  return {
    sky: bands(['#0f1a14', '#16261a', '#1e331f', '#2a4224', '#3a5228', '#52652e', '#71793a', '#988f4a']),
    layers: url(svg(body)),
    moon: url(svg(`<path d='M60,6 A44,44 0 1,0 60,94 A34,34 0 1,1 60,6 Z' fill='%23f2ecc0'/>`, 100, 100).replace("preserveAspectRatio='none'", '')),
    sparkles: url(svg(sky)),
  };
}

/** Cordillera de picos afilados con nieve en las cumbres (encaja por los lados) */
function sharpPeaks(base: number, peaks: [number, number][], rock: string, snow: string, shadow: string) {
  let d = `M0,${H} L0,${base}`;
  let caps = ''; let shade = '';
  const pts = [...peaks].sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < pts.length; i++) {
    const [x, h] = pts[i];
    const next = pts[i + 1] ?? [W + pts[0][0], pts[0][1]];
    const valley = (x + next[0]) / 2;
    d += ` L${x},${base - h} L${valley},${base - Math.min(h, next[1]) * 0.35}`;
    const c = h * 0.28;
    caps += `<path d='M${x - c * 0.75},${base - h + c} L${x},${base - h} L${x + c * 0.75},${base - h + c} L${x + c * 0.35},${base - h + c * 0.75} L${x},${base - h + c * 1.05} L${x - c * 0.3},${base - h + c * 0.7} Z' fill='${snow}'/>`;
    shade += `<path d='M${x},${base - h} L${valley},${base - Math.min(h, next[1]) * 0.35} L${x + 4},${base} Z' fill='${shadow}'/>`;
  }
  d += ` L${W},${base - pts[0][1] * 0.35} L${W},${H} Z`;
  return `<path d='${d}' fill='${rock}'/>${shade}${caps}`;
}

function peaks(): Scene {
  const body = sharpPeaks(96, [[20, 52], [78, 74], [140, 48], [205, 80], [262, 56], [330, 70], [385, 46]], '#5c6474', '#e3e7ee', '#4a5161')
    + `<g fill='#2f3542'><path d='M196,96 L196,72 L200,62 L204,72 L204,96 Z'/><path d='M188,96 L188,80 L192,74 L196,80 L196,96 Z'/><path d='M204,96 L204,82 L208,76 L212,82 L212,96 Z'/></g><rect x='199' y='76' width='2' height='3' fill='#f2d27a'/><rect x='191' y='85' width='2' height='2.5' fill='#f2d27a'/><rect x='207' y='87' width='2' height='2.5' fill='#f2d27a'/>`
    + sharpPeaks(116, [[50, 30], [120, 40], [180, 26], [250, 38], [320, 30], [370, 36]], '#3d4452', '#c4cad4', '#333a47')
    + ridge(128, 6, [[4, 0.6, 0.6], [9, 0.4, 2.1]], '#2b313c')
    + Array.from({ length: 24 }, (_, i) => { const x = i * 17 + (i % 3) * 4; const g = 142 + (i % 2) * 4; return `<path d='M${x},${g} L${x + 6},${g - 22} L${x + 12},${g} Z' fill='#1c2129'/><path d='M${x + 3},${g - 11} L${x + 6},${g - 22} L${x + 9},${g - 11} Z' fill='#9aa3b0'/>`; }).join('')
    + ridge(152, 3, [[3, 0.5, 1.4], [8, 0.5, 0.2]], '#c9ced6');
  // Aurora: cortinas suaves de color
  const wave = (y0: number, amp: number, f: number, ph: number) => {
    let d = `M0,${y0}`;
    for (let x = 0; x <= W; x += 10) d += ` L${x},${(y0 + amp * Math.sin((2 * Math.PI * f * x) / W + ph)).toFixed(1)}`;
    return d;
  };
  let sky = `<path d='${wave(34, 9, 2, 0.3)}' stroke='#6be0b0' stroke-width='22' fill='none' opacity='.08'/>`;
  sky += `<path d='${wave(30, 10, 2, 1.5)}' stroke='#8af0c8' stroke-width='6' fill='none' opacity='.16'/><path d='${wave(46, 7, 3, 2.4)}' stroke='#b48af0' stroke-width='5' fill='none' opacity='.12'/><path d='${wave(24, 6, 4, 0.7)}' stroke='#6be0b0' stroke-width='3' fill='none' opacity='.2'/>`;
  sky += streak(40, 84, 120, 5, '#4a5262') + streak(250, 94, 100, 4, '#555d6c');
  sky += [[14, 6], [70, 64], [130, 10], [180, 74], [240, 4], [300, 70], [350, 14], [390, 54]].map(([x, y]) => `<circle cx='${x}' cy='${y}' r='.9' fill='#fff'/>`).join('');
  return {
    sky: bands(['#0b0d12', '#11141b', '#181c25', '#20252f', '#29303b', '#333b48', '#3f4856', '#4d5766']),
    layers: url(svg(body)),
    moon: stripedDisc('#e8ecf2', ['#a9b1bd', '#7d8696', '#4d5766'], true),
    sparkles: url(svg(sky)),
  };
}

function sea(): Scene {
  const body = ridge(96, 8, [[2, 0.6, 1.6], [5, 0.4, 0.2]], '#203a6a')
    + `<path d='M300,108 Q312,86 330,84 Q350,82 362,108 Z' fill='#13234a'/><path d='M322,86 L322,62 L326,58 L330,62 L330,86 Z' fill='#0e1a3a'/><rect x='322' y='60' width='8' height='4' fill='#f6e4a0'/><path d='M330,61 L400,48 L400,74 Z' fill='#f6e4a0' opacity='.12'/>`
    + `<rect x='0' y='106' width='400' height='54' fill='#0f2148'/>`
    + Array.from({ length: 12 }, (_, i) => `<rect x='${88 + ((i * 7) % 9)}' y='${110 + i * 4}' width='${28 - i * 1.6}' height='1.6' rx='.8' fill='#f4ecc8' opacity='${(0.8 - i * 0.05).toFixed(2)}'/>`).join('')
    + Array.from({ length: 22 }, (_, i) => `<path d='M${(i * 61) % 400},${112 + ((i * 29) % 44)} q6,-3 12,0 q6,3 12,0' stroke='#3f6aa8' stroke-width='1.2' fill='none'/>`).join('')
    + `<g transform='translate(200 118)'><path d='M-18,0 L18,0 L13,7 L-13,7 Z' fill='#0a1430'/><path d='M0,0 L0,-30' stroke='#0a1430' stroke-width='1.6'/><path d='M1,-28 Q16,-16 2,-3 Z' fill='#d8d4c0'/><path d='M-1,-24 Q-12,-14 -2,-4 Z' fill='#bdb8a4'/><path d='M0,-30 L7,-28 L0,-26' fill='#c94f2c'/></g>`
    + ridge(152, 3, [[3, 0.5, 0.7], [8, 0.5, 1.5]], '#081430');
  const sky = streak(20, 50, 130, 5, '#24407a') + streak(60, 60, 60, 3, '#2f4f8a') + streak(230, 30, 150, 6, '#1d3466')
    + [[10, 8], [44, 30], [100, 4], [150, 18], [196, 12], [240, 40], [284, 6], [330, 26], [370, 10]].map(([x, y]) => `<circle cx='${x}' cy='${y}' r='${x % 3 ? 0.8 : 1.3}' fill='#eef2ff'/>`).join('')
    + Array.from({ length: 8 }, (_, i) => `<rect x='${300 + i * 4}' y='${20 + i * 2}' width='4' height='1.2' fill='#fff' opacity='${(0.9 - i * 0.1).toFixed(2)}'/>`).join('');
  return {
    sky: bands(['#050a1a', '#08112a', '#0c193a', '#11224a', '#172d5c', '#1e396e', '#27467f', '#33558f']),
    layers: url(svg(body)),
    moon: stripedDisc('#f4ecc8', ['#33558f', '#27467f', '#1e396e'], true),
    sparkles: url(svg(sky)),
  };
}

const cache = new Map<Theme, Scene>();
export function sceneFor(theme: Theme): Scene {
  if (!cache.has(theme)) cache.set(theme, theme === 'green' ? forest() : theme === 'gray' ? peaks() : theme === 'blue' ? sea() : sunset());
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
