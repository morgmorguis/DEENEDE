// Lectura sin IA de PDF rellenables: identifica cada campo del formulario por su posición
// en la hoja oficial de 2024, o por su nombre en hojas que usan nombres estándar (CharacterName, STR…).
import type { Ability } from '../types';
import type { ImportedSheet } from '../ai';
import { emptySheet, parseAttackBonus, parseDamageCell, parseDamageType, parseHitDie, parseInt0, setSkill } from './sheetUtils';
import { classById } from '../rules/srd';
import { T } from '../i18n';

export interface FormField {
  page: number;
  /** Centro del campo normalizado 0..1 (origen arriba a la izquierda) */
  cx: number;
  cy: number;
  name: string;
  kind: 'text' | 'check';
  value: string;
  checked: boolean;
}

// Plantilla en puntos sobre una página de 603×774 (hoja oficial 2024, edición rellenable)
const W = 603;
const H = 774;
type Slot = { page: number; x: number; y: number; key: string };

const P1: [string, number, number][] = [
  ['name', 138, 23], ['level', 276, 37], ['ac', 338, 43], ['hpTemp', 460, 42], ['hdSpent', 512, 42], ['class', 194, 44],
  ['background', 84, 45], ['hpCurrent', 403, 57], ['xp', 276, 63], ['hpMax', 460, 64], ['hdMax', 512, 64],
  ['species', 84, 66], ['subclass', 197, 66],
  ['initiative', 262, 140], ['speed', 357, 140], ['size', 451, 140], ['passive', 545, 140], ['prof', 57, 150],
  ['mod:int', 149, 145], ['score:int', 180, 151], ['mod:str', 43, 222], ['score:str', 74, 228],
  ['mod:dex', 43, 341], ['score:dex', 74, 346], ['mod:wis', 149, 319], ['score:wis', 180, 326],
  ['mod:con', 43, 487], ['score:con', 72, 492], ['mod:cha', 149, 493], ['score:cha', 181, 499],
  ['features1', 316, 450], ['features2', 497, 450], ['speciesTraits', 310, 671], ['feats', 500, 671],
  ['weaponProf', 113, 691], ['toolProf', 113, 737],
];

// Casillas de competencia (círculos) de salvaciones y habilidades: [clave, x, y]
const P1_CHECKS: [string, number, number][] = [
  ['ds:s1', 546, 45], ['ds:s2', 557, 45], ['ds:s3', 568, 45], ['ds:f1', 546, 67], ['ds:f2', 557, 66], ['ds:f3', 568, 67],
  ['save:int', 127, 188], ['skill:arcanos', 127, 207], ['skill:historia', 127, 221], ['skill:investigacion', 127, 235], ['skill:naturaleza', 127, 249], ['skill:religion', 127, 263],
  ['save:str', 21, 265], ['skill:atletismo', 21, 284],
  ['save:wis', 127, 361], ['skill:medicina', 127, 381], ['skill:percepcion', 127, 395], ['skill:perspicacia', 127, 409], ['skill:supervivencia', 127, 423], ['skill:trato_animales', 127, 437],
  ['save:dex', 21, 383], ['skill:acrobacias', 21, 402], ['skill:juego_manos', 21, 416], ['skill:sigilo', 21, 431],
  ['save:con', 21, 529],
  ['save:cha', 127, 535], ['skill:engano', 127, 555], ['skill:interpretacion', 127, 569], ['skill:intimidacion', 127, 583], ['skill:persuasion', 127, 597],
  ['inspiration', 58, 592], ['armor:light', 62, 648], ['armor:medium', 97, 648], ['armor:heavy', 141, 648], ['armor:shields', 178, 648],
];

const P2: [string, number, number][] = [
  ['spellAbility', 80, 25], ['appearance', 500, 66], ['backstory', 500, 205], ['alignment', 499, 296], ['languages', 500, 358],
  ['equipment', 501, 495], ['attune1', 507, 604], ['attune2', 507, 622], ['attune3', 507, 642],
  ['cp', 428, 714], ['sp', 463, 714], ['ep', 499, 714], ['gp', 534, 714], ['pp', 569, 714],
  ['slot:1', 187, 90], ['slot:2', 187, 105], ['slot:3', 187, 118], ['slot:4', 276, 90], ['slot:5', 276, 104], ['slot:6', 276, 118],
  ['slot:7', 355, 90], ['slot:8', 355, 104], ['slot:9', 355, 118],
];

const SLOTS: Slot[] = [
  ...P1.map(([key, x, y]) => ({ page: 1, x, y, key })),
  ...P2.map(([key, x, y]) => ({ page: 2, x, y, key })),
];
const CHECK_SLOTS: Slot[] = P1_CHECKS.map(([key, x, y]) => ({ page: 1, x, y, key }));

