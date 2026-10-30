import type { Ability, Character, Resource } from '../types';
import { abilityMods, mod } from './calc';
import { CLASSES, DEFAULT_FOLDERS, RESOURCE_NAMES, SKILLS, classById, pactSlotsFor, slotsFor } from './srd';
import { L, T } from '../i18n';

export const uid = () => Math.random().toString(36).slice(2, 10);

export interface NewCharacterInput {
  name: string;
  species: string;
  classId: string;
  level: number;
  background: string;
  abilities: Record<Ability, number>;
  skills: string[];
}

export const defaultFolders = () => DEFAULT_FOLDERS.map((f) => ({ id: uid(), key: f.key, name: L(f.name) }));

/** Ficha vacía con todos los campos; base para crear, importar y migrar */
export function blankCharacter(): Character {
  return {
    id: uid(),
    name: '',
    species: '',
    classId: '',
    className: '',
    subclass: '',
    background: '',
    level: 1,
    xp: 0,
    size: '',
    alignment: '',
    portrait: null,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    saveProf: [],
    skillProf: Object.fromEntries(SKILLS.map((s) => [s.id, 0])) as Character['skillProf'],
    baseAc: 10,
    acNote: '',
    shield: false,
    speed: 30,
    hp: { max: 1, current: 1, temp: 0 },
    hitDie: 8,
    hitDiceSpent: 0,
    deathSaves: { success: 0, fail: 0 },
    stable: false,
    dead: false,
    exhaustion: 0,
    heroicInspiration: false,
    conditions: [],
    effects: [],
    resistances: [],
    vulnerabilities: [],
    immunities: [],
    spellAbility: null,
    slots: [],
    pactSlots: null,
    concentratingOn: null,
    resources: [],
    attacks: [],
    spells: [],
    features: [],
    speciesTraits: '',
    feats: '',
    armorTraining: { light: false, medium: false, heavy: false, shields: false },
    weaponProf: '',
    toolProf: '',
    languages: '',
    appearance: '',
    backstory: '',
    inventory: '',
    attunement: ['', '', ''],
    coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    notes: [],
    noteFolders: defaultFolders(),
    combat: { active: false, round: 1, initiative: null, action: false, bonus: false, reaction: false, movementUsed: 0, order: [], turn: 0 },
    ignoredFlags: [],
  };
}

// Nombres de recursos de versiones anteriores (solo en español) → clave estable
const LEGACY_RESOURCE_KEYS: Record<string, string> = Object.fromEntries(
  Object.entries(RESOURCE_NAMES).flatMap(([k, v]) => [[v.es.toLowerCase(), k], [v.en.toLowerCase(), k]]),
);

/** Completa los campos que falten (fichas antiguas o importadas) sin perder los existentes */
export function normalizeCharacter(raw: Partial<Character> & Record<string, unknown>): Character {
  const base = blankCharacter();
  const c = { ...base, ...raw } as Character;
  c.hp = { ...base.hp, ...(raw.hp ?? {}) };
  c.abilities = { ...base.abilities, ...(raw.abilities ?? {}) };
  c.skillProf = { ...base.skillProf, ...(raw.skillProf ?? {}) };
  c.coins = { ...base.coins, ...(raw.coins ?? {}) };
  c.armorTraining = { ...base.armorTraining, ...(raw.armorTraining ?? {}) };
  c.combat = { ...base.combat, ...(raw.combat ?? {}) };
  c.deathSaves = { ...base.deathSaves, ...(raw.deathSaves ?? {}) };
  c.ignoredFlags = Array.isArray(raw.ignoredFlags) ? raw.ignoredFlags : [];
  c.attunement = [0, 1, 2].map((i) => raw.attunement?.[i] ?? '');
  if (!c.classId && c.className) c.classId = classById(c.className)?.id ?? '';
  c.resources = (c.resources ?? []).map((r: Resource) => ({ ...r, key: r.key ?? LEGACY_RESOURCE_KEYS[r.name.toLowerCase()] }));
  c.noteFolders = raw.noteFolders?.length ? raw.noteFolders : base.noteFolders;
  c.notes = (c.notes ?? []).map((n) => ({ ...n, folderId: n.folderId ?? (n.kind === 'story' ? c.noteFolders.find((x) => x.key === 'chronicles')?.id ?? null : null) }));
  return c;
}

