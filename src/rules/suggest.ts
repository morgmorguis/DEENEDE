// Texto predictivo al escribir a mano un conjuro o un rasgo: solo propone lo que el personaje puede
// tener ahora según sus clases (y multiclase), nivel, subclase, especie y linaje.
import type { Character, Recharge } from '../types';
import { L, T, type Tr } from '../i18n';
import { SPELLS, findSpell, type SpellInfo } from './spells';
import { FEATS, FIGHTING_STYLES, INVOCATIONS, METAMAGIC, SUBCLASSES, inClassList, levelEntry, rechargeOf } from './progression';
import { classLevels, spellSlotsFor } from './multiclass';
import { SPECIES_INFO, findSpecies } from './species';

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, "'").trim();
const matches = (q: string, names: string[]) => {
  const k = fold(q);
  return names.some((n) => fold(n).includes(k));
};
const score = (q: string, names: string[]) => {
  const k = fold(q);
  return names.some((n) => fold(n).startsWith(k)) ? 0 : names.some((n) => fold(n).split(/\s+/).some((w) => w.startsWith(k))) ? 1 : 2;
};

const THIRD = /arcane trickster|eldritch knight|embaucador arcano|caballero arcano/i;

export interface SpellSuggestion { spell: SpellInfo; why: string }

/** Conjuros que el personaje podría tener: de la lista de sus clases y de nivel que pueda lanzar */
export function spellSuggestions(c: Character, query: string, limit = 8): SpellSuggestion[] {
  if (fold(query).length < 2) return [];
  const entries = classLevels(c);
  const { slots, pact } = spellSlotsFor(c);
  const maxLevel = Math.max(slots.length, pact?.level ?? 0, c.slots.reduce((m, s, i) => (s.max > 0 ? i + 1 : m), 0), c.pactSlots?.max ? c.pactSlots.level : 0);
  // Listas: las de sus clases; los tercio-lanzadores usan la de mago
  const lists = entries.map((e) => ({ id: THIRD.test(e.subclass) ? 'mago' : e.cls.id, name: L(e.cls.name) }));
  const { species, lineage } = findSpecies(c.species);
  const speciesSpells = [...(species?.spells ?? []), ...(lineage?.spells ?? [])];
  const known = new Set(c.spells.map((s) => findSpell(s.name)?.name.en).filter(Boolean));
  const out: SpellSuggestion[] = [];
  for (const sp of SPELLS) {
    if (known.has(sp.name.en) || !matches(query, [sp.name.es, sp.name.en])) continue;
    if (speciesSpells.includes(sp.name.en)) { out.push({ spell: sp, why: species ? L(species.name) : '' }); continue; }
    const from = lists.find((l) => inClassList(sp.name.en, l.id));
    if (!from) continue;
    if (sp.level > 0 && sp.level > maxLevel) continue;
    out.push({ spell: sp, why: from.name });
  }
  return out.sort((a, b) => score(query, [a.spell.name.es, a.spell.name.en]) - score(query, [b.spell.name.es, b.spell.name.en]) || a.spell.level - b.spell.level).slice(0, limit);
}

export interface FeatureSuggestion { name: string; text: string; recharge?: Recharge; why: string }

/** Rasgos que el personaje podría tener: de sus clases hasta su nivel, subclase, especie, linaje y dotes */
export function featureSuggestions(c: Character, query: string, limit = 8): FeatureSuggestion[] {
  if (fold(query).length < 2) return [];
  const have = new Set(c.features.map((f) => fold(f.name)));
  const pool: FeatureSuggestion[] = [];
  const add = (name: Tr, text: Tr, why: string, prefix?: Tr) => {
    const n = prefix ? `${L(prefix)}: ${L(name)}` : L(name);
    if (!have.has(fold(n)) && !pool.some((p) => p.name === n) && matches(query, [name.es, name.en, n])) pool.push({ name: n, text: L(text), recharge: rechargeOf(name.en), why });
  };
  const generic = ['Subclass', 'Subclass feature', 'Ability Score Improvement', 'Epic Boon', 'Fighting Style'];
  for (const e of classLevels(c)) {
    const why = `${L(e.cls.name)} ${e.level}`;
    for (const f of e.cls.features(e.level)) add(f.name, f.text, why);
    for (let lv = 1; lv <= e.level; lv++) {
      const entry = levelEntry(e.cls.id, lv);
      for (const g of entry.features) if (!generic.includes(g.name.en) && !g.subclass) add(g.name, g.text, why);
      for (const ch of entry.choices) {
        if (ch.kind === 'fightingStyle') for (const o of FIGHTING_STYLES) add(o.name, o.text, why, { es: 'Estilo de combate', en: 'Fighting Style' });
        if (ch.kind === 'metamagic') for (const o of METAMAGIC) add(o.name, o.text, why, { es: 'Metamagia', en: 'Metamagic' });
        if (ch.kind === 'invocation') for (const o of INVOCATIONS.filter((x) => (x.minLevel ?? 1) <= e.level)) add(o.name, o.text, why, { es: 'Invocación', en: 'Invocation' });
        if (ch.kind === 'option') for (const o of ch.options) add(o.name, o.text, why, ch.title);
      }
    }
    if (e.cls.id === 'guerrero') for (const o of FIGHTING_STYLES) add(o.name, o.text, why, { es: 'Estilo de combate', en: 'Fighting Style' });
    if (e.cls.id === 'brujo') for (const o of INVOCATIONS.filter((x) => (x.minLevel ?? 1) <= e.level)) add(o.name, o.text, why, { es: 'Invocación', en: 'Invocation' });
    // Subclases que puede elegir (desde nivel 3)
    if (e.level >= 3) for (const o of SUBCLASSES[e.cls.id] ?? []) if (!e.subclass || [o.name.es, o.name.en].includes(e.subclass)) add(o.name, o.text, why);
  }
  const { species, lineage } = findSpecies(c.species);
  const sp = species ?? SPECIES_INFO.find((x) => x.id === c.lineage);
  if (sp) for (const t of [...sp.traits, ...(lineage?.traits ?? [])]) add(t.name, t.text, L(sp.name));
  if (c.level >= 4) for (const o of FEATS) add(o.name, o.text, T('Dote', 'Feat'));
  return pool.sort((a, b) => score(query, [a.name]) - score(query, [b.name])).slice(0, limit);
}
