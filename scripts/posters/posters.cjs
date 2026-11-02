// Ocho pósteres de fantasía oscura para los fondos de la app y del retrato.
const L = require('./lib.cjs');
const { shadeShape, S, rng, defs, noiseLayer, stars, crags, deadTree, hoodedFigure, dragon, gothWindow, gothicTower, birds, finish, wrap } = L;

/** Pared de cañón o acantilado lateral, irregular */
function sideWall(seed, side, topY, inner, color, filter = 'rock') {
  const r = rng(seed); const pts = [];
  for (let y = S; y >= topY; y -= 40 + r() * 50) {
    const t = (S - y) / (S - topY);
    const x = inner * (1 - t * 0.55) + (r() - 0.5) * 70;
    pts.push([side === 'L' ? x : S - x, y]);
  }
  pts.push([side === 'L' ? 0 : S, topY - 60]);
  const d = `M${side === 'L' ? 0 : S},${S} ` + pts.map(([x, y]) => `L${x.toFixed(0)},${y.toFixed(0)}`).join(' ') + ' Z';
  return `<path d="${d}" fill="${color}" filter="url(#${filter})"/>` + shadeShape(d, 0.15, 0.75, '#000', topY, S);
}

/** Abismo cósmico: catedral de dos torres sobre un cañón bajo una nebulosa */
function abismo() {
  let s = `<defs>${defs(41, { az: 250, el: 32, color: '#d8c8ff' })}
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05030c"/><stop offset=".45" stop-color="#140a26"/><stop offset=".62" stop-color="#3a1640"/><stop offset=".72" stop-color="#2a3266"/></linearGradient>
    <radialGradient id="neb" cx="50%" cy="34%" r="45%"><stop offset="0" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <mask id="nebM"><rect width="${S}" height="${S}" fill="url(#neb)"/></mask>
    <linearGradient id="river" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b3c7a"/><stop offset="1" stop-color="#0a1030"/></linearGradient>
    <radialGradient id="planet" cx="35%" cy="35%" r="70%"><stop offset="0" stop-color="#b8a8d8"/><stop offset=".7" stop-color="#4a3a6e"/><stop offset="1" stop-color="#1a1028"/></radialGradient>
    <radialGradient id="planet2" cx="35%" cy="35%" r="70%"><stop offset="0" stop-color="#d88a9a"/><stop offset=".7" stop-color="#6a2a4a"/><stop offset="1" stop-color="#1a0818"/></radialGradient>
  </defs>`;
  s += `<rect width="${S}" height="${S}" fill="url(#sky)"/>`;
  s += `<g mask="url(#nebM)">${noiseLayer('n1', 7, '0.0022 0.0035', 6, '#d0246e', 2.2, -0.95)}${noiseLayer('n2', 13, '0.003', 6, '#6a3ad0', 2.0, -0.8)}${noiseLayer('n3', 19, '0.006', 5, '#ff9ad0', 2.4, -1.4)}</g>`;
  s += stars(3, 900, 900);
  s += `<circle cx="700" cy="250" r="90" fill="#ffb066" opacity=".35" filter="url(#glow)"/><circle cx="700" cy="250" r="30" fill="#ffd9a0" opacity=".8" filter="url(#glow)"/><circle cx="700" cy="250" r="5" fill="#fff"/>`;
  s += `<circle cx="430" cy="430" r="66" fill="url(#planet)"/><circle cx="430" cy="430" r="66" fill="#8070b0" opacity=".25" filter="url(#stone)"/><circle cx="1050" cy="190" r="34" fill="url(#planet2)"/><circle cx="560" cy="350" r="16" fill="url(#planet)"/>`;
  // Agujas de roca lejanas con niebla
  s += `<path d="${crags(5, 880, 230, 46, 0.6)}" fill="#3a3c66" filter="url(#rock)" opacity=".95"/>`;
  s += noiseLayer('fog1', 23, '0.003 0.012', 5, '#9ab0e8', 1.6, -0.55, 0, 760, S, 300, 'opacity=".75"');
  s += `<path d="${crags(9, 960, 160, 60, 0.5)}" fill="#2a2a4a" filter="url(#rock)"/>`;
  s += noiseLayer('fog2', 29, '0.004 0.014', 5, '#7c8cc8', 1.5, -0.6, 0, 880, S, 220, 'opacity=".6"');
  // Río
  s += `<path d="M560,${S} C600,1250 640,1150 690,1060 C720,1010 740,990 760,980 C800,1020 840,1160 900,${S} Z" fill="url(#river)"/>`;
  s += noiseLayer('rip', 31, '0.02 0.18', 3, '#a8b8ff', 2.0, -1.3, 560, 980, 340, 420, 'opacity=".5"');
  // Catedral
  s += `<path d="M760,1080 L760,860 L1120,860 L1150,1080 Z" fill="#3b3433" filter="url(#stone)"/>`;
  for (let i = 0; i < 7; i++) s += `<path d="M${790 + i * 44},1080 L${790 + i * 44},990 Q${808 + i * 44},960 ${826 + i * 44},990 L${826 + i * 44},1080 Z" fill="#120c10"/>`;
  s += gothicTower(800, 880, 130, 520, '#4a4241', '#ffcf8a', 3) + gothicTower(960, 880, 130, 560, '#4a4241', '#ffcf8a', 8);
  s += `<path d="M930,880 L930,520 L960,470 L960,880 Z" fill="#3a3333" filter="url(#stone)"/>`;
  // Paredes del cañón
  s += sideWall(11, 'L', 420, 560, '#3a302c') + sideWall(17, 'R', 640, 300, '#3a302c');
  s += `<path d="M380,${S} L470,1240 L620,1200 L760,1230 L900,1290 L1000,${S} Z" fill="#5a4a40" filter="url(#stone)"/>`;
  // Figuras con túnica roja
  for (const [x, y, h] of [[640, 1290, 46], [700, 1310, 52], [740, 1300, 44], [880, 1250, 40]]) s += hoodedFigure(x, y, h, '#7a1e1e', '#ff8a6a', false);
  s += finish('#6a3aa0', 0.25);
  return wrap(s);
}

