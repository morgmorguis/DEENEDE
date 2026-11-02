// Retrato pixel art del personaje (busto de 32×32 píxeles) a partir de su aspecto: especie, piel,
// peinado, barba, ropa, tocado y detalles. Se dibuja por capas con contorno y se exporta como imagen.
import type { Physical } from '../types';
import { T } from '../i18n';

export type HairStyle = 'bald' | 'short' | 'long' | 'ponytail' | 'bun' | 'mohawk' | 'braids' | 'curly';
export type Beard = 'none' | 'stubble' | 'short' | 'long';
export type Outfit = 'tunic' | 'robe' | 'leather' | 'plate' | 'cloak';
export type Headgear = 'none' | 'hood' | 'wizard' | 'helmet' | 'circlet';
export type Feature = 'none' | 'scar' | 'eyepatch' | 'warpaint' | 'freckles';
export type Backdrop = 'night' | 'forest' | 'dungeon' | 'sunset' | 'tavern';

export interface AvatarLook {
  skin: string;
  ears: 'round' | 'pointy';
  horns: boolean;
  tusks: boolean;
  snout: boolean;
  hair: HairStyle;
  hairColor: string;
  beard: Beard;
  eyes: string;
  outfit: Outfit;
  outfitColor: string;
  headgear: Headgear;
  feature: Feature;
  backdrop: Backdrop;
  halo: boolean;
}

export const SKINS = ['#f2d0b1', '#e0ac85', '#c68863', '#9a6544', '#6b4430', '#9fbf7a', '#7a9a6a', '#c9604f', '#8f6fc0', '#6f8fb0', '#c9a24a', '#b9b9c2'];
export const HAIR_COLORS = ['#1e1a18', '#4a2f1d', '#8a5a2b', '#d9b45a', '#a8402a', '#e8e2d6', '#8c8c8c', '#3b5fa8', '#3f8a4a', '#7a3fa0'];
export const EYE_COLORS = ['#3a6fb0', '#4f8a3a', '#6b4a2a', '#2a2a2a', '#c9a227', '#b03a3a', '#8a4ab0'];
export const OUTFIT_COLORS = ['#7a2f2a', '#2f4f7a', '#3f6a3a', '#5a3a6f', '#6b5236', '#3a3a3a', '#a07a2a', '#d9d2c0'];

type Grid = (string | null)[][];
const N = 32;
const blank = (): Grid => Array.from({ length: N }, () => Array<string | null>(N).fill(null));

class Layer {
  px: Grid = blank();
  set(x: number, y: number, c: string) { if (x >= 0 && y >= 0 && x < N && y < N) this.px[y][x] = c; }
  rect(x0: number, y0: number, x1: number, y1: number, c: string) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, c); }
  ellipse(x0: number, y0: number, x1: number, y1: number, c: string, when?: (x: number, y: number) => boolean) {
    const cx = (x0 + x1) / 2; const cy = (y0 + y1) / 2; const rx = (x1 - x0) / 2 + 0.5; const ry = (y1 - y0) / 2 + 0.5;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 && (!when || when(x, y))) this.set(x, y, c);
  }
  recolor(c: string, when: (x: number, y: number) => boolean) { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (this.px[y][x] && when(x, y)) this.px[y][x] = c; }
  outlined(ink = '#140f0c') {
    const o = new Layer();
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) o.px[y][x] = this.px[y][x];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (this.px[y][x]) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => this.px[y + dy]?.[x + dx])) o.px[y][x] = ink;
    }
    return o;
  }
}

