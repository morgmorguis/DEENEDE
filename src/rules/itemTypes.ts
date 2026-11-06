// Tipos de objetos y monedas (sin dependencias: los usa también el servidor de la partida).

export type Rarity = 'mundane' | 'common' | 'uncommon' | 'rare' | 'veryRare' | 'legendary' | 'artifact';
export type ItemType = 'weapon' | 'armor' | 'potion' | 'scroll' | 'wondrous' | 'ring' | 'wand' | 'gear' | 'treasure' | 'other';

/** Objeto tal como se entrega o se guarda en la ficha */
export interface ItemData {
  name: string;
  rarity: Rarity;
  type: ItemType;
  description: string;
  /** Valor en piezas de oro (puede ser decimal: 0,5 = 5 pp) */
  value: number;
  /** Peso en libras */
  weight?: number;
  attunement?: boolean;
  qty: number;
  /** Id del catálogo, si sale de él */
  ref?: string;
  /** Efectos al equiparlo */
  mods?: ItemMods;
}

export interface Coins5 { cp: number; sp: number; ep: number; gp: number; pp: number }

export type AbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';

/** Lo que hace un objeto mientras lo llevas equipado (y sintonizado, si lo requiere) */
export interface ItemMods {
  /** Armadura: CA base, máximo de Destreza (null = sin límite), pesada (requisito de Fuerza) y desventaja en Sigilo */
  armor?: { base: number; dexMax: number | null; kind: 'light' | 'medium' | 'heavy'; str?: number; stealthDis?: boolean };
  /** Escudo: CA que da (2, o 3 si es +1…) */
  shield?: number;
  /** CA extra (anillo o capa de protección, armadura +1…) */
  ac?: number;
  /** CA extra solo sin armadura ni escudo (brazales de defensa) */
  acNoArmor?: number;
  /** A todas las tiradas de salvación */
  saves?: number;
  /** A todas las pruebas de característica (incluida la iniciativa) */
  checks?: number;
  /** Fija la puntuación si la tuya es menor (guanteletes de poder de ogro: FUE 19) */
  abilitySet?: Partial<Record<AbilityKey, number>>;
  /** Suma a la puntuación */
  abilityBonus?: Partial<Record<AbilityKey, number>>;
  speed?: number;
  /** Arma mágica: ataque y daño */
  attack?: number;
  damage?: number;
  /** Datos del arma para crear su fila de ataque al equiparla */
  weapon?: { dice: string; type: string; finesse?: boolean; ranged?: boolean; range?: string; mastery?: string };
}