/** Ruinas en el bosque: arco antiguo cubierto de musgo y un druida con báculo */
function bosque() {
  let s = `<defs>${defs(57, { az: 300, el: 40, color: '#e8ffe0' })}
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c1714"/><stop offset=".5" stop-color="#1b2e26"/><stop offset="1" stop-color="#0a120e"/></linearGradient>
    <linearGradient id="shaft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f0c0" stop-opacity=".35"/><stop offset="1" stop-color="#f4f0c0" stop-opacity="0"/></linearGradient>
    <radialGradient id="inner" cx="50%" cy="70%" r="60%"><stop offset="0" stop-color="#1a3a2a"/><stop offset="1" stop-color="#030605"/></radialGradient>
  </defs>`;
  s += `<rect width="${S}" height="${S}" fill="url(#sky)"/>`;
  s += noiseLayer('f0', 4, '0.004 0.01', 5, '#4a6a52', 1.4, -0.4, 0, 0, S, S, 'opacity=".5"');
  // Árboles lejanos
  for (let i = 0; i < 9; i++) s += deadTree(100 + i, 80 + i * 160, 1100, 260, -Math.PI / 2 + (i % 2 ? 0.1 : -0.1), 26, '#1c2a22', 6);
  s += noiseLayer('f1', 8, '0.003 0.012', 5, '#6f8f74', 1.6, -0.6, 0, 600, S, 600, 'opacity=".55"');
  // Gran arco apuntado
  const arch = 'M380,1180 L380,560 Q380,300 700,170 Q1020,300 1020,560 L1020,1180 L880,1180 L880,600 Q880,420 700,330 Q520,420 520,600 L520,1180 Z';
  s += `<path d="M520,1180 L520,600 Q520,420 700,330 Q880,420 880,600 L880,1180 Z" fill="url(#inner)"/>`;
  s += `<path d="${arch}" fill="#7b7c70" filter="url(#stone)"/>`;
  s += `<path d="${arch}" fill="none" stroke="#2a2c26" stroke-width="5" opacity=".6"/>`;
  for (let y = 620; y < 1160; y += 70) s += `<path d="M380,${y} L520,${y} M880,${y} L1020,${y}" stroke="#3a3b34" stroke-width="3" opacity=".7"/>`;
  // Runas que brillan dentro
  const runes = ['M0,0 L0,30 M0,8 L10,0', 'M0,0 L10,15 L0,30 M10,15 L18,15', 'M0,30 L0,0 L12,10 L0,18', 'M0,0 L14,30 M14,0 L0,30'];
  runes.forEach((d, i) => { const x = 610 + i * 50; s += `<g transform="translate(${x} 760)"><path d="${d}" stroke="#7affc8" stroke-width="6" opacity=".6" filter="url(#glowS)" fill="none"/><path d="${d}" stroke="#d8ffe8" stroke-width="2" fill="none"/></g>`; });
  // Musgo y enredaderas
  const mossR = rng(5); let moss = '';
  for (let i = 0; i < 70; i++) { const side = mossR() < 0.5; const x = side ? 380 + mossR() * 140 : 880 + mossR() * 140; const y = 300 + mossR() * 880; moss += `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${(14 + mossR() * 40).toFixed(0)}" ry="${(10 + mossR() * 26).toFixed(0)}"/>`; }
  for (let i = 0; i < 30; i++) { const t = mossR(); const x = 380 + t * 640; const y = 560 - Math.sin(t * Math.PI) * 380 + mossR() * 40; moss += `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${(20 + mossR() * 40).toFixed(0)}" ry="${(12 + mossR() * 20).toFixed(0)}"/>`; }
  s += `<g fill="#3f6a2e" filter="url(#foliage)">${moss}</g>`;
  for (let i = 0; i < 14; i++) { const x = 400 + mossR() * 600; s += `<path d="M${x.toFixed(0)},${(300 + mossR() * 200).toFixed(0)} q${(mossR() - 0.5) * 60},${200 + mossR() * 200} ${(mossR() - 0.5) * 30},${300 + mossR() * 300}" stroke="#2f5426" stroke-width="${(3 + mossR() * 4).toFixed(1)}" fill="none"/>`; }
  // Rayos de luz
  s += `<g filter="url(#blur8)"><path d="M820,0 L940,0 L700,1250 L560,1250 Z" fill="url(#shaft)"/><path d="M1000,0 L1060,0 L900,1200 L820,1200 Z" fill="url(#shaft)" opacity=".6"/></g>`;
  // Árboles retorcidos que enmarcan
  s += `<path d="M0,${S} L0,0 L120,0 C150,200 110,400 160,600 C200,800 140,1000 240,${S} Z" fill="#26302a" filter="url(#rock)"/>`;
  s += `<path d="M${S},${S} L${S},0 L1260,0 C1240,250 1300,450 1230,700 C1190,900 1260,1100 1160,${S} Z" fill="#26302a" filter="url(#rock)"/>`;
  s += deadTree(11, 140, 520, 180, -0.35, 26, '#26302a', 7) + deadTree(13, 1250, 480, 200, -2.8, 26, '#26302a', 7) + deadTree(17, 200, 900, 160, -0.6, 20, '#1e2620', 6);
  let moss2 = '';
  for (let i = 0; i < 40; i++) { const side = mossR() < 0.5; const x = side ? mossR() * 260 : S - mossR() * 260; const y = mossR() * S; moss2 += `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${(20 + mossR() * 60).toFixed(0)}" ry="${(14 + mossR() * 30).toFixed(0)}"/>`; }
  s += `<g fill="#2f5a26" filter="url(#foliage)">${moss2}</g>`;
  // Camino de piedras
  s += `<path d="M420,${S} L560,1180 L860,1180 L1040,${S} Z" fill="#5a5444" filter="url(#stone)"/>`;
  const st = rng(9); let stones = '';
  for (let i = 0; i < 40; i++) { const y = 1190 + st() * 210; const half = 150 + (y - 1180) * 0.8; const x = 700 + (st() - 0.5) * 2 * half; stones += `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${(10 + st() * 26).toFixed(0)}" ry="${(5 + st() * 10).toFixed(0)}"/>`; }
  s += `<g fill="#8a8470" filter="url(#stone)">${stones}</g>`;
  s += `<g fill="#3f6a2e" filter="url(#foliage)"><ellipse cx="460" cy="1300" rx="120" ry="60"/><ellipse cx="980" cy="1320" rx="140" ry="60"/><ellipse cx="700" cy="1400" rx="300" ry="50"/></g>`;
  s += hoodedFigure(700, 1180, 200, '#d8d4dc', '#ffffff', true, '#9affd0');
  s += `<ellipse cx="700" cy="1182" rx="50" ry="8" fill="#000" opacity=".4" filter="url(#soft)"/>`;
  s += noiseLayer('f2', 15, '0.004 0.02', 4, '#a8c8a8', 1.6, -0.75, 0, 1000, S, 400, 'opacity=".55"');
  s += finish('#2a8a5a', 0.2);
  return wrap(s);
}

