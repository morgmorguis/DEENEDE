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
}

export interface Coins5 { cp: number; sp: number; ep: number; gp: number; pp: number }
