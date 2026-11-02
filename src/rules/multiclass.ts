// Multiclase (reglas 2024): niveles por clase, espacios de conjuro combinados y requisitos.
import type { Ability, Character } from '../types';
import { CLASSES, FULL_CASTER_SLOTS, abilityShort, pactSlotsFor, type ClassInfo } from './srd';

export interface ClassEntry { cls: ClassInfo; level: number; subclass: string; primary: boolean }

/** Clases del personaje con su nivel: la principal (classId) y las de multiclase */
export function classLevels(c: Character): ClassEntry[] {
  const extra = (c.multiclass ?? []).filter((m) => CLASSES.some((x) => x.id === m.classId) && m.level > 0);
  const extraLevels = extra.reduce((s, m) => s + m.level, 0);
  const out: ClassEntry[] = [];
  const main = CLASSES.find((x) => x.id === c.classId);
  if (main) out.push({ cls: main, level: Math.max(1, c.level - extraLevels), subclass: c.subclass, primary: true });
  for (const m of extra) out.push({ cls: CLASSES.find((x) => x.id === m.classId)!, level: m.level, subclass: m.subclass, primary: false });
  return out;
}

export const classLevelOf = (c: Character, classId: string) => classLevels(c).find((e) => e.cls.id === classId)?.level ?? 0;
export const isMulticlass = (c: Character) => classLevels(c).length > 1;

/** «Guerrero 3 / Mago 2» */
export const classSummary = (c: Character, name: (cls: ClassInfo) => string) => classLevels(c).map((e) => `${name(e.cls)} ${e.level}`).join(' / ');

/** Subclases que lanzan conjuros (un tercio del nivel) */
const THIRD = /arcane trickster|eldritch knight|embaucador arcano|caballero arcano/i;

/**
 * Espacios de conjuro de un personaje (también multiclase): niveles completos de bardo, clérigo, druida,
 * hechicero y mago; la mitad (redondeando arriba) de paladín y explorador; un tercio (abajo) de Caballero
 * arcano y Embaucador arcano. La magia de pacto del brujo va aparte.
 */
export function spellSlotsFor(c: Character): { slots: number[]; pact: { level: number; max: number } | null } {
  const entries = classLevels(c);
  const casters = entries.filter((e) => e.cls.caster === 'full' || e.cls.caster === 'half' || THIRD.test(e.subclass));
  let casterLevel = 0;
  if (casters.length === 1 && entries.length >= 1) {
    const e = casters[0];
    casterLevel = e.cls.caster === 'full' ? e.level : e.cls.caster === 'half' ? Math.ceil(e.level / 2) : Math.floor(e.level / 3);
  } else {
    for (const e of casters) casterLevel += e.cls.caster === 'full' ? e.level : e.cls.caster === 'half' ? Math.ceil(e.level / 2) : Math.floor(e.level / 3);
  }
  const warlock = entries.find((e) => e.cls.caster === 'pact');
  return { slots: FULL_CASTER_SLOTS[Math.min(20, casterLevel)] ?? [], pact: warlock ? pactSlotsFor(warlock.level) : null };
}

/** Característica principal de cada clase para multiclase (13 o más) */
export const MULTICLASS_REQ: Record<string, { all?: Ability[]; any?: Ability[] }> = {
  barbaro: { all: ['str'] }, bardo: { all: ['cha'] }, clerigo: { all: ['wis'] }, druida: { all: ['wis'] },
  guerrero: { any: ['str', 'dex'] }, monje: { all: ['dex', 'wis'] }, paladin: { all: ['str', 'cha'] }, explorador: { all: ['dex', 'wis'] },
  picaro: { all: ['dex'] }, hechicero: { all: ['cha'] }, brujo: { all: ['cha'] }, mago: { all: ['int'] },
};

export function meetsReq(c: Character, classId: string): boolean {
  const req = MULTICLASS_REQ[classId];
  if (!req) return true;
  if (req.all && !req.all.every((a) => c.abilities[a] >= 13)) return false;
  if (req.any && !req.any.some((a) => c.abilities[a] >= 13)) return false;
  return true;
}
export const reqText = (classId: string) => {
  const req = MULTICLASS_REQ[classId];
  if (!req) return '';
  return req.all ? req.all.map((a) => `${abilityShort(a)} 13`).join(' + ') : (req.any ?? []).map((a) => `${abilityShort(a)} 13`).join(' / ');
};

