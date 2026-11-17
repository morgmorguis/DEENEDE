// Exporta la ficha a PDF rellenando la hoja oficial de 2024 (2 páginas, sin campos de formulario): se escribe el texto encima.
// Las posiciones están medidas sobre la hoja en español a escala 2 (px desde arriba a la izquierda) y se pasan a puntos.
import type { Character } from '../types';
import { abilityMods, armorClass, fmt, initiativeBonus, maxHp, passivePerception, profBonus, saveBonus, saveProficient, skillBonus, speed, spellAttack, spellSaveDc, weaponAttack, weaponDamageFlat } from '../rules/calc';
import { abilityScores } from '../rules/gear';
import { classById, damageTypeName, abilityName, findMastery } from '../rules/srd';
import { classSummary, hitDiceText } from '../rules/multiclass';
import { L, T } from '../i18n';
import type { Ability } from '../types';

// ---------- Datos de la ficha (puro, con tests) ----------

export interface SheetFields {
  name: string; background: string; className: string; species: string; subclass: string; level: string; xp: string;
  ac: string; shield: boolean; hp: string; temp: string; hpMax: string; hdSpent: string; hdMax: string; deathOk: number; deathFail: number;
  prof: string; initiative: string; speed: string; size: string; passive: string; inspiration: boolean;
  abilities: Record<Ability, { score: string; mod: string; save: string; saveProf: boolean }>;
  skills: Record<string, { bonus: string; prof: 0 | 1 | 2 }>;
  attacks: { name: string; bonus: string; damage: string; notes: string }[];
  features: string; speciesTraits: string; feats: string;
  armor: { light: boolean; medium: boolean; heavy: boolean; shields: boolean }; weapons: string; tools: string;
  spellAbility: string; spellMod: string; spellDc: string; spellAtk: string;
  slots: { total: number; used: number }[];
  spells: { level: string; name: string; time: string; range: string; c: boolean; r: boolean; m: boolean; notes: string }[];
  appearance: string; backstory: string; alignment: string; languages: string; equipment: string; attunement: string[];
  coins: { cp: string; sp: string; ep: string; gp: string; pp: string };
}

const ABS: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const n = (x: number | null | undefined) => (x == null || x === 0 ? '' : String(x));

