import type { Ability, Character } from '../types';
import { abilityMods, mod } from './calc';
import { CLASSES, SKILLS, pactSlotsFor, slotsFor } from './srd';

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

/** Crea una ficha nueva aplicando las reglas de clase 2024: dado de golpe, salvaciones, espacios y recursos. */
export function createCharacter(input: NewCharacterInput): Character {
  const cls = CLASSES.find((c) => c.id === input.classId) ?? CLASSES[0];
  const level = Math.min(20, Math.max(1, input.level));
  const conMod = mod(input.abilities.con);
  // PG: máximo del dado en nivel 1 + media redondeada hacia arriba en los siguientes
  const hpMax = cls.hitDie + conMod + (level - 1) * (cls.hitDie / 2 + 1 + conMod);
  const skillProf: Character['skillProf'] = {};
  for (const s of SKILLS) skillProf[s.id] = input.skills.includes(s.id) ? 1 : 0;
  const pact = cls.caster === 'pact' ? pactSlotsFor(level) : null;

  const base: Character = {
    id: uid(),
    name: input.name || 'Aventurero',
    species: input.species,
    className: cls.name,
    subclass: '',
    background: input.background,
    level,
    abilities: { ...input.abilities },
    saveProf: [...cls.saves],
    skillProf,
    baseAc: 10 + mod(input.abilities.dex),
    acNote: 'Sin armadura',
    speed: input.species === 'Enano' || input.species === 'Mediano' || input.species === 'Gnomo' ? 30 : input.species === 'Goliat' ? 35 : 30,
    hp: { max: Math.max(1, hpMax), current: Math.max(1, hpMax), temp: 0 },
    hitDie: cls.hitDie,
    hitDiceSpent: 0,
    deathSaves: { success: 0, fail: 0 },
    stable: false,
    dead: false,
    exhaustion: 0,
    heroicInspiration: input.species === 'Humano',
    conditions: [],
    effects: [],
    resistances: [],
    vulnerabilities: [],
    immunities: [],
    spellAbility: cls.spellAbility,
    slots: slotsFor(cls.caster, level).map((n) => ({ max: n, used: 0 })),
    pactSlots: pact ? { ...pact, used: 0 } : null,
    concentratingOn: null,
    resources: [],
    attacks: [],
    spells: [],
    features: cls.features(level).map((f) => ({ id: uid(), ...f })),
    inventory: '',
    notes: [],
    combat: { active: false, round: 1, initiative: null, action: false, bonus: false, reaction: false, movementUsed: 0 },
  };
  if (cls.id === 'barbaro') {
    base.baseAc = 10 + mod(input.abilities.dex) + conMod;
    base.acNote = 'Defensa sin armadura';
  }
  if (cls.id === 'monje') {
    base.baseAc = 10 + mod(input.abilities.dex) + mod(input.abilities.wis);
    base.acNote = 'Defensa sin armadura';
  }
  base.resources = cls.resources(level, abilityMods(base)).map((r) => ({ id: uid(), used: 0, ...r }));
  return base;
}

/** Recalcula los datos de clase al subir de nivel conservando lo personalizado. */
export function levelUp(c: Character, newLevel: number): Character {
  const cls = CLASSES.find((x) => x.name === c.className);
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
  const res = cls.resources(level, abilityMods(next));
  next.resources = [
    ...res.map((r) => ({ id: c.resources.find((x) => x.name === r.name)?.id ?? uid(), used: Math.min(r.max, c.resources.find((x) => x.name === r.name)?.used ?? 0), ...r })),
    ...c.resources.filter((x) => !res.some((r) => r.name === x.name)),
  ];
  const classFeatures = cls.features(level);
  const custom = c.features.filter((f) => !cls.features(20).some((cf) => cf.name === f.name));
  next.features = [...classFeatures.map((f) => ({ id: uid(), ...f })), ...custom];
  return next;
}

/** Personaje de ejemplo para enseñar la app nada más abrirla. */
export function sampleCharacter(): Character {
  const c = createCharacter({
    name: 'Brakka Pielpétrea',
    species: 'Goliat',
    classId: 'barbaro',
    level: 3,
    background: 'Soldado',
    abilities: { str: 17, dex: 14, con: 16, int: 8, wis: 12, cha: 10 },
    skills: ['atletismo', 'intimidacion', 'percepcion', 'supervivencia'],
  });
  c.attacks = [
    { id: uid(), name: 'Gran hacha', ability: 'str', proficient: true, damage: '1d12', damageType: 'cortante', range: '5 pies', extraBonus: 0, mastery: 'Hender (Cleave)', notes: 'A dos manos, pesada.' },
    { id: uid(), name: 'Jabalina', ability: 'str', proficient: true, damage: '1d6', damageType: 'perforante', range: '30/120 pies', extraBonus: 0, mastery: 'Ralentizar (Slow)', notes: 'Arrojadiza. Llevas 4.' },
    { id: uid(), name: 'Ataque sin armas', ability: 'str', proficient: true, damage: '1', damageType: 'contundente', range: '5 pies', extraBonus: 0, notes: 'También puedes Agarrar o Empujar.' },
  ];
  c.features.push(
    { id: uid(), name: 'Gigante de piedra (Goliat)', text: 'Reacción al recibir daño: tira 1d12 + mod. CON y reduce el daño en ese total. Usos = bonificador de competencia por descanso largo.' },
    { id: uid(), name: 'Forma grande (Goliat)', text: 'A partir de nivel 5, acción adicional para volverte Grande durante 10 minutos.' },
  );
  c.resources.push({ id: uid(), name: 'Gigante de piedra', max: 2, used: 0, recovers: 'long' });
  c.inventory = 'Gran hacha, 4 jabalinas, mochila de explorador, 2 pociones de curación, 15 po.';
  return c;
}