/** Ocaso de sangre: torre del nigromante en el risco, cuervos y un dragón */
function ocaso() {
  let s = `<defs>${defs(77, { az: 200, el: 25, color: '#ffd8b0' })}
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a0610"/><stop offset=".35" stop-color="#5a1020"/><stop offset=".6" stop-color="#b8361e"/><stop offset=".72" stop-color="#f08a2a"/><stop offset=".8" stop-color="#ffc86a"/></linearGradient>
    <radialGradient id="sun" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff2c0"/><stop offset=".4" stop-color="#ffb84a" stop-opacity=".8"/><stop offset="1" stop-color="#ff6a1a" stop-opacity="0"/></radialGradient>
    <linearGradient id="cloudM" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".7" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="cm"><rect width="${S}" height="1000" fill="url(#cloudM)"/></mask>
  </defs>`;
  s += `<rect width="${S}" height="${S}" fill="url(#sky)"/>`;
  s += `<circle cx="700" cy="900" r="420" fill="url(#sun)"/>`;
  s += `<g mask="url(#cm)">${noiseLayer('c1', 3, '0.0018 0.006', 6, '#2a0812', 2.2, -0.9, 0, 0, S, 1000)}${noiseLayer('c2', 9, '0.003 0.009', 6, '#ff7a3a', 1.8, -1.0, 0, 200, S, 700, 'opacity=".55"')}${noiseLayer('c3', 21, '0.002 0.007', 5, '#7a1020', 2.0, -0.9, 0, 0, S, 800, 'opacity=".8"')}</g>`;
  s += dragon(330, 330, 1.5, '#1a0608') + birds(4, 26, 820, 220, 420, 300, '#14040a', 12);
  s += `<path d="${crags(13, 960, 140, 50, 0.4)}" fill="#5a1e24" filter="url(#rock)" opacity=".9"/>`;
  s += noiseLayer('mist', 33, '0.003 0.016', 5, '#ff9a5a', 1.6, -0.7, 0, 880, S, 200, 'opacity=".5"');
  // Risco central con la torre
  s += `<path d="M420,${S} L470,1100 L540,1020 L600,960 L640,900 L760,890 L820,940 L880,1010 L960,1120 L1020,${S} Z" fill="#3a1414" filter="url(#rock)"/>`;
  s += `<path d="M640,900 L640,420 L700,330 L760,420 L760,900 Z" fill="#2a1416" filter="url(#stone)"/>`;
  s += `<path d="M620,440 L780,440 L780,470 L620,470 Z M610,430 L700,250 L790,430 Z" fill="#241012" filter="url(#stone)"/>`;
  s += `<path d="M700,250 L700,190 M700,200 L720,214" stroke="#241012" stroke-width="5"/>`;
  for (const [x, y] of [[682, 500], [682, 600], [682, 720], [682, 820]]) s += gothWindow(x, y, 36, 56, '#8affa0');
  s += `<circle cx="700" cy="330" r="40" fill="#8affa0" opacity=".25" filter="url(#glow)"/>`;
  // Riscos laterales y árboles muertos
  s += sideWall(5, 'L', 760, 420, '#200a0c') + sideWall(15, 'R', 820, 380, '#200a0c');
  s += deadTree(21, 180, 1000, 200, -1.2, 30, '#120406', 8) + deadTree(23, 1240, 1040, 200, -1.9, 30, '#120406', 8);
  // Camino y figura
  s += `<path d="M640,${S} C660,1280 700,1180 690,1080 L720,1080 C740,1180 760,1290 820,${S} Z" fill="#6a3424" filter="url(#stone)"/>`;
  s += hoodedFigure(706, 1210, 130, '#140608', '#ffb070', true);
  // Brasas
  const er = rng(31); for (let i = 0; i < 60; i++) { const x = er() * S; const y = 500 + er() * 900; s += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(1 + er() * 2.4).toFixed(1)}" fill="#ffb060" opacity="${(0.3 + er() * 0.6).toFixed(2)}"/>`; }
  s += finish('#ff6a2a', 0.22);
  return wrap(s);
}