const near = (f: FormField, s: Slot, tol: number) => f.page === s.page && Math.abs(f.cx - s.x / W) < tol && Math.abs(f.cy - s.y / H) < tol;

/** Busca el hueco de la plantilla más cercano a un campo */
function matchSlot(f: FormField, slots: Slot[], tol: number): string | null {
  let best: { key: string; d: number } | null = null;
  for (const s of slots) {
    if (!near(f, s, tol)) continue;
    const d = Math.hypot(f.cx - s.x / W, f.cy - s.y / H);
    if (!best || d < best.d) best = { key: s.key, d };
  }
  return best?.key ?? null;
}

// Tabla de armas (pág. 1) y de conjuros (pág. 2): filas y columnas en puntos
const WEAPON_COLS: [string, number, number][] = [['name', 227, 334], ['bonus', 335, 381], ['damage', 383, 460], ['notes', 461, 588]];
const WEAPON_ROWS = { top: 198, bottom: 314, step: 19.4 };
const SPELL_COLS: [string, number, number][] = [['level', 16, 39], ['name', 41, 152], ['time', 153, 187], ['range', 188, 232], ['c', 236, 250], ['r', 258, 272], ['m', 280, 294], ['notes', 302, 397]];
const SPELL_ROWS = { top: 178, bottom: 762, step: 19.5 };

function tableCell(f: FormField, page: number, cols: [string, number, number][], rows: { top: number; bottom: number; step: number }) {
  if (f.page !== page) return null;
  const x = f.cx * W;
  const y = f.cy * H;
  if (y < rows.top || y > rows.bottom) return null;
  const col = cols.find(([, a, b]) => x >= a && x <= b);
  if (!col) return null;
  return { col: col[0], row: Math.floor((y - rows.top) / rows.step) };
}

/** Comprueba si el PDF parece la hoja oficial 2024 (suficientes campos en las posiciones esperadas) */
export function looksLikeOfficial2024(fields: FormField[]) {
  const hits = fields.filter((f) => matchSlot(f, [...SLOTS, ...CHECK_SLOTS], 0.012)).length;
  return hits >= 40;
}

