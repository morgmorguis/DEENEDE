export type Ability = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

export type DamageType =
  | 'acido' | 'contundente' | 'frio' | 'fuego' | 'fuerza' | 'relampago' | 'necrotico'
  | 'perforante' | 'veneno' | 'psiquico' | 'radiante' | 'cortante' | 'trueno';

export type ConditionId =
  | 'agarrado' | 'apresado' | 'asustado' | 'aturdido' | 'cegado' | 'derribado' | 'ensordecido'
  | 'envenenado' | 'hechizado' | 'incapacitado' | 'inconsciente' | 'invisible' | 'paralizado'
  | 'petrificado';

/** 0 = sin competencia, 1 = competente, 2 = pericia */
export type ProfLevel = 0 | 1 | 2;

/** Tipos de tirada a los que afecta un modificador de efecto */
export type RollScope = 'attack' | 'save' | 'check' | 'damage' | 'initiative';

export interface EffectMods {
  ac?: number;
  /** Fija la CA base (p. ej. Armadura de mago: 13 + DES) */
  acBase?: number;
  speed?: number;
  speedMult?: number;
  maxHp?: number;
  /** Bonificadores de dado o planos, p. ej. { attack: '+1d4', save: '+1d4' } */
  bonus?: Partial<Record<RollScope, string>>;
  advantage?: string[];
  disadvantage?: string[];
  resist?: DamageType[];
  immune?: DamageType[];
}

export interface Effect {
  id: string;
  name: string;
  kind: 'buff' | 'debuff';
  /** null = sin duración en rondas (hasta descanso o hasta que lo quites) */
  roundsLeft: number | null;
  concentration: boolean;
  mods: EffectMods;
  notes?: string;
  presetId?: string;
}

export interface Attack {
  id: string;
  name: string;
  ability: Ability;
  proficient: boolean;
  damage: string;
  damageType: DamageType;
  /** Texto libre: "5 pies", "80/320 pies" */
  range: string;
  extraBonus: number;
  mastery?: string;
  notes?: string;
}

export interface Spell {
  id: string;
  name: string;
  level: number;
  prepared: boolean;
  castingTime: string;
  range: string;
  concentration: boolean;
  notes?: string;
}

export interface Resource {
  id: string;
  name: string;
  max: number;
  used: number;
  recovers: 'short' | 'long';
}

export interface Feature {
  id: string;
  name: string;
  text: string;
}

export interface SlotState {
  max: number;
  used: number;
}

export interface Note {
  id: string;
  createdAt: number;
  title: string;
  body: string;
  kind: 'note' | 'story' | 'transcript';
}

export interface CombatState {
  active: boolean;
  round: number;
  initiative: number | null;
  action: boolean;
  bonus: boolean;
  reaction: boolean;
  movementUsed: number;
}

export interface Character {
  id: string;
  name: string;
  species: string;
  className: string;
  subclass: string;
  background: string;
  level: number;
  abilities: Record<Ability, number>;
  saveProf: Ability[];
  skillProf: Record<string, ProfLevel>;
  baseAc: number;
  acNote: string;
  speed: number;
  hp: { max: number; current: number; temp: number };
  hitDie: number;
  hitDiceSpent: number;
  deathSaves: { success: number; fail: number };
  stable: boolean;
  dead: boolean;
  exhaustion: number;
  heroicInspiration: boolean;
  conditions: ConditionId[];
  effects: Effect[];
  resistances: DamageType[];
  vulnerabilities: DamageType[];
  immunities: DamageType[];
  spellAbility: Ability | null;
  slots: SlotState[]; // índice 0 = nivel 1
  pactSlots: { level: number; max: number; used: number } | null;
  concentratingOn: string | null;
  resources: Resource[];
  attacks: Attack[];
  spells: Spell[];
  features: Feature[];
  inventory: string;
  notes: Note[];
  combat: CombatState;
}

export interface LogEntry {
  id: string;
  at: number;
  role: 'user' | 'app';
  text: string;
  /** Pasos del cálculo para mostrar al usuario */
  details?: string[];
  /** Instantánea anterior para poder deshacer */
  undo?: Character;
  /** Acciones sugeridas (tiradas rápidas) */
  quickRolls?: { label: string; expr: string }[];
}
