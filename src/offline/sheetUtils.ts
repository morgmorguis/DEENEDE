import type { ImportedSheet } from '../ai';
import type { DamageType } from '../types';

export function emptySheet(): ImportedSheet {
  return {
    name: '', species: '', className: '', classId: null, subclass: '', background: '', level: 1, xp: 0, alignment: '', size: '',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    saveProficiencies: [], skills: [], armorClass: 0, shield: false, speed: 30, hpMax: 0, hpCurrent: null, hpTemp: 0,
    hitDie: null, hitDiceSpent: 0, heroicInspiration: false, attacks: [], spellcastingAbility: null,
    spellSlots: [0, 0, 0, 0, 0, 0, 0, 0, 0], spellSlotsUsed: [0, 0, 0, 0, 0, 0, 0, 0, 0], spells: [], classFeatures: [], speciesTraits: '', feats: '',
    armorTraining: { light: false, medium: false, heavy: false, shields: false },
    weaponProficiencies: '', toolProficiencies: '', languages: '', equipment: '', attunement: [],
    coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }, appearance: '', backstory: '', warnings: [],
  };
}

/** Primer número entero (con signo) de un texto: "+3" → 3, "30 ft" → 30, "" → 0 */
export const parseInt0 = (s?: string | null) => {
  const m = (s ?? '').replace(/[−–]/g, '-').match(/[-+]?\s*\d+/);
  return m ? Number(m[0].replace(/\s/g, '')) : 0;
};

/** "D20+6", "+6", "6" → 6; vacío → null */
export const parseAttackBonus = (s?: string) => {
  if (!s?.trim()) return null;
  const t = s.replace(/[−–]/g, '-');
  const after = t.match(/d20\s*([-+]\s*\d+)/i);
  if (after) return Number(after[1].replace(/\s/g, ''));
  const m = t.match(/[-+]?\d+/);
  return m ? Number(m[0]) : null;
};

/** "D6+4 pirsing" → "1d6+4" (el motor separa luego dados y modificador) */
export const parseDamageCell = (s?: string) => {
  const m = (s ?? '').match(/(\d*)\s*d\s*(\d+)(\s*[-+]\s*\d+)?/i);
  if (!m) return (s ?? '').trim() || '1';
  return `${m[1] || 1}d${m[2]}${m[3] ? m[3].replace(/\s/g, '') : ''}`;
};

// Raíces de palabras de tipos de daño en español e inglés, tolerantes con faltas ("pirsing")
const DAMAGE_STEMS: [RegExp, DamageType][] = [
  [/perf|pier|pirs|pierc/i, 'perforante'], [/cort|slash|slas/i, 'cortante'], [/contun|blud|bludg/i, 'contundente'],
  [/fueg|fire/i, 'fuego'], [/fri[oó]|cold|hiel/i, 'frio'], [/rel[aá]mp|light|electr|rayo/i, 'relampago'], [/trueno|thund/i, 'trueno'],
  [/[aá]cid/i, 'acido'], [/venen|poison/i, 'veneno'], [/necr/i, 'necrotico'], [/radi/i, 'radiante'], [/ps[ií]q|psych/i, 'psiquico'],
  [/fuerza|force/i, 'fuerza'],
];
export const parseDamageType = (s: string): DamageType | null => DAMAGE_STEMS.find(([re]) => re.test(s))?.[1] ?? null;

/** "D8", "3d8", "d10" → 8/8/10 */
export const parseHitDie = (s?: string) => {
  const m = (s ?? '').match(/d\s*(6|8|10|12)/i);
  return m ? Number(m[1]) : null;
};

export function setSkill(s: ImportedSheet, id: string, expertise: boolean) {
  const prev = s.skills.find((x) => x.skill === id);
  if (prev) prev.expertise = prev.expertise || expertise;
  else s.skills.push({ skill: id, expertise });
}
