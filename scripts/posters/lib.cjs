// Utilidades para pintar los pósteres de fondo (fantasía oscura de los 90) en SVG.
// Las texturas salen de filtros SVG (ruido fractal + iluminación), así no hace falta ninguna imagen.
const S = 1400;

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);

/** Filtros comunes: textura de roca iluminada, nubes, niebla, brillo y grano */
function defs(seed, light = { az: 235, el: 35, color: '#ffffff' }) {
  return `
  <filter id="rock" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.016 0.006" numOctaves="7" seed="${seed}" result="n"/>
    <feDiffuseLighting in="n" surfaceScale="4.5" lighting-color="${light.color}" result="l"><feDistantLight azimuth="${light.az}" elevation="${light.el}"/></feDiffuseLighting>
    <feComposite in="l" in2="SourceGraphic" operator="arithmetic" k1="1.15" k2="0.25" k3="0" k4="0" result="lit"/>
    <feComposite in="lit" in2="SourceAlpha" operator="in"/>
  </filter>
  <filter id="stone" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.05 0.09" numOctaves="4" seed="${seed + 3}" result="n"/>
    <feDiffuseLighting in="n" surfaceScale="2.4" lighting-color="${light.color}" result="l"><feDistantLight azimuth="${light.az}" elevation="${light.el + 10}"/></feDiffuseLighting>
    <feComposite in="l" in2="SourceGraphic" operator="arithmetic" k1="1.25" k2="0" k3="0" k4="0" result="lit"/>
    <feComposite in="lit" in2="SourceAlpha" operator="in"/>
  </filter>
  <filter id="foliage" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="4" seed="${seed + 5}" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="28" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="3" seed="${seed + 6}" result="n2"/>
    <feDiffuseLighting in="n2" surfaceScale="3" lighting-color="${light.color}" result="l"><feDistantLight azimuth="${light.az}" elevation="${light.el + 15}"/></feDiffuseLighting>
    <feComposite in="l" in2="d" operator="arithmetic" k1="1.3" k2="0" k3="0" k4="0" result="lit"/>
    <feComposite in="lit" in2="d" operator="in"/>
  </filter>
  <filter id="rough" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="${seed + 9}" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="16" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
  <filter id="glowS" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>
  <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.2"/></filter>
  <filter id="blur8" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="8"/></filter>
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="${seed + 11}"/>
    <feColorMatrix type="saturate" values="0"/>
    <feComponentTransfer><feFuncA type="table" tableValues="0.55 0.55"/></feComponentTransfer>
  </filter>
  <radialGradient id="vignette" cx="50%" cy="48%" r="72%"><stop offset="55%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#000" stop-opacity=".78"/></radialGradient>`;
}

/** Capa de nubes o nebulosa de un color a partir de ruido */
function noiseLayer(id, seed, freq, oct, color, alphaMul, alphaOff, x = 0, y = 0, w = S, h = S, extra = '') {
  const [r, g, b] = hex(color);
  // Los bordes de la capa se difuminan para que no se vean cortes rectos
  const fade = h < S || w < S;
  const m = fade ? `<linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".3" stop-color="#fff"/><stop offset=".7" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><linearGradient id="${id}h" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="${w < S ? 0 : 1}"/><stop offset=".25" stop-color="#fff"/><stop offset=".75" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="${w < S ? 0 : 1}"/></linearGradient><mask id="${id}m"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${id}g)"/></mask><mask id="${id}n"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#${id}h)"/></mask>` : '';
  const rect = `<rect x="${x}" y="${y}" width="${w}" height="${h}" filter="url(#${id})" ${extra}/>`;
  return `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${oct}" seed="${seed}"/><feColorMatrix type="matrix" values="0 0 0 0 ${r.toFixed(3)} 0 0 0 0 ${g.toFixed(3)} 0 0 0 0 ${b.toFixed(3)} ${alphaMul} 0 0 0 ${alphaOff}"/></filter>${m}${fade ? `<g mask="url(#${id}n)"><g mask="url(#${id}m)">${rect}</g></g>` : rect}`;
}

/** Estrellas con algunas brillantes */
function stars(seed, n, maxY, colors = ['#ffffff', '#ffe9c8', '#cfe0ff']) {
  const r = rng(seed); let s = '';
  for (let i = 0; i < n; i++) {
    const x = r() * S; const y = r() * maxY; const big = r() < 0.05; const c = colors[Math.floor(r() * colors.length)];
    const rad = big ? 1.6 + r() * 1.6 : 0.4 + r() * 1.1;
    if (big) s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad * 4}" fill="${c}" opacity=".25" filter="url(#glowS)"/>`;
    s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(2)}" fill="${c}" opacity="${(0.5 + r() * 0.5).toFixed(2)}"/>`;
  }
  return s;
}

