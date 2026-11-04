import type { ItemData } from './rules/itemTypes';
import type { AvatarLook } from './rules/avatar';
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
  /** Claves de texto: 'saveDex', 'strChecksSaves'… (ver srd.ts ADV_LABELS) */
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
  ritual?: boolean;
  material?: boolean;
  /** Componentes como en el manual: «V, S, M» (verbal, somático, material) */
  components?: string;
  /** Siempre preparado por un rasgo de clase (no cuenta para el límite) */
  alwaysPrepared?: boolean;
  notes?: string;
}

export interface Resource {
  id: string;
  /** Identificador estable para recursos de clase conocidos (rage, second_wind…) */
  key?: string;
  name: string;
  max: number;
  used: number;
  recovers: 'short' | 'long';
}

/** Cómo se recupera un rasgo o conjuro: descanso corto, largo, gastando un espacio de conjuro o a voluntad */
export type Recharge = 'short' | 'long' | 'slot' | 'atwill';

export interface Feature {
  id: string;
  name: string;
  text: string;
  recharge?: Recharge;
}

export interface SlotState {
  max: number;
  used: number;
}

export interface NoteFolder {
  id: string;
  /** Carpetas predefinidas: names, places, quests, items, chronicles (nombre traducido) */
  key?: string;
  name: string;
}

export interface Note {
  id: string;
  createdAt: number;
  title: string;
  body: string;
  kind: 'note' | 'story' | 'transcript';
  folderId?: string | null;
}

/** Participante en el orden de iniciativa: tu personaje, compañeros o enemigos */
export interface InitEntry {
  id: string;
  name: string;
  kind: 'self' | 'ally' | 'enemy';
  initiative: number | null;
  /** PG máximos (null = desconocidos, se muestra «?») */
  hpMax?: number | null;
  /** Daño acumulado (los PG actuales son hpMax − daño). Se cuenta aunque no se conozca el máximo. */
  damage?: number;
  /** PG temporales */
  temp?: number;
}

export interface CombatState {
  active: boolean;
  round: number;
  initiative: number | null;
  action: boolean;
  bonus: boolean;
  reaction: boolean;
  movementUsed: number;
  /** Orden de turnos (se puede reordenar arrastrando) */
  order: InitEntry[];
  /** Índice en `order` de quien tiene el turno */
  turn: number;
  /** Ya se ha pasado algún turno (antes de eso el turno es siempre del primero del orden) */
  begun?: boolean;
}

export interface Coins {
  cp: number;
  sp: number;
  ep: number;
  gp: number;
  pp: number;
}

export interface Character {
  id: string;
  name: string;
  species: string;
  /** Id de clase de srd.ts (barbaro, bardo…) o '' si es personalizada */
  classId: string;
  /** Nombre libre de la clase (para clases personalizadas o importadas) */
  className: string;
  subclass: string;
  background: string;
  level: number;
  xp: number;
  size: string;
  alignment: string;
  portrait: string | null;
  /** Miniatura de la cara del retrato dibujado (para la barra superior) */
  portraitThumb?: string;
  abilities: Record<Ability, number>;
  saveProf: Ability[];
  skillProf: Record<string, ProfLevel>;
  baseAc: number;
  acNote: string;
  /** Lleva escudo: +2 a la CA */
  shield: boolean;
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
  speciesTraits: string;
  feats: string;
  armorTraining: { light: boolean; medium: boolean; heavy: boolean; shields: boolean };
  weaponProf: string;
  toolProf: string;
  languages: string;
  appearance: string;
  backstory: string;
  inventory: string;
  attunement: string[];
  coins: Coins;
  notes: Note[];
  noteFolders: NoteFolder[];
  combat: CombatState;
  /** Ids de avisos de la ficha que el jugador ha decidido ignorar */
  ignoredFlags: string[];
  /** Enemigos a los que este personaje ha dado el golpe final */
  kills: Kill[];
  /** Clases adicionales (multiclase). El nivel de la clase principal es `level` menos la suma de estas */
  multiclass: ClassLevel[];
  /** Linaje o ascendencia de la especie (alto elfo, dracónido rojo…) */
  lineage?: string;
  /** Munición y consumibles con su cantidad */
  consumables: Consumable[];
  /** Aspecto elegido en el editor de personaje (retrato pixel) */
  look?: AvatarLook;
  /** Datos físicos del editor de personaje */
  physical?: Physical;
  /** Objetos con rareza, valor y descripción (los que da el DM o se añaden desde el catálogo) */
  items: OwnedItem[];
  /** Ids de entregas del DM ya aplicadas a esta ficha (para no sumarlas dos veces) */
  giftsReceived: string[];
  /** Bonificadores añadidos a mano a una tirada: 'skill:religion', 'save:wis', 'check:dex', 'init' */
  bonusAdj?: Record<string, BonusAdj>;
  /** Reglas automáticas (de clase, especie o dote) que el jugador ha desactivado */
  rulesOff?: string[];
}

/** Bonificador propio: número fijo + modificador de una característica (p. ej. «+ SAB» de un rasgo) */
export interface BonusAdj {
  flat: number;
  ability?: Ability | null;
  note?: string;
}

/** Objeto en la ficha */
export interface OwnedItem extends ItemData {
  id: string;
  /** Quién lo dio («DM») y cuándo */
  from?: string;
  at?: number;
  /** Id de la entrega del DM */
  gift?: string;
}

export interface Physical {
  age: string;
  height: string;
  weight: string;
  eyes: string;
  hair: string;
  skin: string;
}

export interface ClassLevel {
  classId: string;
  level: number;
  subclass: string;
}

export interface Consumable {
  id: string;
  name: string;
  qty: number;
  /** ammo: se recupera la mitad tras el combate (reglas 2024); thrown: armas arrojadizas que se recogen; item: se gasta (pociones, pergaminos…) */
  kind: 'ammo' | 'thrown' | 'item';
  /** Gastados en el combate actual */
  used: number;
}

export interface Kill {
  id: string;
  /** Nombre del enemigo («Goblin guerrero 2») */
  name: string;
  at: number;
  /** party: combate compartido · local: combate de la app · manual: añadido a mano */
  source: 'party' | 'local' | 'manual';
  /** Id del evento del combate compartido (para no contarlo dos veces y quitarlo al deshacer) */
  ref?: string;
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