export function mapOfficial2024(fields: FormField[]): ImportedSheet {
  const s = emptySheet();
  const text: Record<string, string> = {};
  const weapons: Record<number, Record<string, string>> = {};
  const spells: Record<number, Record<string, string | boolean>> = {};
  const usedSlots: Record<number, number> = {};

  for (const f of fields) {
    if (f.kind === 'text') {
      const w = tableCell(f, 1, WEAPON_COLS, WEAPON_ROWS);
      if (w && f.value) { (weapons[w.row] ??= {})[w.col] = f.value; continue; }
      const sp = tableCell(f, 2, SPELL_COLS, SPELL_ROWS);
      if (sp && f.value) { (spells[sp.row] ??= {})[sp.col] = f.value; continue; }
      const key = matchSlot(f, SLOTS, 0.025);
      if (key && f.value) text[key] = f.value;
    } else if (f.checked) {
      const sp = tableCell(f, 2, SPELL_COLS, SPELL_ROWS);
      if (sp && ['c', 'r', 'm'].includes(sp.col)) { (spells[sp.row] ??= {})[sp.col] = true; continue; }
      // Casillas de espacios gastados (pág. 2, filas de niveles 1-9)
      if (f.page === 2 && f.cy * H > 80 && f.cy * H < 128) {
        const col = f.cx * W < 260 ? 0 : f.cx * W < 340 ? 1 : 2;
        const row = f.cy * H < 98 ? 0 : f.cy * H < 112 ? 1 : 2;
        const lvl = col * 3 + row + 1;
        usedSlots[lvl] = (usedSlots[lvl] ?? 0) + 1;
        continue;
      }
      const key = matchSlot(f, CHECK_SLOTS, 0.012);
      if (!key) continue;
      const [kind, id] = key.split(':');
      if (kind === 'save') s.saveProficiencies.push(id);
      else if (kind === 'skill') setSkill(s, id, false);
      else if (kind === 'armor') s.armorTraining[id as keyof ImportedSheet['armorTraining']] = true;
      else if (key === 'inspiration') s.heroicInspiration = true;
    }
  }

  s.name = text.name ?? '';
  s.className = text.class ?? '';
  s.classId = classById(s.className)?.id ?? null;
  s.background = text.background ?? '';
  s.species = text.species ?? '';
  s.subclass = text.subclass ?? '';
  s.level = parseInt0(text.level) || 1;
  s.xp = parseInt0(text.xp);
  s.armorClass = parseInt0(text.ac);
  s.hpCurrent = text.hpCurrent ? parseInt0(text.hpCurrent) : null;
  s.hpTemp = parseInt0(text.hpTemp);
  s.hpMax = Math.max(parseInt0(text.hpMax), s.hpCurrent ?? 0);
  // En "Gastados" mucha gente escribe el dado (D8); en "Máx." el total (3d8)
  s.hitDie = parseHitDie(text.hdSpent) ?? parseHitDie(text.hdMax);
  s.hitDiceSpent = /d/i.test(text.hdSpent ?? '') ? 0 : parseInt0(text.hdSpent);
  s.speed = parseInt0(text.speed) || 30;
  s.size = text.size ?? '';
  for (const a of ['str', 'dex', 'con', 'int', 'wis', 'cha'] as Ability[]) {
    const score = parseInt0(text[`score:${a}`]);
    const mod = text[`mod:${a}`] ? parseInt0(text[`mod:${a}`]) : null;
    s.abilities[a] = score || (mod != null ? mod * 2 + 10 : 10);
    if (!score && mod != null) s.warnings.push(T(`${a.toUpperCase()}: solo se ve el modificador; la puntuación es aproximada.`, `${a.toUpperCase()}: only the modifier is filled in; the score is estimated.`));
  }
  s.classFeatures = [text.features1, text.features2].filter(Boolean).flatMap((t) => splitFeatures(t!));
  s.speciesTraits = text.speciesTraits ?? '';
  s.feats = text.feats ?? '';
  s.weaponProficiencies = text.weaponProf ?? '';
  s.toolProficiencies = text.toolProf ?? '';
  const ab = (text.spellAbility ?? '').toLowerCase();
  s.spellcastingAbility = /int/.test(ab) ? 'int' : /sab|wis/.test(ab) ? 'wis' : /car|cha/.test(ab) ? 'cha' : null;
  s.appearance = text.appearance ?? '';
  s.backstory = text.backstory ?? '';
  s.alignment = (text.alignment ?? '').trim();
  s.languages = text.languages ?? '';
  s.equipment = text.equipment ?? '';
  s.attunement = [text.attune1, text.attune2, text.attune3].map((x) => x ?? '');
  s.coins = { cp: parseInt0(text.cp), sp: parseInt0(text.sp), ep: parseInt0(text.ep), gp: parseInt0(text.gp), pp: parseInt0(text.pp) };
  s.spellSlots = Array.from({ length: 9 }, (_, i) => parseInt0(text[`slot:${i + 1}`]));

  s.attacks = Object.keys(weapons).map(Number).sort((a, b) => a - b).map((r) => weapons[r]).filter((w) => w.name).map((w) => ({
    name: w.name,
    attackBonus: parseAttackBonus(w.bonus),
    damage: parseDamageCell(w.damage),
    damageType: parseDamageType(`${w.damage ?? ''} ${w.name}`),
    range: '',
    notes: w.notes ?? '',
  }));
  s.spells = Object.keys(spells).map(Number).sort((a, b) => a - b).map((r) => spells[r]).filter((x) => x.name).map((x) => ({
    name: String(x.name),
    level: parseInt0(String(x.level ?? '0')),
    castingTime: String(x.time ?? ''),
    range: String(x.range ?? ''),
    concentration: x.c === true,
    ritual: x.r === true,
    material: x.m === true,
    notes: String(x.notes ?? ''),
  }));
  s.spellSlotsUsed = Array.from({ length: 9 }, (_, i) => Math.min(usedSlots[i + 1] ?? 0, s.spellSlots[i]));
  return s;
}

/** Separa un bloque de rasgos en entradas: una por párrafo, con el nombre antes de ":" o "." */
function splitFeatures(t: string) {
  return t.split(/\n\s*\n|\n(?=[A-ZÁÉÍÓÚÑ][^\n]{0,40}[:.])/).map((p) => p.trim()).filter(Boolean).map((p) => {
    const m = p.match(/^([^:.\n]{2,40})[:.]\s*([\s\S]*)$/);
    return m ? { name: m[1].trim(), text: m[2].trim() } : { name: p.split('\n')[0].slice(0, 40), text: p };
  });
}

// ---------- Hojas con nombres de campo estándar (p. ej. la hoja rellenable de 2014) ----------

const NAMED: [RegExp, string][] = [
  [/^charactername$|^nombre/i, 'name'], [/^classlevel$/i, 'classLevel'], [/^class$|^clase$/i, 'class'], [/^level$|^nivel$/i, 'level'],
  [/^background|^trasfondo/i, 'background'], [/^race|^species|^especie|^raza/i, 'species'], [/^alignment|^alineamiento/i, 'alignment'],
  [/^xp$|^experience/i, 'xp'], [/^str$/i, 'score:str'], [/^dex$/i, 'score:dex'], [/^con$/i, 'score:con'], [/^int$/i, 'score:int'],
  [/^wis$/i, 'score:wis'], [/^cha$/i, 'score:cha'], [/^ac$/i, 'ac'], [/^speed$/i, 'speed'], [/^hpmax$/i, 'hpMax'],
  [/^hpcurrent$/i, 'hpCurrent'], [/^hptemp$/i, 'hpTemp'], [/^hd$|^hdtotal$/i, 'hdMax'], [/^equipment$/i, 'equipment'],
  [/^proficiencieslang$/i, 'languages'], [/^features and traits$|^features$/i, 'features1'], [/^cp$/i, 'cp'], [/^sp$/i, 'sp'],
  [/^ep$/i, 'ep'], [/^gp$/i, 'gp'], [/^pp$/i, 'pp'], [/^personalitytraits|^backstory/i, 'backstory'], [/^spellcastingability/i, 'spellAbility'],
];