/** Oscurece o aclara un color hex */
function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)));
  const r = ch(n >> 16); const g = ch((n >> 8) & 255); const b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function backdrop(kind: Backdrop): Layer {
  const l = new Layer();
  const sky: Record<Backdrop, [string, string]> = {
    night: ['#141a33', '#24305a'], forest: ['#13281c', '#24442e'], dungeon: ['#26201c', '#3a302a'], sunset: ['#5a2a3a', '#c4683a'], tavern: ['#3a2416', '#6a4426'],
  };
  const [a, b] = sky[kind];
  // Bandas con tramado, como los fondos de los juegos de los 90
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const t = y / (N - 1);
    l.set(x, y, t < 0.45 ? a : t > 0.6 ? b : (x + y) % 2 ? a : b);
  }
  if (kind === 'night') [[3, 3], [27, 5], [7, 9], [24, 12], [29, 2], [14, 2]].forEach(([x, y]) => l.set(x, y, '#e8e4c8'));
  if (kind === 'forest') for (let x = 0; x < N; x += 5) { l.rect(x + 1, 14, x + 2, 31, '#0e1f15'); l.rect(x, 12, x + 3, 16, '#0e1f15'); }
  if (kind === 'dungeon') for (let y = 2; y < N; y += 4) for (let x = (y / 4) % 2 ? 0 : 3; x < N; x += 6) l.rect(x, y, x + 4, y, '#1c1714');
  if (kind === 'sunset') l.ellipse(22, 16, 30, 24, '#f2b45a');
  if (kind === 'tavern') { l.rect(2, 6, 5, 10, '#f0b84a'); l.rect(26, 6, 29, 10, '#f0b84a'); l.rect(3, 7, 4, 9, '#fff0b0'); l.rect(27, 7, 28, 9, '#fff0b0'); }
  return l;
}

