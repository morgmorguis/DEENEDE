// Equipo y rasgos con efectos numéricos: armadura y escudo equipados, objetos mágicos (protección, guanteletes,
// diademas…), armas mágicas, y dotes o rasgos que cambian PG, CA o velocidad (Duro, Dureza enana, Veloz,
// estilo Defensa…). Cada efecto lleva su origen para mostrarlo en la hoja con un «+» de color.
import type { Ability, Attack, Character, OwnedItem } from '../types';
import type { ItemMods } from './itemTypes';
import { findSpecies } from './species';
import { T } from '../i18n';

const ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const mod = (n: number) => Math.floor((n - 10) / 2);
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Un efecto con su origen («Guanteletes de poder de ogro: FUE 19») */
export interface Source { id: string; label: string; value: number; text: string; item?: boolean; off?: boolean }

/** Objetos equipados que funcionan ahora: con efectos y, si requieren sintonización, sintonizados */
export function activeGear(c: Character): (OwnedItem & { mods: ItemMods })[] {
  return (c.items ?? []).filter((i): i is OwnedItem & { mods: ItemMods } => !!i.equipped && i.qty > 0 && !!i.mods && (!i.attunement || c.attunement.includes(i.name)));
}

/** Equipado pero sin efecto porque falta sintonizarlo */
export const needsAttunement = (c: Character, i: OwnedItem) => !!i.equipped && !!i.attunement && !c.attunement.includes(i.name);

const off = (c: Character, id: string) => (c.rulesOff ?? []).includes(id);
const featText = (c: Character) => fold([...c.features.map((f) => f.name), c.feats].join(' | '));

/** Puntuaciones de característica con los objetos (los que fijan un valor solo cuentan si es mayor) */
export function abilityScores(c: Character): { scores: Record<Ability, number>; sources: Record<Ability, Source[]> } {
  const scores = { ...c.abilities };
  const sources = Object.fromEntries(ABILITIES.map((a) => [a, [] as Source[]])) as Record<Ability, Source[]>;
  const gear = activeGear(c);
  for (const a of ABILITIES) {
    let best = c.abilities[a];
    let setBy: OwnedItem | undefined;
    for (const i of gear) { const v = i.mods.abilitySet?.[a]; if (v != null && v > best) { best = v; setBy = i; } }
    if (setBy) sources[a].push({ id: `item:${setBy.id}`, label: setBy.name, value: best - c.abilities[a], text: T(`${setBy.name}: tu puntuación pasa a ser ${best}`, `${setBy.name}: your score becomes ${best}`), item: true });
    for (const i of gear) {
      const v = i.mods.abilityBonus?.[a];
      if (v) { best += v; sources[a].push({ id: `item:${i.id}`, label: i.name, value: v, text: `${i.name}: ${v > 0 ? '+' : ''}${v}`, item: true }); }
    }
    scores[a] = Math.min(30, best);
  }
  return { scores, sources };
}

/** Armadura y escudo equipados */
export function wornArmor(c: Character) {
  const gear = activeGear(c);
  const armors = gear.filter((i) => i.mods.armor);
  const armor = armors.sort((a, b) => b.mods.armor!.base - a.mods.armor!.base)[0];
  const shields = gear.filter((i) => i.mods.shield);
  const shield = shields.sort((a, b) => b.mods.shield! - a.mods.shield!)[0];
  return { armor, shield, gear };
}

/** CA según el equipo y los rasgos. Devuelve la base (armadura o la de la hoja) y los añadidos con su origen */
export function acFromGear(c: Character, dexMod: number): { base: number | null; baseText: string; shield: number; extras: Source[] } {
  const { armor, shield, gear } = wornArmor(c);
  const feats = featText(c);
  let base: number | null = null;
  let baseText = '';
  if (armor) {
    const a = armor.mods.armor!;
    const mediumMaster = a.kind === 'medium' && /maestro en armaduras intermedias|medium armor master/.test(feats);
    const cap = a.dexMax == null ? Infinity : mediumMaster ? 3 : a.dexMax;
    const dex = Math.min(dexMod, cap);
    base = a.base + dex;
    baseText = a.kind === 'heavy' ? `${armor.name}: ${a.base}` : `${armor.name}: ${a.base} ${T('+ DES', '+ DEX')} ${dex >= 0 ? '+' : ''}${dex}${cap !== Infinity ? T(` (máx. ${cap})`, ` (max ${cap})`) : ''}`;
  }
  const extras: Source[] = [];
  for (const i of gear) {
    if (i.mods.ac) extras.push({ id: `item:${i.id}`, label: i.name, value: i.mods.ac, text: `${i.name}: ${i.mods.ac > 0 ? '+' : ''}${i.mods.ac}`, item: true });
    if (i.mods.acNoArmor && !armor && !shield) extras.push({ id: `item:${i.id}`, label: i.name, value: i.mods.acNoArmor, text: T(`${i.name}: +${i.mods.acNoArmor} (sin armadura ni escudo)`, `${i.name}: +${i.mods.acNoArmor} (no armor or shield)`), item: true });
  }
  // Estilo de combate Defensa: +1 con armadura
  if (armor && /(estilo de combate|fighting style)\s*:\s*(defensa|defense)/.test(feats) && !off(c, 'defense_style')) {
    extras.push({ id: 'defense_style', label: T('Estilo de combate: Defensa', 'Fighting Style: Defense'), value: 1, text: T('Defensa: +1 a la CA con armadura', 'Defense: +1 AC while wearing armor') });
  }
  return { base, baseText, shield: shield?.mods.shield ?? 0, extras };
}

