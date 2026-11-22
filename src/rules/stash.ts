// Dónde va en la ficha lo que te dan (el DM o un compañero): munición y consumibles a su lista, y armas, armaduras y
// escudos reconocidos por el nombre (aunque el DM los escriba a mano) con sus efectos al equipar.
import type { Consumable } from '../types';
import type { ItemData, ItemMods } from './itemTypes';
import { CATALOG_MODS, ITEM_CATALOG } from './items';
import { WEAPONS } from './weapons';

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/** Munición (reglas 2024: se recupera la mitad tras el combate) */
const AMMO = /\b(flechas?|arrows?|virotes?|bolts?|balas?|bullets?|agujas?|needles?|municion(es)?|ammunition|ammo)\b/;
/** Consumibles que se gastan (pociones, fuego de alquimista, agua bendita, antorchas, raciones, antitoxina) */
const SPENT = /\b(pocion(es)?|potions?|elixir(es)?|fuegos? de alquimista|alchemist'?s? fire|aguas? benditas?|holy water|antorchas?|torch(es)?|raciones?|rations?|antitoxinas?|antitoxins?)\b/;

/** Cantidad escrita en el nombre: «20 flechas», «Flechas (20)», «Munición +1 (10)» */
function countInName(name: string): { n: number; rest: string } {
  const lead = name.match(/^\s*(\d+)\s*(?:x|×)?\s+(.+)$/i);
  if (lead) return { n: Number(lead[1]), rest: lead[2] };
  const tail = name.match(/^(.+?)\s*\((\d+)\)\s*$/);
  if (tail) return { n: Number(tail[2]), rest: tail[1] };
  return { n: 1, rest: name };
}

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Qué consumible es (o null si no lo es) */
export function consumableKind(i: Pick<ItemData, 'name' | 'type' | 'consumable'>): Consumable['kind'] | null {
  if (i.consumable) return i.consumable;
  if (i.type === 'potion') return 'item';
  // Varitas, pergaminos, anillos y objetos maravillosos se quedan en «Objetos» (la «varita de rayo» no es munición)
  if (['wand', 'scroll', 'ring', 'wondrous', 'armor'].includes(i.type)) return null;
  const f = fold(i.name);
  // «Arco largo», «Ballesta» o «Carcaj» no son munición, aunque lleven flechas en el texto
  if (i.type === 'weapon' && !AMMO.test(f)) return null;
  if (AMMO.test(f) && !/\b(carcaj|quiver|estuche|case)\b/.test(f)) return 'ammo';
  if (SPENT.test(f)) return 'item';
  return null;
}

type Match = { len: number; type: 'weapon' | 'armor'; mods: ItemMods };

/** Arma, armadura o escudo por el nombre («Cota de mallas», «Espada larga +1», «Longbow») */
export function gearByName(name: string): { type: 'weapon' | 'armor'; mods: ItemMods } | null {
  const f = ` ${fold(name)} `;
  let best: Match | null = null;
  const consider = (names: string[], m: Omit<Match, 'len'>) => {
    for (const n of names) {
      const k = fold(n);
      if (k && f.includes(` ${k} `) && (!best || k.length > best.len)) best = { len: k.length, ...m };
    }
  };
  for (const x of ITEM_CATALOG) {
    const mods = CATALOG_MODS[x.id];
    if (mods && (mods.armor || mods.shield) && x.rarity === 'mundane') consider([x.name.es, x.name.en], { type: 'armor', mods });
  }
  for (const w of WEAPONS) {
    if (!/^\d*d\d+$/.test(w.damage)) continue;
    const props = w.props;
    consider([w.name.es, w.name.en], {
      type: 'weapon',
      mods: { weapon: { dice: w.damage, type: w.type.es, mastery: w.mastery, ...(props.includes('finesse') ? { finesse: true } : {}), ...(w.kind === 'ranged' ? { ranged: true } : {}), ...(w.range ? { range: w.range } : {}) } },
    });
  }
  const b = best as Match | null;
  return b ? { type: b.type, mods: structuredClone(b.mods) } : null;
}

/** El sitio de la ficha donde acaba un objeto recibido */
export type Placement =
  | { where: 'consumable'; kind: Consumable['kind']; name: string; qty: number; description?: string }
  | { where: 'item'; item: ItemData };

export function placeReceived(i: ItemData): Placement {
  const kind = consumableKind(i);
  if (kind) {
    const { n, rest } = countInName(i.name);
    return { where: 'consumable', kind, name: cap(rest.trim()), qty: Math.max(1, i.qty) * n, ...(i.description ? { description: i.description } : {}) };
  }
  if (i.mods) return { where: 'item', item: i };
  const g = gearByName(i.name);
  if (!g) return { where: 'item', item: i };
  // Un «+1» en el nombre suma al ataque y al daño (armas) o a la CA (armaduras)
  const plus = Number(i.name.match(/\+([1-3])\b/)?.[1] ?? 0);
  const mods: ItemMods = { ...g.mods, ...(plus ? (g.type === 'weapon' ? { attack: plus, damage: plus } : g.mods.shield ? { shield: (g.mods.shield ?? 2) + plus } : { ac: plus }) : {}) };
  return { where: 'item', item: { ...i, type: g.type, mods } };
}

/** Lo que se puede equipar nada más recibirlo (pone CA o crea su fila de Armas) */
export const wearable = (i: Pick<ItemData, 'mods'>) => !!(i.mods?.armor || i.mods?.shield || i.mods?.weapon);