/** Cumbres: puerta enana tallada en un acantilado, con dos reyes de piedra y braseros */
function cumbres() {
  let s = `<defs>${defs(91, { az: 120, el: 30, color: '#dfe8ff' })}
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05070d"/><stop offset=".45" stop-color="#18202e"/><stop offset=".7" stop-color="#34404f"/></linearGradient>
    <radialGradient id="moon" cx="40%" cy="40%" r="60%"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#d8dfe8"/><stop offset="1" stop-color="#9aa6b8"/></radialGradient>
    <radialGradient id="fire" cx="50%" cy="60%" r="50%"><stop offset="0" stop-color="#fff0b0"/><stop offset=".35" stop-color="#ff9a2a" stop-opacity=".8"/><stop offset="1" stop-color="#ff5a0a" stop-opacity="0"/></radialGradient>
    <radialGradient id="warm" cx="50%" cy="70%" r="50%"><stop offset="0" stop-color="#ff9a3a" stop-opacity=".55"/><stop offset="1" stop-color="#ff9a3a" stop-opacity="0"/></radialGradient>
    <linearGradient id="portal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a1404"/><stop offset=".6" stop-color="#c25a14"/><stop offset="1" stop-color="#ffd27a"/></linearGradient>
    <clipPath id="snowC"><rect x="0" y="0" width="${S}" height="560"/></clipPath>
  </defs>`;
  s += `<rect width="${S}" height="${S}" fill="url(#sky)"/>` + stars(9, 500, 600, ['#ffffff', '#dfe8ff']);
  s += `<circle cx="1020" cy="210" r="170" fill="#cfe0ff" opacity=".16" filter="url(#glow)"/><circle cx="1020" cy="210" r="86" fill="url(#moon)"/><circle cx="1020" cy="210" r="86" fill="#8a96aa" opacity=".3" filter="url(#stone)"/>`;
  s += noiseLayer('cl', 5, '0.002 0.01', 5, '#8a96b0', 1.7, -0.75, 0, 120, S, 380, 'opacity=".55"');
  s += dragon(300, 290, 1.1, '#0c0f16', true);
  // Cordillera lejana con nieve
  const far = crags(3, 760, 420, 90, 0.8);
  s += `<path d="${far}" fill="#5a6476" filter="url(#rock)"/><path d="${far}" fill="#e8eef6" filter="url(#rock)" clip-path="url(#snowC)" opacity=".95"/>` + shadeShape(far, 0, 0.5, '#0a0e16', 340, 900);
  s += noiseLayer('mist', 13, '0.003 0.015', 5, '#9aa8c8', 1.6, -0.55, 0, 600, S, 300, 'opacity=".7"');
  // Acantilado con la puerta
  const cliff = 'M120,1400 L160,900 L260,700 L420,620 L560,560 L840,560 L980,620 L1140,700 L1240,900 L1280,1400 Z';
  s += `<path d="${cliff}" fill="#56606e" filter="url(#rock)"/>` + shadeShape(cliff, 0.1, 0.7, '#05070c', 560, 1400);
  const cr = rng(77); for (let i = 0; i < 14; i++) { let x = 180 + cr() * 1040; if (x > 480 && x < 920) x += x < 700 ? -300 : 300; let y = 640 + cr() * 200; let d = `M${x.toFixed(0)},${y.toFixed(0)}`; for (let k = 0; k < 6; k++) { x += (cr() - 0.5) * 40; y += 40 + cr() * 50; d += ` L${x.toFixed(0)},${y.toFixed(0)}`; } s += `<path d="${d}" stroke="#20262f" stroke-width="${(2 + cr() * 3).toFixed(1)}" fill="none" opacity=".8"/>`; }
  for (const y of [700, 800, 960]) s += `<path d="M${200 + (y % 7) * 10},${y} Q${400},${y - 20} ${470},${y + 10} M${930},${y + 6} Q${1060},${y - 14} ${1220 - (y % 5) * 10},${y + 4}" stroke="#7a8494" stroke-width="3" opacity=".35" fill="none"/>`;
  // Portal escalonado
  for (let i = 0; i < 4; i++) { const k = i * 26; s += `<path d="M${520 + k},1180 L${520 + k},${820 + k} Q${700},${640 + k * 1.3} ${880 - k},${820 + k} L${880 - k},1180 Z" fill="${['#4a5462', '#3e4756', '#333b48', '#2a313c'][i]}" filter="url(#stone)"/>`; }
  s += `<path d="M626,1180 L626,930 Q700,830 774,930 L774,1180 Z" fill="url(#portal)"/><path d="M626,1180 L626,930 Q700,830 774,930 L774,1180 Z" fill="#ffb24a" opacity=".45" filter="url(#glow)"/>`;
  s += `<circle cx="700" cy="1150" r="420" fill="url(#warm)"/>`;
  // Runas sobre el arco
  s += `<path d="M610,800 L790,800" stroke="#ffcf7a" stroke-width="4" opacity=".7" stroke-dasharray="18 10" filter="url(#glowS)"/>`;
  // Reyes de piedra con la espada clavada delante
  const statue = (x) => `<path d="M${x - 90},1180 L${x - 90},1112 L${x + 90},1112 L${x + 90},1180 Z"/>
    <path d="M${x - 70},1112 L${x - 46},904 L${x + 46},904 L${x + 70},1112 Z"/>
    <path d="M${x - 66},830 Q${x - 70},806 ${x - 40},800 L${x + 40},800 Q${x + 70},806 ${x + 66},830 L${x + 48},912 L${x - 48},912 Z"/>
    <ellipse cx="${x - 62}" cy="826" rx="26" ry="20"/><ellipse cx="${x + 62}" cy="826" rx="26" ry="20"/>
    <path d="M${x - 80},836 Q${x - 74},884 ${x - 20},884 L${x - 14},862 Q${x - 52},862 ${x - 56},830 Z"/><path d="M${x + 80},836 Q${x + 74},884 ${x + 20},884 L${x + 14},862 Q${x + 52},862 ${x + 56},830 Z"/>
    <ellipse cx="${x}" cy="870" rx="24" ry="15"/>
    <path d="M${x - 28},762 Q${x - 30},726 ${x},720 Q${x + 30},726 ${x + 28},762 L${x + 24},792 L${x - 24},792 Z"/>
    <path d="M${x - 32},752 Q${x},704 ${x + 32},752 L${x + 34},760 L${x - 34},760 Z"/>
    <path d="M${x - 28},746 C${x - 60},744 ${x - 74},718 ${x - 68},690 C${x - 64},710 ${x - 52},726 ${x - 28},734 Z"/><path d="M${x + 28},746 C${x + 60},744 ${x + 74},718 ${x + 68},690 C${x + 64},710 ${x + 52},726 ${x + 28},734 Z"/>
    <path d="M${x - 24},778 Q${x},792 ${x + 24},778 L${x + 16},846 L${x + 6},872 L${x},850 L${x - 6},872 L${x - 16},846 Z"/>
    <path d="M${x - 8},886 L${x + 8},886 L${x + 8},1104 L${x},1120 L${x - 8},1104 Z"/><path d="M${x - 46},878 L${x + 46},878 L${x + 46},890 L${x - 46},890 Z"/>`;
  for (const x of [380, 1020]) {
    const inner = x < 700 ? 1 : -1;
    s += `<clipPath id="st${x}">${statue(x)}</clipPath><g fill="#5a6370" filter="url(#stone)">${statue(x)}</g>`;
    s += `<linearGradient id="sw${x}" x1="${inner > 0 ? 1 : 0}" y1="0" x2="${inner > 0 ? 0 : 1}" y2="0"><stop offset="0" stop-color="#ff9a3a" stop-opacity=".55"/><stop offset=".5" stop-color="#ff9a3a" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></linearGradient><rect x="${x - 110}" y="680" width="220" height="500" fill="url(#sw${x})" clip-path="url(#st${x})"/>`;
    s += `<g fill="none" stroke="#10131a" stroke-width="3" opacity=".8">${statue(x)}</g>`;
    s += `<path d="M${x - 20},768 l12,0 M${x + 8},768 l12,0" stroke="#ffcf7a" stroke-width="3" opacity=".9" filter="url(#glowS)"/>`;
    s += `<path d="${'M' + (x - 92) + ',1180 L' + (x - 92) + ',1112 L' + (x + 92) + ',1112 L' + (x + 92) + ',1180 Z'}" fill="#000" opacity=".25"/>`;
  }
  // Escalinata
  for (let i = 0; i < 9; i++) s += `<rect x="${560 - i * 26}" y="${1180 + i * 25}" width="${280 + i * 52}" height="25" fill="${i % 2 ? '#4a5262' : '#555e70'}" filter="url(#stone)"/>`;
  s += shadeShape('M326,1180 L1074,1180 L1100,1400 L300,1400 Z', 0.1, 0.6, '#000', 1180, 1400);
  // Braseros
  for (const x of [560, 840]) s += `<path d="M${x - 22},1180 L${x - 14},1120 L${x + 14},1120 L${x + 22},1180 Z" fill="#2a2a30"/><circle cx="${x}" cy="1090" r="80" fill="url(#fire)"/><path d="M${x - 16},1122 q-6,-40 16,-70 q22,30 16,70 Z" fill="#ffb84a"/><path d="M${x - 7},1122 q-2,-20 7,-36 q9,16 7,36 Z" fill="#fff2c0"/>`;
  // Nieve que cae
  const sr = rng(41); for (let i = 0; i < 260; i++) s += `<circle cx="${(sr() * S).toFixed(0)}" cy="${(sr() * S).toFixed(0)}" r="${(0.8 + sr() * 2.2).toFixed(1)}" fill="#fff" opacity="${(0.3 + sr() * 0.6).toFixed(2)}"/>`;
  s += hoodedFigure(700, 1300, 96, '#14161e', '#ffcf8a', true);
  s += finish('#4a6aa0', 0.2);
  return wrap(s);
}