/** PG máximos extra por rasgos, dotes y cambios de CON por objetos */
export function hpExtras(c: Character, withOff = false): Source[] {
  const out: Source[] = [];
  const feats = featText(c);
  const lvl = Math.max(1, c.level);
  if (/\b(duro|tough)\b/.test(feats) && (withOff || !off(c, 'tough'))) out.push({ id: 'tough', label: T('Duro (dote)', 'Tough (feat)'), value: 2 * lvl, text: T(`Duro: +2 PG por nivel (${lvl} × 2)`, `Tough: +2 HP per level (${lvl} × 2)`) });
  if (findSpecies(c.species).species?.id === 'enano' && (withOff || !off(c, 'dwarven_toughness'))) out.push({ id: 'dwarven_toughness', label: T('Dureza enana', 'Dwarven Toughness'), value: lvl, text: T(`Dureza enana: +1 PG por nivel (${lvl})`, `Dwarven Toughness: +1 HP per level (${lvl})`) });
  const { scores, sources } = abilityScores(c);
  const conDelta = mod(scores.con) - mod(c.abilities.con);
  if (conDelta) out.push({ id: sources.con[0]?.id ?? 'con', label: sources.con[0]?.label ?? 'CON', value: conDelta * lvl, text: T(`${sources.con[0]?.label ?? 'CON'}: el modificador de CON cambia ${conDelta > 0 ? '+' : ''}${conDelta} por nivel`, `${sources.con[0]?.label ?? 'CON'}: CON modifier changes ${conDelta > 0 ? '+' : ''}${conDelta} per level`), item: true });
  return out.map((x) => (off(c, x.id) && !x.item ? { ...x, off: true } : x));
}

/** Velocidad extra o reducida por dotes y equipo */
export function speedExtras(c: Character, withOff = false): Source[] {
  const out: Source[] = [];
  const feats = featText(c);
  if (/\b(veloz|speedy)\b/.test(feats) && (withOff || !off(c, 'speedy'))) out.push({ id: 'speedy', label: T('Veloz (dote)', 'Speedy (feat)'), value: 10, text: T('Veloz: +10 pies', 'Speedy: +10 ft') });
  const { armor, gear } = wornArmor(c);
  for (const i of gear) if (i.mods.speed) out.push({ id: `item:${i.id}`, label: i.name, value: i.mods.speed, text: `${i.name}: ${i.mods.speed > 0 ? '+' : ''}${i.mods.speed}`, item: true });
  const need = armor?.mods.armor?.str;
  if (need && abilityScores(c).scores.str < need) out.push({ id: `item:${armor!.id}`, label: armor!.name, value: -10, text: T(`${armor!.name}: necesitas Fuerza ${need}; −10 pies`, `${armor!.name}: requires Strength ${need}; −10 ft`), item: true });
  return out.map((x) => (off(c, x.id) && !x.item ? { ...x, off: true } : x));
}

/** Bonificadores de un ataque por su arma mágica y el estilo Tiro con arco */
export function attackExtras(c: Character, a: Attack): { attack: Source[]; damage: Source[] } {
  const attack: Source[] = [];
  const damage: Source[] = [];
  for (const i of activeGear(c)) {
    if (i.id !== a.itemId && i.attackId !== a.id) continue;
    if (i.mods.attack) attack.push({ id: `item:${i.id}`, label: i.name, value: i.mods.attack, text: `${i.name}: +${i.mods.attack}`, item: true });
    if (i.mods.damage) damage.push({ id: `item:${i.id}`, label: i.name, value: i.mods.damage, text: `${i.name}: +${i.mods.damage}`, item: true });
  }
  const linked = c.items?.find((i) => i.id === a.itemId);
  const ranged = linked?.mods?.weapon ? !!linked.mods.weapon.ranged : /^\s*(80|100|120|150)\s*\//.test(a.range);
  if (ranged && /(estilo de combate|fighting style)\s*:\s*(tiro con arco|archery)/.test(featText(c)) && !off(c, 'archery_style')) attack.push({ id: 'archery_style', label: T('Tiro con arco', 'Archery'), value: 2, text: T('Estilo Tiro con arco: +2 a los ataques a distancia', 'Archery style: +2 to ranged attacks') });
  return { attack, damage };
}

/** Fila de ataque para un arma equipada */
export function attackFromItem(c: Character, i: OwnedItem): Attack | null {
  const w = i.mods?.weapon;
  if (!w) return null;
  const { scores } = abilityScores(c);
  const ability: Ability = w.ranged ? 'dex' : w.finesse && scores.dex > scores.str ? 'dex' : 'str';
  return { id: `atk-${i.id}`, name: i.name, ability, proficient: true, damage: w.dice, damageType: w.type as Attack['damageType'], range: w.range ?? T('5 pies', '5 ft'), extraBonus: 0, mastery: w.mastery, itemId: i.id };
}

/** Clases de armadura con las que el personaje tiene entrenamiento */
export function armorTrained(c: Character, kind: 'light' | 'medium' | 'heavy') {
  return !!c.armorTraining?.[kind];
}