export function sheetFields(c: Character): SheetFields {
  const cls = classById(c.classId);
  const mods = abilityMods(c);
  const scores = abilityScores(c).scores;
  const multi = classSummary(c, (k) => L(k.name));
  const abilities = Object.fromEntries(ABS.map((a) => [a, { score: String(scores[a]), mod: fmt(mods[a]), save: fmt(saveBonus(c, a)), saveProf: saveProficient(c, a) }])) as SheetFields['abilities'];
  const skills: SheetFields['skills'] = {};
  for (const id of SKILL_IDS) skills[id] = { bonus: fmt(skillBonus(c, id)), prof: (c.skillProf[id] ?? 0) as 0 | 1 | 2 };
  const attacks = c.attacks.map((a) => {
    const flat = weaponDamageFlat(c, a);
    return {
      name: a.name,
      bonus: fmt(weaponAttack(c, a)),
      damage: `${a.damage}${flat ? fmt(flat) : ''} ${damageTypeName(a.damageType).toLowerCase()}`.trim(),
      notes: [a.range, a.mastery && (findMastery(a.mastery) ? L(findMastery(a.mastery)!.name) : a.mastery), a.notes].filter(Boolean).join(' · '),
    };
  });
  const slots = c.slots.map((s, i) => {
    const pact = c.pactSlots && c.pactSlots.level === i + 1 ? c.pactSlots : null;
    return { total: s.max + (pact?.max ?? 0), used: s.used + (pact?.used ?? 0) };
  });
  const spells = [...c.spells]
    .filter((s) => s.level === 0 || s.prepared || s.alwaysPrepared)
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
    .map((s) => ({ level: String(s.level), name: s.name, time: s.castingTime, range: s.range, c: !!s.concentration, r: !!s.ritual, m: !!s.material || /\bM\b/.test(s.components ?? ''), notes: s.notes ?? '' }));
  const phys = c.physical;
  const physText = phys ? [
    phys.age && `${T('Edad', 'Age')}: ${phys.age}`, phys.height && `${T('Altura', 'Height')}: ${phys.height}`, phys.weight && `${T('Peso', 'Weight')}: ${phys.weight}`,
    phys.eyes && `${T('Ojos', 'Eyes')}: ${phys.eyes}`, phys.hair && `${T('Pelo', 'Hair')}: ${phys.hair}`, phys.skin && `${T('Piel', 'Skin')}: ${phys.skin}`,
  ].filter(Boolean).join(' · ') : '';
  const items = (c.items ?? []).filter((i) => i.qty > 0).map((i) => `${i.qty > 1 ? `${i.qty}× ` : ''}${i.name}${i.equipped ? ` (${T('equipado', 'equipped')})` : ''}`);
  const cons = (c.consumables ?? []).filter((x) => x.qty > 0).map((x) => `${x.name} ×${x.qty}`);
  return {
    name: c.name,
    background: c.background,
    className: multi || (cls ? L(cls.name) : c.className),
    species: [c.species, c.lineage].filter(Boolean).join(' · '),
    subclass: [c.subclass, ...(c.multiclass ?? []).map((m) => m.subclass)].filter(Boolean).join(' / '),
    level: String(c.level),
    xp: n(c.xp),
    ac: String(armorClass(c).value),
    shield: c.shield,
    hp: String(c.hp.current),
    temp: n(c.hp.temp),
    hpMax: String(maxHp(c)),
    hdSpent: n(c.hitDiceSpent),
    hdMax: hitDiceText(c),
    deathOk: c.deathSaves.success,
    deathFail: c.deathSaves.fail,
    prof: fmt(profBonus(c.level)),
    initiative: fmt(initiativeBonus(c)),
    speed: `${speed(c).value} ${T('pies', 'ft')}`,
    size: c.size,
    passive: String(passivePerception(c)),
    inspiration: c.heroicInspiration,
    abilities,
    skills,
    attacks,
    features: c.features.map((f) => `${f.name}. ${f.text}`.trim()).join('\n'),
    speciesTraits: c.speciesTraits,
    feats: c.feats,
    armor: c.armorTraining,
    weapons: c.weaponProf,
    tools: c.toolProf,
    spellAbility: c.spellAbility ? abilityName(c.spellAbility) : '',
    spellMod: c.spellAbility ? fmt(mods[c.spellAbility]) : '',
    spellDc: n(spellSaveDc(c)),
    spellAtk: spellAttack(c) != null ? fmt(spellAttack(c)!) : '',
    slots,
    spells,
    appearance: [physText, c.appearance].filter(Boolean).join('\n'),
    backstory: c.backstory,
    alignment: c.alignment,
    languages: c.languages,
    equipment: [items.join(', '), c.inventory, cons.length ? `${T('Munición y consumibles', 'Ammo & consumables')}: ${cons.join(', ')}` : ''].filter((x) => x && x.trim()).join('\n'),
    attunement: (c.attunement ?? []).filter((x) => x && x.trim()),
    coins: { cp: n(c.coins.cp), sp: n(c.coins.sp), ep: n(c.coins.ep), gp: n(c.coins.gp), pp: n(c.coins.pp) },
  };
}

// ---------- Posiciones en la hoja (px a escala 2 desde arriba a la izquierda) ----------

const SKILL_ROWS: { id: string; x: number; y: number }[] = [
  { id: 'atletismo', x: 0, y: 573 },
  { id: 'acrobacias', x: 0, y: 809 }, { id: 'juego_manos', x: 0, y: 837 }, { id: 'sigilo', x: 0, y: 865 },
  { id: 'arcanos', x: 1, y: 411 }, { id: 'historia', x: 1, y: 446 }, { id: 'investigacion', x: 1, y: 474 }, { id: 'naturaleza', x: 1, y: 502 }, { id: 'religion', x: 1, y: 530 },
  { id: 'medicina', x: 1, y: 766 }, { id: 'percepcion', x: 1, y: 794 }, { id: 'perspicacia', x: 1, y: 822 }, { id: 'supervivencia', x: 1, y: 850 }, { id: 'trato_animales', x: 1, y: 878 },
  { id: 'engano', x: 1, y: 1114 }, { id: 'interpretacion', x: 1, y: 1142 }, { id: 'intimidacion', x: 1, y: 1170 }, { id: 'persuasion', x: 1, y: 1198 },
];
const SKILL_IDS = SKILL_ROWS.map((s) => s.id);
/** Bloque de cada característica: centro del círculo (modificador), centro de la pestaña (puntuación) y fila de la salvación */
const ABILITY_POS: Record<Ability, { col: 0 | 1; mod: [number, number]; score: [number, number]; save: number }> = {
  str: { col: 0, mod: [87, 452], score: [152, 457], save: 534 },
  dex: { col: 0, mod: [87, 688], score: [152, 693], save: 770 },
  con: { col: 0, mod: [87, 979], score: [152, 984], save: 1062 },
  int: { col: 1, mod: [300, 293], score: [364, 298], save: 380 },
  wis: { col: 1, mod: [300, 641], score: [364, 646], save: 727 },
  cha: { col: 1, mod: [300, 988], score: [364, 993], save: 1075 },
};
/** Columna de salvaciones/habilidades: centro del círculo de competencia y centro de la raya del bonificador */
const COL = [{ dot: 43, val: 72 }, { dot: 256, val: 285 }];