/** Dibuja el retrato y devuelve la cuadrícula de colores */
export function drawAvatar(look: AvatarLook): Grid {
  const skin = look.skin;
  const skinDark = shade(skin, -0.22);
  const skinLight = shade(skin, 0.25);
  const hair = look.hairColor;
  const hairDark = shade(hair, -0.3);
  const cloth = look.outfitColor;
  const clothDark = shade(cloth, -0.3);
  const metal = '#9aa3ad';

  // ---- Ropa (hombros y pecho) ----
  const body = new Layer();
  body.ellipse(4, 23, 27, 38, cloth);
  body.rect(13, 21, 18, 24, skinDark); // cuello
  body.recolor(clothDark, (x, y) => x > 20 && y > 24 && body.px[y][x] === cloth);
  if (look.outfit === 'robe') { for (let i = 0; i < 6; i++) { body.set(15 - i, 24 + i, clothDark); body.set(16 + i, 24 + i, clothDark); } body.rect(15, 25, 16, 31, '#d9c58a'); }
  if (look.outfit === 'leather') { body.recolor('#6b4426', (x, y) => y > 22 && body.px[y][x] !== skinDark); for (let i = 0; i < 9; i++) body.set(9 + i, 23 + i, '#3a2414'); body.set(14, 28, '#c9a227'); }
  if (look.outfit === 'plate') { body.recolor(metal, (x, y) => y > 22 && body.px[y][x] !== skinDark); body.ellipse(3, 23, 11, 29, '#b8c0c8'); body.ellipse(20, 23, 28, 29, '#b8c0c8'); body.rect(15, 26, 16, 31, '#6f7780'); body.set(8, 25, '#e8eef4'); body.set(23, 25, '#e8eef4'); }
  if (look.outfit === 'cloak') { body.ellipse(3, 22, 28, 40, clothDark); body.ellipse(9, 24, 22, 40, cloth); body.rect(14, 23, 17, 25, '#c9a227'); body.rect(13, 21, 18, 22, skinDark); }
  if (look.outfit === 'tunic') { body.rect(13, 24, 18, 25, shade(cloth, 0.25)); body.rect(9, 29, 22, 29, '#3a2414'); }

  // ---- Cabeza ----
  const head = new Layer();
  if (look.ears === 'pointy') {
    for (let i = 0; i < 5; i++) { head.rect(8 - i, 14 - i, 9, 15 - i, skin); head.rect(22, 14 - i, 23 + i, 15 - i, skin); }
  } else {
    head.ellipse(8, 13, 10, 17, skin); head.ellipse(21, 13, 23, 17, skin);
  }
  if (look.snout) { head.ellipse(9, 6, 22, 21, skin); head.ellipse(11, 15, 20, 23, skin); }
  else head.ellipse(9, 6, 22, 22, skin);
  head.recolor(skinDark, (x, y) => (x >= 20 && y > 8) || y >= 21);
  head.recolor(skinLight, (x, y) => y >= 8 && y <= 9 && x >= 12 && x <= 15);
  if (look.snout) for (let y = 9; y < 20; y += 3) for (let x = (y % 2) + 11; x < 20; x += 4) head.set(x, y, skinLight);
  // Ojos, cejas, nariz y boca
  for (const ex of [12, 17]) { head.rect(ex, 14, ex + 2, 14, '#f4efe2'); head.set(ex + 1, 14, look.eyes); head.rect(ex, 12, ex + 2, 12, look.hair === 'bald' ? skinDark : hairDark); }
  if (look.snout) { head.set(14, 19, '#140f0c'); head.set(17, 19, '#140f0c'); head.rect(12, 21, 19, 21, shade(skin, -0.45)); }
  else { head.rect(15, 15, 16, 17, skinDark); head.set(15, 17, shade(skin, -0.4)); head.rect(14, 19, 17, 19, '#7a3a34'); }
  if (look.tusks) { head.set(13, 19, '#f4efe2'); head.set(18, 19, '#f4efe2'); head.set(13, 18, '#f4efe2'); head.set(18, 18, '#f4efe2'); }
  if (look.feature === 'scar') for (let i = 0; i < 5; i++) head.set(18 + (i % 2), 11 + i, '#b0403a');
  if (look.feature === 'eyepatch') { head.rect(11, 13, 14, 15, '#1a1412'); for (let x = 9; x <= 22; x++) head.set(x, 11 + (x > 14 ? 0 : 0), '#1a1412'); }
  if (look.feature === 'warpaint') { head.rect(11, 16, 14, 16, '#b0303a'); head.rect(17, 16, 20, 16, '#b0303a'); }
  if (look.feature === 'freckles') [[12, 16], [14, 17], [18, 16], [19, 17], [13, 17]].forEach(([x, y]) => head.set(x, y, shade(skin, -0.3)));

  // ---- Pelo y barba ----
  const hairL = new Layer();
  const cap = () => { hairL.ellipse(9, 4, 22, 12, hair, (_x, y) => y <= 10); hairL.rect(9, 9, 10, 12, hair); hairL.rect(21, 9, 22, 12, hair); };
  switch (look.hair) {
    case 'short': cap(); break;
    case 'long': cap(); hairL.rect(7, 9, 10, 26, hair); hairL.rect(21, 9, 24, 26, hair); break;
    case 'ponytail': cap(); hairL.rect(22, 8, 25, 10, hair); hairL.rect(24, 10, 26, 22, hair); break;
    case 'bun': cap(); hairL.ellipse(13, 1, 18, 5, hair); break;
    case 'mohawk': hairL.rect(14, 1, 17, 9, hair); break;
    case 'braids': cap(); hairL.rect(8, 10, 10, 28, hair); hairL.rect(21, 10, 23, 28, hair); for (let y = 12; y < 28; y += 3) { hairL.set(9, y, hairDark); hairL.set(22, y, hairDark); } break;
    case 'curly': cap(); for (let x = 8; x <= 23; x += 2) hairL.ellipse(x - 1, 3 + (x % 4 ? 1 : 0), x + 1, 6, hair); hairL.rect(8, 9, 10, 15, hair); hairL.rect(21, 9, 23, 15, hair); break;
    default: break;
  }
  hairL.recolor(hairDark, (x, y) => x >= 20 || y >= 12);
  if (look.beard === 'stubble') for (let y = 18; y <= 22; y++) for (let x = 11 + (y % 2); x <= 20; x += 2) if (!(y === 19 && x >= 14 && x <= 17)) hairL.set(x, y, hairDark);
  if (look.beard === 'short') { hairL.ellipse(10, 16, 21, 24, hair, (x, y) => y >= 18 && !(y === 19 && x >= 14 && x <= 17)); hairL.rect(13, 18, 18, 18, hair); hairL.rect(14, 19, 17, 19, '#7a3a34'); }
  if (look.beard === 'long') { hairL.ellipse(10, 16, 21, 30, hair, (x, y) => y >= 18 && !(y === 19 && x >= 14 && x <= 17)); hairL.rect(13, 18, 18, 18, hair); hairL.rect(14, 19, 17, 19, '#7a3a34'); hairL.recolor(hairDark, (x, y) => y > 24 && x % 3 === 0); }

  // ---- Cuernos y tocado ----
  const top = new Layer();
  if (look.horns) {
    for (let i = 0; i < 6; i++) { top.set(10 - Math.floor(i / 2), 7 - i, '#3a2a2a'); top.set(11 - Math.floor(i / 2), 7 - i, '#5a4040'); top.set(21 + Math.floor(i / 2), 7 - i, '#3a2a2a'); top.set(20 + Math.floor(i / 2), 7 - i, '#5a4040'); }
  }
  if (look.headgear === 'hood') { top.ellipse(6, 2, 25, 20, clothDark, (x, y) => !(y > 8 && x > 9 && x < 22) && y < 26); top.rect(6, 12, 9, 24, clothDark); top.rect(22, 12, 25, 24, clothDark); }
  if (look.headgear === 'wizard') { top.rect(6, 8, 25, 9, cloth); for (let i = 0; i < 8; i++) top.rect(11 + Math.floor(i / 2), 7 - i, 20 - Math.floor(i / 1.4), 7 - i, cloth); top.set(17, 2, '#f0d050'); top.set(14, 5, '#f0d050'); top.rect(7, 9, 24, 9, clothDark); }
  if (look.headgear === 'helmet') { top.ellipse(8, 3, 23, 13, metal, (_x, y) => y <= 11); top.rect(15, 10, 16, 16, metal); top.rect(9, 11, 22, 11, '#6f7780'); top.set(12, 5, '#e8eef4'); }
  if (look.headgear === 'circlet') { top.rect(9, 10, 22, 10, '#c9a227'); top.set(15, 10, '#3ab0c9'); top.set(16, 10, '#3ab0c9'); }

  // ---- Composición ----
  const layers = [body.outlined(), head.outlined(), hairL.outlined(), top.outlined()];
  const g = backdrop(look.backdrop).px.map((row) => [...row]);
  if (look.halo) { const h = new Layer(); h.ellipse(7, 0, 24, 6, '#fff2a8', (x, y) => !(y > 1 && y < 5 && x > 9 && x < 22)); h.px.forEach((row, y) => row.forEach((c, x) => { if (c) g[y][x] = c; })); }
  for (const l of layers) l.px.forEach((row, y) => row.forEach((c, x) => { if (c) g[y][x] = c; }));
  // Marco dorado de 1 píxel, como los retratos de los RPG
  for (let i = 0; i < N; i++) { g[0][i] = '#c9a227'; g[N - 1][i] = '#7a5a12'; g[i][0] = '#c9a227'; g[i][N - 1] = '#7a5a12'; }
  return g;
}

