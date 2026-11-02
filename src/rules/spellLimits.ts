// Cuántos trucos y conjuros preparados puede tener un personaje (tablas de clase de 2024) y cuántas
// veces puede lanzar cada conjuro (a voluntad, espacios de conjuro, una vez por descanso…).
import type { Character, Spell } from '../types';
import { L, T } from '../i18n';
import { classLevels } from './multiclass';
import { findSpecies } from './species';
import { findSpell } from './spells';

const THIRD = /arcane trickster|eldritch knight|embaucador arcano|caballero arcano/i;
const by20 = (...a: number[]) => a;

/** Trucos conocidos por nivel de clase (índice = nivel - 1) */
const CANTRIPS: Record<string, number[]> = {
  bardo: by20(2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4),
  clerigo: by20(3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5),
  druida: by20(2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4),
  hechicero: by20(4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6),
  brujo: by20(2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4),
  mago: by20(3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5),
};
/** Conjuros preparados por nivel de clase */
const PREPARED: Record<string, number[]> = {
  bardo: by20(4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22),
  clerigo: by20(4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22),
  druida: by20(4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22),
  paladin: by20(2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15),
  explorador: by20(2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15),
  hechicero: by20(2, 4, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22),
  brujo: by20(2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15),
  mago: by20(4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 18, 19, 21, 22, 23, 24, 25),
};
/** Caballero arcano y embaucador arcano (desde nivel 3 de guerrero o pícaro) */
const THIRD_PREPARED = by20(0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13);

export interface SpellLimits {
  cantrips: number;
  prepared: number;
  /** Desglose por clase («Mago 3: 3 trucos, 6 preparados») */
  parts: string[];
  caster: boolean;
}

export function spellLimits(c: Character): SpellLimits {
  let cantrips = 0; let prepared = 0; const parts: string[] = [];
  const feats = c.features.map((f) => f.name).join(' | ');
  for (const e of classLevels(c)) {
    const i = Math.min(20, Math.max(1, e.level)) - 1;
    let ct = CANTRIPS[e.cls.id]?.[i] ?? 0;
    let pr = PREPARED[e.cls.id]?.[i] ?? 0;
    if (THIRD.test(e.subclass)) {
      const arcaneTrickster = /arcane trickster|embaucador/i.test(e.subclass);
      ct = e.level >= 10 ? (arcaneTrickster ? 4 : 3) : e.level >= 3 ? (arcaneTrickster ? 3 : 2) : 0;
      pr = THIRD_PREPARED[i];
    }
    // Opciones que dan trucos extra
    if (e.cls.id === 'clerigo' && /taumaturg|thaumaturg/i.test(feats)) ct += 1;
    if (e.cls.id === 'druida' && /(orden primigenia|primal order):\s*(mago|magician)/i.test(feats)) ct += 1;
    if ((e.cls.id === 'paladin' || e.cls.id === 'explorador') && /guerrero bendito|blessed warrior|guerrero druídico|druidic warrior/i.test(feats)) ct += 2;
    if (ct || pr) parts.push(T(`${L(e.cls.name)} ${e.level}: ${ct} trucos, ${pr} preparados`, `${L(e.cls.name)} ${e.level}: ${ct} cantrips, ${pr} prepared`));
    cantrips += ct; prepared += pr;
  }
  return { cantrips, prepared, parts, caster: cantrips + prepared > 0 };
}

/** Nombres (en inglés) de los conjuros que da la especie o el linaje */
export function speciesSpellNames(c: Character): Set<string> {
  const { species, lineage } = findSpecies(c.species);
  return new Set([...(species?.spells ?? []), ...(lineage?.spells ?? [])]);
}

/** El conjuro no cuenta para el límite (lo da la especie o un rasgo lo deja siempre preparado) */
export function isFreeSpell(c: Character, s: Spell, species = speciesSpellNames(c)) {
  if (s.alwaysPrepared) return true;
  const en = findSpell(s.name)?.name.en;
  return !!en && species.has(en);
}

export function spellCounts(c: Character) {
  const species = speciesSpellNames(c);
  let cantrips = 0; let prepared = 0;
  for (const s of c.spells) {
    if (!s.name || isFreeSpell(c, s, species)) continue;
    if (s.level === 0) cantrips++; else prepared++;
  }
  return { cantrips, prepared };
}

export interface SpellUse { icon: string; text: string; warn?: boolean }

/** Cuántas veces se puede lanzar y cuándo se recupera */
export function spellUse(c: Character, s: Spell): SpellUse {
  const fromSpecies = (() => { const en = findSpell(s.name)?.name.en; return !!en && speciesSpellNames(c).has(en); })();
  if (s.level === 0) return { icon: '♾️', text: T('Truco: a voluntad, sin gastar nada', 'Cantrip: at will, costs nothing') };
  if (fromSpecies) return { icon: '1×🌙', text: T('De tu especie: una vez sin gastar espacio; vuelve tras un descanso largo (o gastando un espacio)', 'From your species: once without a slot; returns after a Long Rest (or by spending a slot)') };
  const ritual = s.ritual ? T(' · también como ritual (+10 min, sin espacio)', ' · also as a ritual (+10 min, no slot)') : '';
  const slot = c.slots[s.level - 1];
  const pact = c.pactSlots && c.pactSlots.max > 0 && c.pactSlots.level >= s.level ? c.pactSlots : null;
  if (slot && slot.max > 0) {
    const left = slot.max - slot.used;
    return { icon: `✨${left}/${slot.max}🌙`, text: T(`Gasta un espacio de nivel ${s.level} (o superior): te quedan ${left} de ${slot.max}; vuelven tras un descanso largo${ritual}`, `Uses a level ${s.level}+ slot: ${left} of ${slot.max} left; they return after a Long Rest${ritual}`), warn: left === 0 };
  }
  if (pact) {
    const left = pact.max - pact.used;
    return { icon: `✨${left}/${pact.max}⛺`, text: T(`Gasta un espacio de pacto (nivel ${pact.level}): te quedan ${left} de ${pact.max}; vuelven tras un descanso corto${ritual}`, `Uses a pact slot (level ${pact.level}): ${left} of ${pact.max} left; they return after a Short Rest${ritual}`), warn: left === 0 };
  }
  // Puede lanzarse con un espacio de nivel superior
  const higher = c.slots.findIndex((x, i) => i >= s.level && x.max - x.used > 0);
  if (higher >= 0) return { icon: `✨↑🌙`, text: T(`No tienes espacios de nivel ${s.level}; puedes usar uno de nivel ${higher + 1}${ritual}`, `No level ${s.level} slots; you can use a level ${higher + 1} one${ritual}`) };
  if (s.ritual) return { icon: '📖R', text: T('Solo como ritual (+10 minutos, sin gastar espacio)', 'Only as a ritual (+10 minutes, no slot)') };
  return { icon: '✨0', text: T(`Aún no tienes espacios de nivel ${s.level}`, `You don’t have level ${s.level} slots yet`), warn: true };
}