// ---------- Dibujo con pdf-lib ----------

type Pdf = typeof import('pdf-lib');
type Page = import('pdf-lib').PDFPage;
type Font = import('pdf-lib').PDFFont;
const PAGE_H = 774;
const INK = [0.12, 0.1, 0.18] as const;

/** Quita lo que la fuente estándar no sabe escribir (emojis, símbolos raros) */
export const pdfSafe = (s: string) => s.normalize('NFC')
  .replace(/×/g, 'x')
  .replace(/[^\t\n\r\x20-\x7E\xA0-\xFF‘’“”–—…•€]/g, '');

function writer(pdf: Pdf, font: Font, bold: Font) {
  const color = pdf.rgb(...INK);
  const P = (px: number, py: number) => ({ x: px / 2, y: PAGE_H - py / 2 });
  /** Texto en una línea; si no cabe, se reduce la letra y al final se corta con «…» */
  const line = (page: Page, raw: string, px: number, py: number, o: { size?: number; w?: number; align?: 'left' | 'center'; b?: boolean } = {}) => {
    let s = pdfSafe(raw).replace(/\s+/g, ' ').trim();
    if (!s) return;
    const f = o.b ? bold : font;
    let size = o.size ?? 9;
    const maxW = (o.w ?? 2000) / 2;
    while (size > 5 && f.widthOfTextAtSize(s, size) > maxW) size -= 0.5;
    while (s.length > 1 && f.widthOfTextAtSize(s, size) > maxW) s = `${s.slice(0, -2)}…`;
    const w = f.widthOfTextAtSize(s, size);
    const p = P(px, py);
    page.drawText(s, { x: o.align === 'center' ? p.x - w / 2 : p.x, y: p.y, size, font: f, color });
  };
  /** Párrafos que fluyen por una o varias cajas; la letra baja hasta que cabe todo (mínimo 5,5) */
  const flow = (page: Page, raw: string, boxes: [number, number, number, number][], start = 8.5) => {
    const text = pdfSafe(raw).trim();
    if (!text) return;
    const layout = (size: number) => {
      const lh = size * 1.18;
      const out: { box: number; lines: string[] }[] = boxes.map((_, i) => ({ box: i, lines: [] }));
      let bi = 0;
      const cap = (i: number) => Math.floor((boxes[i][3] - boxes[i][1]) / 2 / lh);
      const width = (i: number) => (boxes[i][2] - boxes[i][0]) / 2;
      for (const para of text.split('\n')) {
        const words = para.split(/\s+/).filter(Boolean);
        let cur = '';
        const push = (l: string) => {
          while (bi < boxes.length && out[bi].lines.length >= cap(bi)) bi++;
          if (bi >= boxes.length) return false;
          out[bi].lines.push(l);
          return true;
        };
        for (const w of words.length ? words : ['']) {
          const next = cur ? `${cur} ${w}` : w;
          if (font.widthOfTextAtSize(next, size) <= width(Math.min(bi, boxes.length - 1)) || !cur) cur = next;
          else { if (!push(cur)) return { out, fits: false, lh }; cur = w; }
        }
        if (!push(cur)) return { out, fits: false, lh };
      }
      return { out, fits: true, lh };
    };
    let size = start;
    let res = layout(size);
    while (!res.fits && size > 5.5) { size -= 0.5; res = layout(size); }
    for (const { box, lines } of res.out) {
      const [x0, y0] = boxes[box];
      lines.forEach((l, i) => {
        const p = P(x0, y0);
        page.drawText(l, { x: p.x, y: p.y - size - i * res.lh, size, font, color });
      });
    }
    if (!res.fits) {
      const last = res.out[res.out.length - 1];
      const [x0, y0, x1] = boxes[boxes.length - 1];
      const p = P(x1, y0);
      if (last.lines.length) page.drawText('…', { x: p.x - 8, y: p.y - size - (last.lines.length - 1) * res.lh, size, font, color });
      void x0;
    }
  };
  /** Rombo relleno (casillas de la hoja) */
  const diamond = (page: Page, px: number, py: number, r = 5) => {
    const p = P(px, py);
    page.drawSvgPath(`M 0 ${-r / 2} L ${r / 2} 0 L 0 ${r / 2} L ${-r / 2} 0 Z`, { x: p.x, y: p.y, color });
  };
  const dot = (page: Page, px: number, py: number, r = 5) => {
    const p = P(px, py);
    page.drawCircle({ x: p.x, y: p.y, size: r / 2, color });
  };
  return { line, flow, diamond, dot };
}