/** Imagen PNG del retrato (data URL). Usa un canvas; en tests no hay DOM. */
export function avatarDataUrl(look: AvatarLook, scale = 10): string {
  const g = drawAvatar(look);
  const canvas = document.createElement('canvas');
  canvas.width = N * scale;
  canvas.height = N * scale;
  const ctx = canvas.getContext('2d')!;
  g.forEach((row, y) => row.forEach((c, x) => { if (c) { ctx.fillStyle = c; ctx.fillRect(x * scale, y * scale, scale, scale); } }));
  return canvas.toDataURL('image/png');
}

/** Aspecto inicial según la especie */
export function defaultLook(speciesId: string | undefined, lineageId?: string): AvatarLook {
  const base: AvatarLook = {
    skin: SKINS[1], ears: 'round', horns: false, tusks: false, snout: false, hair: 'short', hairColor: HAIR_COLORS[1], beard: 'none', eyes: EYE_COLORS[0],
    outfit: 'tunic', outfitColor: OUTFIT_COLORS[0], headgear: 'none', feature: 'none', backdrop: 'night', halo: false,
  };
  switch (speciesId) {
    case 'elfo': return { ...base, ears: 'pointy', hair: 'long', hairColor: lineageId === 'drow' ? HAIR_COLORS[5] : HAIR_COLORS[3], skin: lineageId === 'drow' ? SKINS[8] : SKINS[0], backdrop: 'forest' };
    case 'enano': return { ...base, beard: 'long', hairColor: HAIR_COLORS[4], skin: SKINS[2], outfit: 'plate', backdrop: 'dungeon' };
    case 'orco': return { ...base, tusks: true, skin: SKINS[6], hair: 'mohawk', hairColor: HAIR_COLORS[0], outfit: 'leather' };
    case 'tiefling': return { ...base, horns: true, skin: SKINS[7], hair: 'long', hairColor: HAIR_COLORS[0], eyes: EYE_COLORS[4], outfit: 'cloak', outfitColor: OUTFIT_COLORS[3] };
    case 'draconido': return { ...base, snout: true, horns: true, hair: 'bald', skin: lineageId === 'blue' || lineageId === 'silver' ? SKINS[9] : lineageId === 'green' ? SKINS[5] : lineageId === 'gold' || lineageId === 'brass' ? SKINS[10] : lineageId === 'white' ? SKINS[11] : lineageId === 'black' ? SKINS[4] : lineageId === 'bronze' || lineageId === 'copper' ? SKINS[3] : SKINS[7], eyes: EYE_COLORS[4], outfit: 'plate' };
    case 'goliat': return { ...base, hair: 'bald', skin: SKINS[11], feature: 'warpaint', outfit: 'leather', backdrop: 'sunset' };
    case 'gnomo': return { ...base, ears: 'pointy', hair: 'curly', hairColor: HAIR_COLORS[4], skin: SKINS[0], headgear: 'none', outfit: 'robe', outfitColor: OUTFIT_COLORS[2] };
    case 'mediano': return { ...base, hair: 'curly', hairColor: HAIR_COLORS[2], skin: SKINS[1], outfit: 'tunic', outfitColor: OUTFIT_COLORS[2], backdrop: 'tavern' };
    case 'aasimar': return { ...base, halo: true, hair: 'long', hairColor: HAIR_COLORS[5], skin: SKINS[0], eyes: EYE_COLORS[4], outfit: 'robe', outfitColor: OUTFIT_COLORS[7] };
    default: return base;
  }
}