/** Línea de montañas o acantilados con picos irregulares */
function crags(seed, y, amp, step, jag, x0 = 0, x1 = S) {
  const r = rng(seed); let d = `M${x0},${S} L${x0},${y}`;
  let cur = y;
  for (let x = x0; x <= x1; x += step * (0.5 + r())) {
    cur = y - amp * (0.3 + 0.7 * Math.abs(Math.sin(x * 0.004 + seed) * 0.7 + (r() - 0.5) * 0.6));
    d += ` L${x.toFixed(0)},${cur.toFixed(0)}`;
    if (r() < jag) d += ` L${(x + step * 0.2).toFixed(0)},${(cur - amp * 0.25 * r()).toFixed(0)} L${(x + step * 0.35).toFixed(0)},${(cur + amp * 0.1).toFixed(0)}`;
  }
  return d + ` L${x1},${y} L${x1},${S} Z`;
}

/** Árbol retorcido sin hojas (ramas recursivas) */
function deadTree(seed, x, y, len, ang, width, color, depth = 7) {
  const r = rng(seed); let s = '';
  const branch = (x0, y0, l, a, w, d) => {
    if (d === 0 || l < 6) return;
    const bend = (r() - 0.5) * 0.5;
    const x1 = x0 + Math.cos(a) * l; const y1 = y0 + Math.sin(a) * l;
    const cx = x0 + Math.cos(a + bend) * l * 0.5; const cy = y0 + Math.sin(a + bend) * l * 0.5;
    s += `<path d="M${x0.toFixed(1)},${y0.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)}" stroke="${color}" stroke-width="${w.toFixed(1)}" stroke-linecap="round" fill="none"/>`;
    const n = d > 5 ? 2 : 2 + (r() < 0.4 ? 1 : 0);
    for (let i = 0; i < n; i++) branch(x1, y1, l * (0.62 + r() * 0.2), a + (r() - 0.5) * 1.3 + (i - (n - 1) / 2) * 0.5, w * 0.68, d - 1);
  };
  branch(x, y, len, ang, width, depth);
  return s;
}

/** Figura encapuchada con báculo, vista de frente */
function hoodedFigure(x, y, h, robe, rim, staff = true, glow = null) {
  const k = h / 100;
  const p = (px, py) => `${(x + px * k).toFixed(1)},${(y + py * k).toFixed(1)}`;
  let s = '';
  if (glow) s += `<circle cx="${x + 26 * k}" cy="${y - 92 * k}" r="${14 * k}" fill="${glow}" opacity=".7" filter="url(#glow)"/><circle cx="${x + 26 * k}" cy="${y - 92 * k}" r="${3 * k}" fill="#fff"/>`;
  if (staff) s += `<path d="M${p(26, 0)} L${p(26, -92)}" stroke="#2a1d14" stroke-width="${2.6 * k}"/>`;
  s += `<path d="M${p(-18, 0)} C${p(-20, -40)} ${p(-14, -60)} ${p(-12, -70)} C${p(-14, -84)} ${p(-8, -96)} ${p(0, -98)} C${p(8, -96)} ${p(14, -84)} ${p(12, -70)} C${p(14, -60)} ${p(20, -40)} ${p(18, 0)} Z" fill="${robe}"/>`;
  s += `<path d="M${p(-6, -84)} C${p(-6, -92)} ${p(6, -92)} ${p(6, -84)} C${p(6, -78)} ${p(-6, -78)} ${p(-6, -84)} Z" fill="#000" opacity=".85"/>`;
  s += `<path d="M${p(-12, -70)} C${p(-14, -84)} ${p(-8, -96)} ${p(0, -98)} M${p(-18, 0)} C${p(-20, -40)} ${p(-14, -60)} ${p(-12, -70)}" stroke="${rim}" stroke-width="${1.6 * k}" fill="none" opacity=".9"/>`;
  s += `<path d="M${p(10, -56)} L${p(24, -50)}" stroke="${robe}" stroke-width="${5 * k}" stroke-linecap="round"/>`;
  return s;
}

/** Dragón en vuelo (silueta) */
function dragon(x, y, sc, color, flip = false) {
  const t = `translate(${x} ${y}) scale(${flip ? -sc : sc} ${sc})`;
  return `<g transform="${t}" fill="${color}"><path d="M0,0 C20,-6 40,-4 60,2 C70,4 80,2 92,-6 C86,4 78,10 66,12 C50,14 30,10 10,8 Z"/><path d="M30,2 C20,-30 -10,-60 -40,-70 C-30,-50 -36,-40 -30,-30 C-44,-36 -58,-34 -66,-26 C-50,-20 -40,-10 -20,-4 Z"/><path d="M44,2 C56,-26 80,-48 104,-58 C98,-40 104,-30 98,-22 C110,-24 120,-20 126,-12 C108,-8 90,-2 70,4 Z"/><path d="M60,2 C80,-2 100,-14 112,-20 L116,-24 L114,-16 C104,-6 86,4 64,8 Z"/><path d="M0,0 C-20,4 -40,14 -70,30 C-60,24 -40,20 -22,8 Z"/></g>`;
}