/** Crea una ficha nueva aplicando las reglas de clase 2024: dado de golpe, salvaciones, espacios y recursos. */
export function createCharacter(input: NewCharacterInput): Character {
  const cls = CLASSES.find((c) => c.id === input.classId) ?? CLASSES[0];
  const level = Math.min(20, Math.max(1, input.level));
  const conMod = mod(input.abilities.con);
  // PG: máximo del dado en nivel 1 + media redondeada hacia arriba en los siguientes
  const hpMax = Math.max(1, cls.hitDie + conMod + (level - 1) * (cls.hitDie / 2 + 1 + conMod));
  const pact = cls.caster === 'pact' ? pactSlotsFor(level) : null;
  const sp = input.species.toLowerCase();

  const c = blankCharacter();
  Object.assign(c, {
    name: input.name || T('Aventurero', 'Adventurer'),
    species: input.species,
    classId: cls.id,
    className: L(cls.name),
    background: input.background,
    level,
    size: L({ es: 'Mediano', en: 'Medium' }),
    abilities: { ...input.abilities },
    saveProf: [...cls.saves],
    baseAc: 10 + mod(input.abilities.dex),
    acNote: T('Sin armadura', 'Unarmored'),
    speed: /goliat|goliath/.test(sp) ? 35 : 30,
    hp: { max: hpMax, current: hpMax, temp: 0 },
    hitDie: cls.hitDie,
    heroicInspiration: /humano|human/.test(sp),
    spellAbility: cls.spellAbility,
    slots: slotsFor(cls.caster, level).map((n) => ({ max: n, used: 0 })),
    pactSlots: pact ? { ...pact, used: 0 } : null,
    features: cls.features(level).map((x) => ({ id: uid(), name: L(x.name), text: L(x.text) })),
  });
  for (const s of SKILLS) c.skillProf[s.id] = input.skills.includes(s.id) ? 1 : 0;
  if (cls.id === 'barbaro') {
    c.baseAc = 10 + mod(input.abilities.dex) + conMod;
    c.acNote = T('Defensa sin armadura', 'Unarmored Defense');
  }
  if (cls.id === 'monje') {
    c.baseAc = 10 + mod(input.abilities.dex) + mod(input.abilities.wis);
    c.acNote = T('Defensa sin armadura', 'Unarmored Defense');
  }
  c.resources = cls.resources(level, abilityMods(c)).map((r) => ({ id: uid(), used: 0, key: r.key, name: L(RESOURCE_NAMES[r.key]), max: r.max, recovers: r.recovers }));
  return c;
}