/** Aspecto aleatorio (respetando los rasgos de la especie) */
export function randomLook(speciesId?: string, lineageId?: string): AvatarLook {
  const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];
  const base = defaultLook(speciesId, lineageId);
  return {
    ...base,
    hair: base.snout ? 'bald' : pick(['bald', 'short', 'long', 'ponytail', 'bun', 'mohawk', 'braids', 'curly'] as const),
    hairColor: pick(HAIR_COLORS), eyes: pick(EYE_COLORS), outfitColor: pick(OUTFIT_COLORS),
    beard: base.snout ? 'none' : pick(['none', 'none', 'stubble', 'short', 'long'] as const),
    outfit: pick(['tunic', 'robe', 'leather', 'plate', 'cloak'] as const),
    headgear: pick(['none', 'none', 'hood', 'wizard', 'helmet', 'circlet'] as const),
    feature: pick(['none', 'none', 'scar', 'eyepatch', 'warpaint', 'freckles'] as const),
    backdrop: pick(['night', 'forest', 'dungeon', 'sunset', 'tavern'] as const),
  };
}

/** Texto corto con los datos físicos («120 años · 1,70 m · ojos verdes…») */
export function physicalLine(p?: Physical) {
  if (!p) return '';
  return [
    p.age && T(`${p.age} años`, `${p.age} years old`), p.height, p.weight,
    p.eyes && T(`ojos ${p.eyes}`, `${p.eyes} eyes`), p.hair && T(`pelo ${p.hair}`, `${p.hair} hair`), p.skin && T(`piel ${p.skin}`, `${p.skin} skin`),
  ].filter(Boolean).join(' · ');
}