export function mapByFieldNames(fields: FormField[]): ImportedSheet | null {
  const text: Record<string, string> = {};
  const weapons: Record<string, Record<string, string>> = {};
  for (const f of fields) {
    if (f.kind !== 'text' || !f.value) continue;
    const name = f.name.trim();
    const w = name.match(/^wpn\s*(?:name)?\s*(\d*)\s*(name|atkbonus|damage)?/i);
    if (w && /wpn/i.test(name)) {
      const idx = w[1] || '1';
      const col = /atk/i.test(name) ? 'bonus' : /damage/i.test(name) ? 'damage' : 'name';
      (weapons[idx] ??= {})[col] = f.value;
      continue;
    }
    const hit = NAMED.find(([re]) => re.test(name));
    if (hit) text[hit[1]] = f.value;
  }
  if (Object.keys(text).length < 5) return null;
  const s = emptySheet();
  s.name = text.name ?? '';
  const cl = text.class ?? text.classLevel ?? '';
  s.className = cl.replace(/\d+/g, '').trim();
  s.classId = classById(s.className)?.id ?? null;
  s.level = parseInt0(text.level ?? cl) || 1;
  s.background = text.background ?? '';
  s.species = text.species ?? '';
  s.alignment = text.alignment ?? '';
  s.xp = parseInt0(text.xp);
  for (const a of ['str', 'dex', 'con', 'int', 'wis', 'cha'] as Ability[]) s.abilities[a] = parseInt0(text[`score:${a}`]) || 10;
  s.armorClass = parseInt0(text.ac);
  s.speed = parseInt0(text.speed) || 30;
  s.hpMax = parseInt0(text.hpMax);
  s.hpCurrent = text.hpCurrent ? parseInt0(text.hpCurrent) : null;
  s.hpTemp = parseInt0(text.hpTemp);
  s.hitDie = parseHitDie(text.hdMax);
  s.equipment = text.equipment ?? '';
  s.languages = text.languages ?? '';
  s.classFeatures = text.features1 ? splitFeatures(text.features1) : [];
  s.backstory = text.backstory ?? '';
  s.coins = { cp: parseInt0(text.cp), sp: parseInt0(text.sp), ep: parseInt0(text.ep), gp: parseInt0(text.gp), pp: parseInt0(text.pp) };
  s.attacks = Object.values(weapons).filter((w) => w.name).map((w) => ({ name: w.name, attackBonus: parseAttackBonus(w.bonus), damage: parseDamageCell(w.damage), damageType: parseDamageType(w.damage ?? ''), range: '', notes: '' }));
  s.warnings.push(T('Las casillas de competencia de esta hoja no tienen nombre reconocible: revisa salvaciones y habilidades.', 'This sheet’s proficiency boxes have no recognizable names: check saves and skills.'));
  return s;
}

// ---------- Extracción de campos con pdf.js ----------

interface PdfDoc {
  numPages: number;
  getPage: (n: number) => Promise<{
    getViewport: (o: { scale: number }) => { width: number; height: number };
    getAnnotations: () => Promise<unknown[]>;
  }>;
}

/** Lee todos los campos de formulario del PDF con su posición normalizada */
export async function readFormFields(doc: PdfDoc): Promise<FormField[]> {
  const out: FormField[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, 8); i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    for (const raw of await page.getAnnotations()) {
      const a = raw as { fieldType?: string; fieldName?: string; fieldValue?: unknown; rect: number[]; checkBox?: boolean; radioButton?: boolean };
      if (a.fieldType !== 'Tx' && a.fieldType !== 'Btn') continue;
      const [x1, y1, x2, y2] = a.rect;
      const value = a.fieldValue == null ? '' : String(a.fieldValue);
      out.push({
        page: i,
        cx: (x1 + x2) / 2 / vp.width,
        cy: (vp.height - (y1 + y2) / 2) / vp.height,
        name: a.fieldName ?? '',
        kind: a.fieldType === 'Btn' ? 'check' : 'text',
        value: a.fieldType === 'Btn' ? '' : value.trim(),
        checked: a.fieldType === 'Btn' && value !== '' && value !== 'Off',
      });
    }
  }
  return out;
}