/** Ventana gótica iluminada */
function gothWindow(x, y, w, h, light) {
  return `<path d="M${x},${y + h} L${x},${y + w * 0.6} Q${x + w / 2},${y - w * 0.4} ${x + w},${y + w * 0.6} L${x + w},${y + h} Z" fill="${light}"/><path d="M${x},${y + h} L${x},${y + w * 0.6} Q${x + w / 2},${y - w * 0.4} ${x + w},${y + w * 0.6} L${x + w},${y + h} Z" fill="${light}" opacity=".5" filter="url(#glowS)"/>`;
}

/** Torre gótica con agujas, contrafuertes y ventanas */
function gothicTower(x, base, w, h, stone, light, seed) {
  const r = rng(seed); let s = '';
  s += `<g filter="url(#stone)"><rect x="${x}" y="${base - h}" width="${w}" height="${h}" fill="${stone}"/>`;
  s += `<path d="M${x - w * 0.12},${base} L${x - w * 0.04},${base - h * 0.55} L${x + w * 0.06},${base - h * 0.55} L${x + w * 0.04},${base} Z M${x + w * 1.12},${base} L${x + w * 1.04},${base - h * 0.55} L${x + w * 0.94},${base - h * 0.55} L${x + w * 0.96},${base} Z" fill="${stone}"/>`;
  // Agujas
  s += `<path d="M${x - w * 0.05},${base - h} L${x + w / 2},${base - h - w * 1.6} L${x + w * 1.05},${base - h} Z" fill="${stone}"/>`;
  for (const px of [x - w * 0.02, x + w * 1.02]) s += `<path d="M${px - w * 0.08},${base - h} L${px},${base - h - w * 0.55} L${px + w * 0.08},${base - h} Z" fill="${stone}"/>`;
  s += `</g>`;
  // Ventanas
  const rows = Math.floor(h / (w * 0.9));
  for (let i = 1; i < rows; i++) {
    const wy = base - h + i * w * 0.9;
    if (r() < 0.55) s += gothWindow(x + w * 0.35, wy, w * 0.3, w * 0.5, light);
    else s += `<path d="M${x + w * 0.35},${wy + w * 0.5} L${x + w * 0.35},${wy + w * 0.18} Q${x + w * 0.5},${wy - w * 0.12} ${x + w * 0.65},${wy + w * 0.18} L${x + w * 0.65},${wy + w * 0.5} Z" fill="#0b0708"/>`;
  }
  s += gothWindow(x + w * 0.3, base - h + w * 0.15, w * 0.4, w * 0.6, light);
  return s;
}

/** Cuervos o murciélagos */
function birds(seed, n, x0, y0, w, h, color, size = 10) {
  const r = rng(seed); let s = '';
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * w; const y = y0 + r() * h; const k = size * (0.5 + r());
    s += `<path d="M${x - k},${y - k * 0.2} Q${x - k * 0.5},${y - k * 0.6} ${x},${y} Q${x + k * 0.5},${y - k * 0.6} ${x + k},${y - k * 0.2} Q${x + k * 0.4},${y - k * 0.15} ${x},${y + k * 0.25} Q${x - k * 0.4},${y - k * 0.15} ${x - k},${y - k * 0.2} Z" fill="${color}"/>`;
  }
  return s;
}

/** Sombra de abajo arriba sobre una forma (da volumen y profundidad) */
let shadeN = 0;
function shadeShape(d, top = 0.0, bottom = 0.6, color = '#000', y0 = 0, y1 = S) {
  const id = `sh${shadeN++}`;
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${y0}" x2="0" y2="${y1}"><stop offset="0" stop-color="${color}" stop-opacity="${top}"/><stop offset="1" stop-color="${color}" stop-opacity="${bottom}"/></linearGradient><path d="${d}" fill="url(#${id})"/>`;
}

/** Acabado: color, viñeta y grano */
function finish(tint, tintOp = 0.18) {
  return `<rect width="${S}" height="${S}" fill="${tint}" opacity="${tintOp}" style="mix-blend-mode:soft-light"/><rect width="${S}" height="${S}" fill="url(#vignette)"/><rect width="${S}" height="${S}" filter="url(#grain)" opacity=".22" style="mix-blend-mode:overlay"/>`;
}

const wrap = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">${body}</svg>`;

module.exports = { shadeShape, S, rng, defs, noiseLayer, stars, crags, deadTree, hoodedFigure, dragon, gothWindow, gothicTower, birds, finish, wrap };