/** Mar de tormenta: faro en ruinas, un barco y los tentáculos del kraken */
function mar() {
  let s = `<defs>${defs(113, { az: 300, el: 30, color: '#cfe0ff' })}
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#03060c"/><stop offset=".55" stop-color="#16263a"/><stop offset=".68" stop-color="#2a4058"/></linearGradient>
    <linearGradient id="sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c3246"/><stop offset="1" stop-color="#050b14"/></linearGradient>
    <linearGradient id="beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff2b0" stop-opacity=".55"/><stop offset="1" stop-color="#fff2b0" stop-opacity="0"/></linearGradient>
  </defs>`;
  s += `<rect width="${S}" height="${S}" fill="url(#sky)"/>`;
  s += noiseLayer('st1', 3, '0.0025 0.006', 6, '#0a121c', 2.0, -0.6, 0, 0, S, 900) + noiseLayer('st2', 7, '0.004 0.01', 5, '#4a6a8a', 1.8, -1.0, 0, 0, S, 900, 'opacity=".6"');
  // Rayo
  s += `<path d="M380,0 L360,120 L400,170 L340,320 L390,360 L330,560" stroke="#cfe6ff" stroke-width="10" fill="none" opacity=".5" filter="url(#glowS)"/><path d="M380,0 L360,120 L400,170 L340,320 L390,360 L330,560" stroke="#ffffff" stroke-width="3" fill="none"/>`;
  s += `<rect x="0" y="880" width="${S}" height="520" fill="url(#sea)"/>`;
  s += noiseLayer('w1', 11, '0.004 0.04', 4, '#8ab0d0', 2.0, -1.15, 0, 880, S, 520, 'opacity=".55"');
  // Haz del faro
  s += `<path d="M720,470 L0,330 L0,620 Z" fill="url(#beam)" filter="url(#blur8)" transform="scale(-1 1) translate(-1440 0)"/>`;
  // Acantilado y faro
  s += `<path d="M520,${S} L560,1060 L620,900 L700,860 L820,870 L880,940 L960,1100 L1020,${S} Z" fill="#2a3240" filter="url(#rock)"/>`;
  s += `<path d="M680,870 L700,500 L780,500 L800,870 Z" fill="#5a6070" filter="url(#stone)"/><path d="M690,500 L790,500 L790,470 L690,470 Z" fill="#3a404c"/><rect x="705" y="420" width="70" height="50" fill="#fff2b0"/><circle cx="740" cy="445" r="70" fill="#fff2b0" opacity=".4" filter="url(#glow)"/><path d="M690,420 L740,370 L790,420 Z" fill="#3a404c"/>`;
  s += `<path d="M772,520 L800,560 L790,620 L778,600 Z" fill="#1a1e26"/>`;
  // Barco
  s += `<g transform="translate(340 960) rotate(-8)"><path d="M-120,0 L120,0 L90,50 L-90,50 Z" fill="#1a120c" filter="url(#stone)"/><path d="M-10,0 L-10,-230 M60,0 L60,-170" stroke="#1a120c" stroke-width="7"/><path d="M-8,-220 Q70,-150 -6,-40 Z" fill="#c8c0a8" filter="url(#stone)"/><path d="M62,-160 Q120,-110 64,-40 Z" fill="#b0a890" filter="url(#stone)"/><path d="M-10,-230 L30,-222 L-10,-212" fill="#8a1a1a"/></g>`;
  // Tentáculos del kraken
  const tent = (x, y, h, flip, sc = 1) => `<g transform="translate(${x} ${y}) scale(${flip ? -sc * 2.4 : sc * 2.4} ${sc})"><path d="M0,0 C-10,-${h * 0.4} 40,-${h * 0.6} 20,-${h * 0.85} C10,-${h} -30,-${h * 0.95} -26,-${h * 0.8} C-20,-${h * 0.7} 0,-${h * 0.75} 4,-${h * 0.82} C14,-${h * 0.66} -30,-${h * 0.4} -40,0 Z" fill="#3a2a40" filter="url(#rock)"/>${Array.from({ length: 6 }, (_, i) => `<circle cx="${-8 + i * 2}" cy="${-h * (0.15 + i * 0.1)}" r="${5 - i * 0.5}" fill="#a88aa0"/>`).join('')}</g>`;
  s += tent(180, 1120, 380, false, 1.1) + tent(560, 1060, 300, true) + tent(1180, 1140, 460, true, 1.2) + tent(1000, 1100, 260, false);
  s += noiseLayer('foam', 19, '0.01 0.05', 4, '#dfeaf2', 2.2, -1.5, 0, 1000, S, 400, 'opacity=".6"');
  s += `<path d="${crags(29, 1330, 60, 40, 0.5)}" fill="#0c1018" filter="url(#rock)"/>`;
  s += finish('#3a6aa0', 0.2);
  return wrap(s);
}