/** PDF de la hoja oficial relleno con la ficha */
export async function buildSheetPdf(c: Character, template: ArrayBuffer): Promise<Uint8Array> {
  const pdf = await import('pdf-lib');
  const doc = await pdf.PDFDocument.load(template, { ignoreEncryption: true });
  if (doc.getPageCount() < 2) throw new Error('template-pages');
  const font = await doc.embedFont(pdf.StandardFonts.Helvetica);
  const bold = await doc.embedFont(pdf.StandardFonts.HelveticaBold);
  const { line, flow, diamond, dot } = writer(pdf, font, bold);
  const f = sheetFields(c);
  const [p1, p2] = doc.getPages();

  // ---- Página 1: cabecera ----
  line(p1, f.name, 50, 56, { size: 14, w: 455, b: true });
  line(p1, f.background, 50, 98, { w: 232 });
  line(p1, f.className, 297, 98, { w: 212 });
  line(p1, f.species, 50, 141, { w: 232 });
  line(p1, f.subclass, 297, 141, { w: 212 });
  line(p1, f.level, 553, 82, { size: 17, align: 'center', b: true });
  line(p1, f.xp, 553, 130, { size: 8, align: 'center', w: 70 });
  line(p1, f.ac, 678, 104, { size: 20, align: 'center', b: true });
  if (f.shield) diamond(p1, 678, 152, 9);
  line(p1, f.hp, 808, 112, { size: 20, align: 'center', b: true });
  line(p1, f.temp, 917, 90, { size: 11, align: 'center' });
  line(p1, f.hpMax, 917, 138, { size: 11, align: 'center', b: true });
  line(p1, f.hdSpent, 1022, 90, { size: 11, align: 'center' });
  line(p1, f.hdMax, 1022, 138, { size: 10, align: 'center', w: 90 });
  for (let i = 0; i < Math.min(3, f.deathOk); i++) diamond(p1, 1087.5 + i * 22, 90, 10);
  for (let i = 0; i < Math.min(3, f.deathFail); i++) diamond(p1, 1087.5 + i * 22, 133, 10);
  // ---- Bonificadores generales ----
  line(p1, f.prof, 115, 312, { size: 17, align: 'center', b: true });
  line(p1, f.initiative, 525, 292, { size: 15, align: 'center', b: true });
  line(p1, f.speed, 712, 292, { size: 13, align: 'center', b: true, w: 150 });
  line(p1, f.size, 902, 292, { size: 11, align: 'center', w: 150 });
  line(p1, f.passive, 1095, 292, { size: 15, align: 'center', b: true });
  if (f.inspiration) diamond(p1, 115, 1185, 16);
  // ---- Características, salvaciones y habilidades ----
  for (const a of ABS) {
    const pos = ABILITY_POS[a];
    const ab = f.abilities[a];
    line(p1, ab.mod, pos.mod[0], pos.mod[1] + 9, { size: 17, align: 'center', b: true });
    line(p1, ab.score, pos.score[0], pos.score[1] + 6, { size: 11, align: 'center' });
    const col = COL[pos.col];
    line(p1, ab.save, col.val, pos.save + 5, { size: 9, align: 'center', w: 34 });
    if (ab.saveProf) dot(p1, col.dot, pos.save, 9);
  }
  for (const s of SKILL_ROWS) {
    const v = f.skills[s.id];
    if (!v) continue;
    const col = COL[s.x];
    line(p1, v.bonus, col.val, s.y + 5, { size: 9, align: 'center', w: 34 });
    if (v.prof) dot(p1, col.dot, s.y, v.prof === 2 ? 11 : 9);
  }
  // ---- Armas y trucos de daño (6 filas) ----
  f.attacks.slice(0, 6).forEach((a, i) => {
    const y = 419 + i * 39;
    line(p1, a.name, 459, y, { size: 8.5, w: 200 });
    line(p1, a.bonus, 714, y, { size: 8.5, align: 'center', w: 80 });
    line(p1, a.damage, 770, y, { size: 8, w: 142 });
    line(p1, a.notes, 925, y, { size: 7, w: 245 });
  });
  // ---- Cajas de texto ----
  flow(p1, f.features, [[458, 702, 806, 1104], [822, 702, 1172, 1104]], 7.5);
  flow(p1, f.speciesTraits, [[458, 1180, 782, 1524]], 7.5);
  flow(p1, f.feats, [[826, 1180, 1172, 1524]], 7.5);
  if (f.armor.light) diamond(p1, 140, 1297, 10);
  if (f.armor.medium) diamond(p1, 209, 1297, 10);
  if (f.armor.heavy) diamond(p1, 280, 1297, 10);
  if (f.armor.shields) diamond(p1, 354, 1297, 10);
  flow(p1, f.weapons, [[34, 1334, 414, 1434]], 8);
  flow(p1, f.tools, [[34, 1458, 414, 1526]], 8);

  // ---- Página 2: magia ----
  line(p2, f.spellAbility, 50, 58, { size: 11, w: 215, b: true });
  line(p2, f.spellMod, 60, 124, { size: 15, align: 'center', b: true });
  line(p2, f.spellDc, 60, 179, { size: 15, align: 'center', b: true });
  line(p2, f.spellAtk, 60, 234, { size: 15, align: 'center', b: true });
  // Espacios de conjuro: total y rombos de gastados (3 columnas de 3 niveles)
  const SLOT_COLS = [{ total: 377, d: 405.5 }, { total: 555, d: 581.5 }, { total: 712, d: 738.5 }];
  f.slots.slice(0, 9).forEach((s, i) => {
    if (!s.total) return;
    const col = SLOT_COLS[Math.floor(i / 3)];
    const y = 182 + (i % 3) * 28;
    line(p2, String(s.total), col.total, y + 4, { size: 9, align: 'center' });
    for (let k = 0; k < Math.min(s.used, 4); k++) diamond(p2, col.d + k * 19, y, 10);
  });
  // Trucos y conjuros preparados (30 filas)
  const rows = f.spells.length > 30 ? [...f.spells.slice(0, 29), { level: '', name: T(`…y ${f.spells.length - 29} más`, `…and ${f.spells.length - 29} more`), time: '', range: '', c: false, r: false, m: false, notes: '' }] : f.spells;
  rows.forEach((s, i) => {
    const y = 370 + i * 38.86;
    line(p2, s.level, 55, y + 9, { size: 8, align: 'center' });
    line(p2, s.name, 87, y + 9, { size: 8, w: 212 });
    line(p2, s.time, 311, y + 9, { size: 6.5, w: 68 });
    line(p2, s.range, 390, y + 9, { size: 6.5, w: 66 });
    if (s.c) diamond(p2, 486, y, 9);
    if (s.r) diamond(p2, 530, y, 9);
    if (s.m) diamond(p2, 573, y, 9);
    line(p2, s.notes, 612, y + 9, { size: 6.5, w: 168 });
  });
  // ---- Columna derecha ----
  flow(p2, f.appearance, [[826, 66, 1172, 206]], 8);
  flow(p2, f.backstory, [[826, 278, 1172, 552]], 8);
  line(p2, f.alignment, 830, 597, { size: 9, w: 340 });
  flow(p2, f.languages, [[826, 686, 1172, 752]], 8);
  flow(p2, f.equipment, [[826, 820, 1172, 1170]], 8);
  f.attunement.slice(0, 3).forEach((a, i) => {
    diamond(p2, 846, 1206 + i * 40, 9);
    line(p2, a, 866, 1210 + i * 40, { size: 8.5, w: 300 });
  });
  const COINS: [keyof SheetFields['coins'], number][] = [['cp', 857], ['sp', 928], ['ep', 999], ['gp', 1070], ['pp', 1140]];
  for (const [k, x] of COINS) line(p2, f.coins[k], x, 1434, { size: 11, align: 'center', w: 56, b: true });

  doc.setTitle(c.name || 'Di en Di');
  doc.setCreator('Di en Di');
  return doc.save();
}