/**
 * Pone la clase principal y lo que da (dado de golpe, salvaciones, competencias, característica de
 * conjuros, recursos, espacios y rasgos de su nivel). Lo que el jugador haya añadido a mano se conserva.
 */
export function applyClass(c: Character, classId: string, lang: (t: { es: string; en: string }) => string, resourceName: (key: string) => string, profs?: { armor: Character['armorTraining']; weapons: string; tools?: string }): Character {
  const cls = CLASSES.find((x) => x.id === classId);
  const next = structuredClone(c);
  if (!cls) return next;
  const prev = CLASSES.find((x) => x.id === c.classId);
  next.classId = cls.id;
  next.className = lang(cls.name);
  // La subclase de la clase anterior no vale para la nueva
  if (prev && prev.id !== cls.id) next.subclass = '';
  next.hitDie = cls.hitDie;
  if (!c.saveProf.length || (prev && [...c.saveProf].sort().join() === [...prev.saves].sort().join())) next.saveProf = [...cls.saves];
  if (cls.spellAbility) next.spellAbility = cls.spellAbility;
  else if (prev?.spellAbility && c.spellAbility === prev.spellAbility) next.spellAbility = null;
  if (profs) {
    next.armorTraining = { light: c.armorTraining.light || profs.armor.light, medium: c.armorTraining.medium || profs.armor.medium, heavy: c.armorTraining.heavy || profs.armor.heavy, shields: c.armorTraining.shields || profs.armor.shields };
    if (!c.weaponProf.trim()) next.weaponProf = profs.weapons;
    if (profs.tools && !c.toolProf.trim()) next.toolProf = profs.tools;
  }
  next.multiclass = (c.multiclass ?? []).filter((m) => m.classId !== cls.id);
  const lv = classLevels(next).find((e) => e.cls.id === cls.id)?.level ?? c.level;
  // Rasgos y recursos de la clase anterior se sustituyen por los de la nueva
  const prevNames = new Set(prev ? prev.features(20).flatMap((f) => [f.name.es, f.name.en]) : []);
  const mods = { str: Math.floor((next.abilities.str - 10) / 2), dex: Math.floor((next.abilities.dex - 10) / 2), con: Math.floor((next.abilities.con - 10) / 2), int: Math.floor((next.abilities.int - 10) / 2), wis: Math.floor((next.abilities.wis - 10) / 2), cha: Math.floor((next.abilities.cha - 10) / 2) };
  next.features = [
    ...cls.features(lv).filter((f) => !c.features.some((x) => x.name === f.name.es || x.name === f.name.en)).map((f) => ({ id: Math.random().toString(36).slice(2, 10), name: lang(f.name), text: lang(f.text) })),
    ...c.features.filter((f) => !prevNames.has(f.name) || cls.features(20).some((x) => x.name.es === f.name || x.name.en === f.name)),
  ];
  const defs = classLevels(next).flatMap((e) => e.cls.resources(e.level, mods));
  next.resources = [
    ...defs.map((r) => { const old = c.resources.find((x) => x.key === r.key); return { id: old?.id ?? Math.random().toString(36).slice(2, 10), key: r.key, name: resourceName(r.key), max: r.max, used: Math.min(r.max, old?.used ?? 0), recovers: r.recovers }; }),
    ...c.resources.filter((x) => !x.key),
  ];
  const { slots, pact } = spellSlotsFor(next);
  next.slots = slots.map((n, i) => ({ max: n, used: Math.min(n, c.slots[i]?.used ?? 0) }));
  next.pactSlots = pact ? { ...pact, used: Math.min(c.pactSlots?.used ?? 0, pact.max) } : null;
  return next;
}

/** Dados de golpe de todas las clases: «3d12 + 2d6» */
export function hitDiceText(c: Character): string {
  const entries = classLevels(c);
  if (entries.length <= 1) return `${c.level}d${entries[0]?.cls.hitDie ?? c.hitDie}`;
  const byDie = new Map<number, number>();
  for (const e of entries) byDie.set(e.cls.hitDie, (byDie.get(e.cls.hitDie) ?? 0) + e.level);
  return [...byDie.entries()].sort((a, b) => b[0] - a[0]).map(([d, n]) => `${n}d${d}`).join(' + ');
}