/** Recalcula los datos de clase al subir de nivel conservando lo personalizado. */
export function levelUp(c: Character, newLevel: number): Character {
  const cls = classById(c.classId || c.className);
  const next = structuredClone(c);
  const level = Math.min(20, Math.max(1, newLevel));
  if (!cls) {
    next.level = level;
    return next;
  }
  const gained = level - c.level;
  const perLevel = cls.hitDie / 2 + 1 + mod(c.abilities.con);
  next.level = level;
  next.hp.max = Math.max(1, c.hp.max + gained * perLevel);
  next.hp.current = Math.min(next.hp.max, Math.max(0, c.hp.current + gained * perLevel));
  const slots = slotsFor(cls.caster, level);
  next.slots = slots.map((n, i) => ({ max: n, used: Math.min(n, c.slots[i]?.used ?? 0) }));
  if (cls.caster === 'pact') next.pactSlots = { ...pactSlotsFor(level), used: 0 };
  const defs = cls.resources(level, abilityMods(next));
  next.resources = [
    ...defs.map((r) => {
      const prev = c.resources.find((x) => x.key === r.key);
      return { id: prev?.id ?? uid(), key: r.key, name: L(RESOURCE_NAMES[r.key]), max: r.max, used: Math.min(r.max, prev?.used ?? 0), recovers: r.recovers };
    }),
    ...c.resources.filter((x) => !defs.some((r) => r.key === x.key)),
  ];
  // Rasgos de clase regenerados; los añadidos a mano se conservan
  const allClassNames = new Set(cls.features(20).flatMap((x) => [x.name.es, x.name.en]));
  const custom = c.features.filter((x) => !allClassNames.has(x.name));
  next.features = [...cls.features(level).map((x) => ({ id: uid(), name: L(x.name), text: L(x.text) })), ...custom];
  return next;
}

/** Personaje de ejemplo para enseñar la app nada más abrirla. */
export function sampleCharacter(): Character {
  const c = createCharacter({
    name: 'Brakka Pielpétrea',
    species: T('Goliat', 'Goliath'),
    classId: 'barbaro',
    level: 3,
    background: T('Soldado', 'Soldier'),
    abilities: { str: 17, dex: 14, con: 16, int: 8, wis: 12, cha: 10 },
    skills: ['atletismo', 'intimidacion', 'percepcion', 'supervivencia'],
  });
  c.subclass = T('Senda del Berserker', 'Path of the Berserker');
  c.alignment = T('Caótico bueno', 'Chaotic Good');
  c.armorTraining = { light: true, medium: true, heavy: false, shields: true };
  c.weaponProf = T('Armas sencillas y marciales', 'Simple and Martial weapons');
  c.toolProf = T('Juego de dados', 'Dice set');
  c.languages = T('Común, Gigante', 'Common, Giant');
  c.attacks = [
    { id: uid(), name: T('Gran hacha', 'Greataxe'), ability: 'str', proficient: true, damage: '1d12', damageType: 'cortante', range: T('5 pies', '5 ft'), extraBonus: 0, mastery: 'cleave', notes: T('A dos manos, pesada.', 'Two-handed, heavy.') },
    { id: uid(), name: T('Jabalina', 'Javelin'), ability: 'str', proficient: true, damage: '1d6', damageType: 'perforante', range: T('30/120 pies', '30/120 ft'), extraBonus: 0, mastery: 'slow', notes: T('Arrojadiza. Llevas 4.', 'Thrown. You carry 4.') },
  ];
  c.speciesTraits = T(
    'Gigante de piedra: reacción al recibir daño, tira 1d12 + mod. CON y reduce el daño. Usos = bonificador de competencia por descanso largo.\nForma grande (nivel 5).',
    'Stone’s Endurance: reaction when you take damage, roll 1d12 + CON mod and reduce the damage. Uses = Proficiency Bonus per Long Rest.\nLarge Form (level 5).',
  );
  c.feats = T('Duro (Tough): +2 PG por nivel.', 'Tough: +2 HP per level.');
  c.resources.push({ id: uid(), key: 'stone_giant', name: L(RESOURCE_NAMES.stone_giant), max: 2, used: 0, recovers: 'long' });
  c.inventory = T('Gran hacha, 4 jabalinas, mochila de explorador, 2 pociones de curación.', 'Greataxe, 4 javelins, explorer’s pack, 2 potions of healing.');
  c.coins.gp = 15;
  c.appearance = T('Piel gris moteada, 2,20 m, cicatrices rituales en los brazos.', 'Mottled grey skin, 7’3”, ritual scars on the arms.');
  c.backstory = T('Exsoldado de una compañía mercenaria de las montañas.', 'Former soldier of a mountain mercenary company.');
  return c;
}