/** Mazmorra: pasillo de columnas con antorchas hacia una puerta encendida */
function mazmorra() {
  let s = `<defs>${defs(131, { az: 90, el: 30, color: '#ffd8a8' })}
    <radialGradient id="door" cx="50%" cy="60%" r="60%"><stop offset="0" stop-color="#ffe2a0"/><stop offset=".5" stop-color="#d0601a"/><stop offset="1" stop-color="#3a0a04"/></radialGradient>
    <radialGradient id="torch" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffcf6a" stop-opacity=".7"/><stop offset="1" stop-color="#ff6a1a" stop-opacity="0"/></radialGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2a22"/><stop offset="1" stop-color="#120c0a"/></linearGradient>
  </defs>`;
  s += `<rect width="${S}" height="${S}" fill="#0c0807"/>`;
  s += `<path d="M0,0 L${S},0 L780,600 L620,600 Z" fill="#1e1614" filter="url(#stone)"/>`;
  s += `<path d="M0,${S} L${S},${S} L780,820 L620,820 Z" fill="url(#floor)"/><path d="M0,${S} L${S},${S} L780,820 L620,820 Z" fill="#4a3a30" opacity=".5" filter="url(#stone)"/>`;
  for (let i = 1; i < 10; i++) { const t = i / 10; const y = 820 + (S - 820) * t * t; s += `<path d="M${700 - (80 + 620 * t * t)},${y} L${700 + 80 + 620 * t * t},${y}" stroke="#0a0606" stroke-width="${1 + t * 3}" opacity=".7"/>`; }
  for (let i = -6; i <= 6; i++) s += `<path d="M${700 + i * 14},820 L${700 + i * 160},${S}" stroke="#0a0606" stroke-width="2" opacity=".5"/>`;
  s += `<path d="M620,820 L620,620 Q700,560 780,620 L780,820 Z" fill="url(#door)"/><path d="M620,820 L620,620 Q700,560 780,620 L780,820 Z" fill="#ffb060" opacity=".6" filter="url(#glow)"/>`;
  s += hoodedFigure(700, 815, 70, '#120808', '#ffcf8a', false);
  // Columnas que se alejan
  const depths = [0.12, 0.2, 0.32, 0.5, 0.78];
  for (const side of [-1, 1]) for (const t of depths) {
    const x = 700 + side * (110 + 560 * t * 1.1); const w = 26 + 220 * t; const top = 600 - 600 * t * 1.05; const bot = 820 + (S - 820) * t * 1.1;
    s += `<rect x="${x - w / 2}" y="${top}" width="${w}" height="${bot - top}" fill="#3a2e28" filter="url(#stone)"/><rect x="${x - w / 2 - w * 0.12}" y="${bot - w * 0.3}" width="${w * 1.24}" height="${w * 0.3}" fill="#2a201c" filter="url(#stone)"/>`;
    if (t > 0.2) { const ty = top + (bot - top) * 0.42; const tx = x - side * w * 0.6; s += `<circle cx="${tx}" cy="${ty}" r="${120 * t + 40}" fill="url(#torch)"/><rect x="${tx - 3 - 4 * t}" y="${ty}" width="${6 + 8 * t}" height="${40 * t + 20}" fill="#2a1a10"/><path d="M${tx},${ty - 40 * t - 16} q-${10 + 14 * t},${22 + 20 * t} 0,${34 + 30 * t} q${10 + 14 * t},${-12 - 10 * t} 0,${-34 - 30 * t} Z" fill="#ffb84a"/><path d="M${tx},${ty - 20 * t - 6} q-${4 + 6 * t},${12 + 10 * t} 0,${18 + 16 * t} q${4 + 6 * t},${-6 - 6 * t} 0,${-18 - 16 * t} Z" fill="#fff0b0"/>`; }
  }
  // Arcos del techo
  for (const t of depths) { const w = 110 + 560 * t * 1.1; const top = 600 - 600 * t * 1.05; s += `<path d="M${700 - w},${top} Q700,${top - 200 * t - 40} ${700 + w},${top}" stroke="#2a201c" stroke-width="${10 + 40 * t}" fill="none" filter="url(#stone)"/>`; }
  // Cadenas y calavera
  s += `<path d="M260,0 L280,420 M1140,0 L1120,380" stroke="#1a1410" stroke-width="6" stroke-dasharray="14 6"/>`;
  s += `<g transform="translate(420 1260)"><ellipse cx="0" cy="0" rx="46" ry="40" fill="#d8ccb0" filter="url(#stone)"/><ellipse cx="-16" cy="-4" rx="11" ry="13" fill="#140c08"/><ellipse cx="16" cy="-4" rx="11" ry="13" fill="#140c08"/><path d="M-4,14 L0,6 L4,14 Z" fill="#140c08"/><rect x="-22" y="28" width="44" height="16" fill="#cabfa4"/></g>`;
  s += noiseLayer('mist', 7, '0.004 0.02', 4, '#8a6a5a', 1.5, -0.7, 0, 900, S, 500, 'opacity=".5"');
  s += finish('#ff8a3a', 0.18);
  return wrap(s);
}

