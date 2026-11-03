// Rasgos y conjuros que encajan con la clase del personaje: límites de lo que se elige (estilos de combate,
// metamagia, invocaciones, opciones de clase, subclase, dotes) y limpieza al cambiar de clase.
import type { Character } from '../types';
import { L, T, type Tr } from '../i18n';
import { CLASSES } from './srd';
import { classLevels } from './multiclass';
import { levelEntry } from './progression';
import { featureSuggestions, spellSuggestions, type FeatureGroup } from './suggest';
import { findSpell } from './spells';
import { findSpecies } from './species';

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();

export interface FeatureLimit { group: FeatureGroup; label: string; max: number; have: number }

/** Grupo al que pertenece cada rasgo que el personaje podría tener ahora */
function groupsFor(c: Character): Map<string, FeatureGroup> {
  const m = new Map<string, FeatureGroup>();
  for (const f of featureSuggestions({ ...c, features: [] }, '', 0, true)) m.set(fold(f.name), f.group);
  return m;
}

/** Cuántos rasgos de cada grupo puedes tener según clases, nivel y especie, y cuántos tienes */
export function featureLimits(c: Character): FeatureLimit[] {
  const max = new Map<FeatureGroup, number>();
  const labels = new Map<FeatureGroup, string>();
  const inc = (g: FeatureGroup, n: number, label: Tr) => { max.set(g, (max.get(g) ?? 0) + n); labels.set(g, L(label)); };
  let asi = 0; let boon = 0;
  for (const e of classLevels(c)) {
    for (let lv = 1; lv <= e.level; lv++) {
      for (const ch of levelEntry(e.cls.id, lv).choices) {
        if (ch.kind === 'fightingStyle') inc('style', 1, { es: 'Estilo de combate', en: 'Fighting Style' });
        if (ch.kind === 'metamagic') inc('metamagic', ch.count, { es: 'Metamagia', en: 'Metamagic' });
        if (ch.kind === 'invocation') inc('invocation', ch.count, { es: 'Invocaciones', en: 'Invocations' });
        if (ch.kind === 'option') inc(`option:${ch.id}`, 1, ch.title);
        if (ch.kind === 'asi') asi++;
        if (ch.kind === 'boon') boon++;
      }
    }
    // El guerrero elige estilo de combate a nivel 1 (viene en sus rasgos de clase, no como elección)
    if (e.cls.id === 'guerrero' && !levelEntry('guerrero', 1).choices.some((ch) => ch.kind === 'fightingStyle')) inc('style', 1, { es: 'Estilo de combate', en: 'Fighting Style' });
    if (e.level >= 3) inc('subclass', 1, { es: 'Subclase', en: 'Subclass' });
  }
  // Dotes: la de origen del trasfondo, una por cada mejora de característica, el don épico y la del humano
  const human = findSpecies(c.species).species?.id === 'humano';
  const featMax = 1 + asi + boon + (human ? 1 : 0);
  inc('feat', featMax, { es: 'Dotes', en: 'Feats' });

  const groups = groupsFor(c);
  const have = new Map<FeatureGroup, number>();
  for (const f of c.features) { const g = groups.get(fold(f.name)); if (g) have.set(g, (have.get(g) ?? 0) + 1); }
  // Las dotes escritas en el recuadro «Dotes» también cuentan (una por línea)
  const featLines = c.feats.split(/\n|;/).map((x) => x.trim()).filter(Boolean).length;
  have.set('feat', (have.get('feat') ?? 0) + featLines);
  // La subclase elegida en la cabecera de la hoja cuenta como elegida
  have.set('subclass', Math.max(have.get('subclass') ?? 0, classLevels(c).filter((e) => e.level >= 3 && e.subclass).length));
  return [...max.entries()].map(([g, n]) => ({ group: g, label: labels.get(g) ?? g, max: n, have: have.get(g) ?? 0 }));
}

/** ¿Se puede añadir otro rasgo de este grupo? */
export function groupFull(limits: FeatureLimit[], g: FeatureGroup) {
  if (g === 'class' || g === 'species') return false;
  const l = limits.find((x) => x.group === g);
  return !l || l.have >= l.max;
}

/** Nombres de todos los rasgos que puede dar alguna clase (para saber cuáles son «de clase») */
let classFeatureKeys: Set<string> | null = null;
function allClassFeatureKeys(base: Character) {
  if (classFeatureKeys) return classFeatureKeys;
  const keys = new Set<string>();
  for (const cls of CLASSES) {
    const dummy: Character = { ...base, classId: cls.id, level: 20, multiclass: [], subclass: '', features: [], species: '', lineage: undefined };
    for (const f of featureSuggestions(dummy, '', 0, true)) if (f.group !== 'feat' && f.group !== 'species') keys.add(fold(f.name));
    for (const f of cls.features(20)) { keys.add(fold(f.name.es)); keys.add(fold(f.name.en)); }
  }
  classFeatureKeys = keys;
  return keys;
}

/** Quita los rasgos y conjuros de clase que el personaje ya no puede tener (p. ej. al cambiar de clase).
 *  Lo escrito a mano que la app no reconoce se conserva. */
export function pruneForClass(c: Character): { next: Character; removedFeatures: string[]; removedSpells: string[] } {
  const next = structuredClone(c);
  const known = allClassFeatureKeys(c);
  const allowed = new Set([...featureSuggestions({ ...c, features: [] }, '', 0, true).map((f) => fold(f.name)), ...classLevels(c).flatMap((e) => e.cls.features(e.level).flatMap((f) => [fold(f.name.es), fold(f.name.en)]))]);
  const removedFeatures: string[] = [];
  next.features = c.features.filter((f) => {
    const k = fold(f.name);
    if (!known.has(k) || allowed.has(k)) return true;
    removedFeatures.push(f.name);
    return false;
  });
  // Conjuros: los de la base que no están en las listas de tus clases (ni de tu especie) se quitan
  const ok = new Set(spellSuggestions({ ...c, spells: [] }, '', 0, true, true).map((x) => x.spell.name.en));
  const removedSpells: string[] = [];
  next.spells = c.spells.filter((s) => {
    const info = findSpell(s.name);
    if (!info || s.alwaysPrepared || ok.has(info.name.en)) return true;
    removedSpells.push(s.name);
    return false;
  });
  return { next, removedFeatures, removedSpells };
}

/** Lo que había antes y ya no está (para avisar de todo lo quitado al cambiar de clase) */
export function removedBetween(before: Character, after: Character) {
  return {
    removedFeatures: before.features.filter((f) => !after.features.some((x) => x.name === f.name)).map((f) => f.name).filter(Boolean),
    removedSpells: before.spells.filter((s) => !after.spells.some((x) => x.name === s.name)).map((s) => s.name).filter(Boolean),
  };
}

export const pruneSummary = (r: { removedFeatures: string[]; removedSpells: string[] }) => [
  ...(r.removedFeatures.length ? [T(`Rasgos quitados: ${r.removedFeatures.join(', ')}`, `Features removed: ${r.removedFeatures.join(', ')}`)] : []),
  ...(r.removedSpells.length ? [T(`Conjuros quitados: ${r.removedSpells.join(', ')}`, `Spells removed: ${r.removedSpells.join(', ')}`)] : []),
];