/** Ciudadela del desierto al alba con una caravana en las dunas */
function ciudadela() {
  let s = `<defs>${defs(151, { az: 230, el: 26, color: '#ffe6d0' })}
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#150f34"/><stop offset=".38" stop-color="#4e3474"/><stop offset=".6" stop-color="#c46a84"/><stop offset=".74" stop-color="#f4b884"/></linearGradient>
    <radialGradient id="moonD" cx="45%" cy="40%" r="60%"><stop offset="0" stop-color="#fff4e0"/><stop offset="1" stop-color="#e8b8a0"/></radialGradient>
    <linearGradient id="dune" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d89060"/><stop offset="1" stop-color="#6a3020"/></linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#a8641a"/></linearGradient>
  </defs>`;
  s += `<rect width="${S}" height="${S}" fill="url(#sky)"/>` + stars(15, 260, 420);
  s += `<circle cx="700" cy="560" r="330" fill="#ffe0c8" opacity=".18" filter="url(#glow)"/><circle cx="700" cy="560" r="250" fill="url(#moonD)"/><circle cx="700" cy="560" r="250" fill="#d8a890" opacity=".28" filter="url(#stone)"/>`;
  s += noiseLayer('cl', 5, '0.002 0.012', 5, '#b86a8a', 1.6, -0.75, 0, 360, S, 360, 'opacity=".55"');
  // Mesa rocosa
  const mesa = 'M240,1400 L300,1080 L380,960 L460,900 L940,900 L1020,960 L1100,1080 L1160,1400 Z';
  s += `<path d="${mesa}" fill="#9a5a50" filter="url(#rock)"/>` + shadeShape(mesa, 0.05, 0.7, '#1a0608', 900, 1400);
  // Murallas escalonadas con almenas
  const wall = (x0, x1, y, h, col) => { let w = `<rect x="${x0}" y="${y - h}" width="${x1 - x0}" height="${h}" fill="${col}"/>`; for (let x = x0; x < x1 - 8; x += 22) w += `<rect x="${x}" y="${y - h - 12}" width="12" height="12" fill="${col}"/>`; return w; };
  let c = wall(440, 960, 905, 70, '#e6b8a0') + wall(500, 900, 835, 60, '#ecc4ac') + wall(560, 840, 775, 50, '#f2ccb4');
  // Torres y cúpulas
  const tower = (x, top, w, cap) => { let t = `<rect x="${x - w / 2}" y="${top}" width="${w}" height="${905 - top}" fill="#f0c8b0"/>`; t += cap === 'dome' ? `<path d="M${x - w / 2 - 4},${top} Q${x - w / 2},${top - w * 1.1} ${x},${top - w * 1.3} Q${x + w / 2},${top - w * 1.1} ${x + w / 2 + 4},${top} Z" fill="url(#gold)"/><path d="M${x},${top - w * 1.3} L${x},${top - w * 1.7}" stroke="#ffe08a" stroke-width="3"/>` : `<path d="M${x - w / 2 - 6},${top} L${x},${top - w * 1.8} L${x + w / 2 + 6},${top} Z" fill="#c86a50"/>`; return t; };
  c += tower(470, 760, 34, 'cone') + tower(930, 770, 34, 'cone') + tower(560, 640, 40, 'dome') + tower(840, 650, 40, 'dome') + tower(640, 560, 30, 'cone') + tower(760, 570, 30, 'cone');
  c += `<rect x="650" y="520" width="100" height="260" fill="#f4d0b8"/><path d="M640,520 Q640,410 700,390 Q760,410 760,520 Z" fill="url(#gold)"/><path d="M700,390 L700,330" stroke="#ffe08a" stroke-width="4"/><circle cx="700" cy="326" r="6" fill="#ffe08a"/>`;
  s += `<g filter="url(#stone)">${c}</g>`;
  const wr = rng(3); for (let i = 0; i < 40; i++) { const x = 470 + wr() * 460; const y = 600 + wr() * 290; s += `<path d="M${x.toFixed(0)},${(y + 14).toFixed(0)} L${x.toFixed(0)},${(y + 4).toFixed(0)} Q${(x + 3).toFixed(0)},${y.toFixed(0)} ${(x + 6).toFixed(0)},${(y + 4).toFixed(0)} L${(x + 6).toFixed(0)},${(y + 14).toFixed(0)} Z" fill="#ffd68a"/>`; }
  s += `<circle cx="700" cy="760" r="160" fill="#ffd68a" opacity=".12" filter="url(#glow)"/>`;
  // Cascada desde la mesa
  s += `<path d="M960,930 L990,930 L1040,1250 L990,1250 Z" fill="#d8ecf6" opacity=".9"/>` + noiseLayer('wf', 9, '0.05 0.008', 3, '#ffffff', 2, -1.1, 960, 930, 80, 320);
  s += noiseLayer('spray', 12, '0.01', 3, '#ffffff', 1.6, -0.8, 940, 1200, 140, 90, 'opacity=".6"');
  // Dunas
  const d1 = 'M0,1130 Q300,1060 600,1140 T1400,1110 L1400,1400 L0,1400 Z';
  s += `<path d="${d1}" fill="url(#dune)" filter="url(#stone)"/>`;
  const d2 = 'M0,1260 Q400,1180 800,1270 T1400,1240 L1400,1400 L0,1400 Z';
  s += `<path d="${d2}" fill="#5a2818" filter="url(#stone)"/>`;
  // Caravana: camellos y viajeros a contraluz
  const camel = (x, y, k) => `<g transform="translate(${x} ${y}) scale(${k})" fill="#24100c"><path d="M-46,0 L-42,-36 Q-40,-62 -14,-60 Q-4,-78 10,-62 Q24,-80 34,-58 L48,-66 L60,-82 L70,-78 L62,-60 L52,-40 L46,0 L38,0 L36,-28 L-30,-28 L-34,0 Z"/><path d="M-10,-60 L-6,-84 L4,-84 L6,-62 Z" fill="#6a2a2a"/></g>`;
  s += camel(420, 1196, 1.1) + hoodedFigure(520, 1198, 66, '#24100c', '#ffc89a', true) + camel(640, 1192, 1.2) + hoodedFigure(740, 1190, 70, '#24100c', '#ffc89a', true) + camel(860, 1186, 1.15);
  s += finish('#d07a5a', 0.2);
  return wrap(s);
}

/** Cripta: capilla gótica en el cementerio bajo la luna llena */
function cripta() {
  let s = `<defs>${defs(171, { az: 60, el: 30, color: '#e0e8ff' })}
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05040a"/><stop offset=".6" stop-color="#1e1a30"/><stop offset=".8" stop-color="#2e2a40"/></linearGradient>
    <radialGradient id="moon" cx="45%" cy="45%" r="60%"><stop offset="0" stop-color="#fffbe8"/><stop offset="1" stop-color="#d8d0c0"/></radialGradient>
  </defs>`;
  s += `<rect width="${S}" height="${S}" fill="url(#sky)"/>` + stars(19, 300, 600);
  s += `<circle cx="700" cy="420" r="300" fill="#e8e4ff" opacity=".16" filter="url(#glow)"/><circle cx="700" cy="420" r="210" fill="url(#moon)"/><circle cx="700" cy="420" r="210" fill="#a8a090" opacity=".35" filter="url(#stone)"/>`;
  s += noiseLayer('cl', 3, '0.0022 0.009', 6, '#14121e', 2.0, -0.85, 0, 200, S, 520);
  s += birds(8, 18, 300, 160, 800, 300, '#07060a', 14);
  // Capilla
  s += `<path d="M520,1100 L520,760 L700,600 L880,760 L880,1100 Z" fill="#2c2a34" filter="url(#stone)"/>`;
  s += gothicTower(640, 760, 120, 260, '#2c2a34', '#ffbf6a', 5);
  s += `<circle cx="700" cy="860" r="46" fill="#ffbf6a"/><circle cx="700" cy="860" r="46" fill="#ffbf6a" opacity=".6" filter="url(#glow)"/>`;
  for (let a = 0; a < 8; a++) s += `<path d="M700,860 L${700 + Math.cos((a * Math.PI) / 4) * 46},${860 + Math.sin((a * Math.PI) / 4) * 46}" stroke="#2c2a34" stroke-width="5"/>`;
  s += `<path d="M640,1100 L640,980 Q700,920 760,980 L760,1100 Z" fill="#0a0808"/>`;
  // Lápidas y árbol
  s += `<path d="${crags(5, 1100, 30, 50, 0.2)}" fill="#1a1820" filter="url(#rock)"/>`;
  const g = rng(11); for (let i = 0; i < 16; i++) { const x = 60 + g() * 1280; if (x > 500 && x < 900) continue; const y = 1120 + g() * 220; const w = 30 + g() * 40; const h = 50 + g() * 70; s += g() < 0.4 ? `<path d="M${x - 6},${y} L${x - 6},${y - h} M${x - 26},${y - h * 0.72} L${x + 14},${y - h * 0.72}" stroke="#4a4652" stroke-width="12" filter="url(#stone)"/>` : `<path d="M${x - w / 2},${y} L${x - w / 2},${y - h + w / 2} Q${x},${y - h - w / 4} ${x + w / 2},${y - h + w / 2} L${x + w / 2},${y} Z" fill="#4a4652" filter="url(#stone)" transform="rotate(${(g() - 0.5) * 14} ${x} ${y})"/>`; }
  s += deadTree(9, 230, 1180, 230, -1.35, 34, '#0a080c', 8) + deadTree(12, 1180, 1200, 210, -1.75, 30, '#0a080c', 8);
  s += noiseLayer('mist', 15, '0.003 0.014', 5, '#b8b4d0', 1.7, -0.6, 0, 1000, S, 400, 'opacity=".6"');
  s += hoodedFigure(760, 1290, 120, '#0c0a10', '#c8c8ff', false);
  s += `<circle cx="790" cy="1230" r="30" fill="#ffcf6a" opacity=".6" filter="url(#glow)"/><rect x="784" y="1222" width="12" height="16" fill="#ffe0a0"/>`;
  s += finish('#5a4a9a', 0.2);
  return wrap(s);
}

module.exports = { ocaso, bosque, cumbres, abismo, mar, mazmorra, ciudadela, cripta };
