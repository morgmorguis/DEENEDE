// Aplica una subida de nivel con las elecciones del jugador: PG, rasgos nuevos, subclase, mejoras de
// característica o dotes, estilos, pericias, metamagia, invocaciones y conjuros nuevos.
import type { Ability, Character, ProfLevel } from '../types';
import { L, T } from '../i18n';
import { RESOURCE_NAMES, classById, pactSlotsFor, slotsFor } from './srd';
import { abilityMods, mod } from './calc';
import { uid } from './factory';
import { BOONS, FEATS, FIGHTING_STYLES, INVOCATIONS, METAMAGIC, SUBCLASSES, levelEntry, spellCounts, type Option } from './progression';
import { SPELLS, findSpell } from './spells';

export type AsiChoice =
  | { mode: 'asi'; plus: Partial<Record<Ability, number>> }
  | { mode: 'feat'; featId: string; ability: Ability | null };

export interface LevelUpChoices {
  /** PG ganados con el dado (o la media), ya con el modificador de CON actual */
  hpGain: number;
  subclass?: string;
  asi?: AsiChoice;
  boon?: { id: string; ability: Ability | null };
  fightingStyle?: string;
  expertise?: string[];
  metamagic?: string[];
  invocations?: string[];
  options?: Record<string, string>;
  /** Nombres en inglés de conjuros de la base de datos que se añaden */
  spells?: string[];
}

/** Media fija de PG por nivel: mitad del dado + 1 */
export const averageHitDie = (hitDie: number) => hitDie / 2 + 1;

/** Nivel máximo de conjuro que se puede lanzar a un nivel de clase */
export function maxSpellLevel(classId: string, level: number) {
  const cls = classById(classId);
  if (!cls || cls.caster === 'none') return 0;
  if (cls.caster === 'pact') return pactSlotsFor(level).level;
  return slotsFor(cls.caster, level).length;
}

/** Conjuros nuevos que puedes añadir al subir: diferencia de trucos y de preparados entre niveles */
export function newSpellAllowance(classId: string, from: number) {
  const a = spellCounts(classId, from);
  const b = spellCounts(classId, from + 1);
  if (!a || !b) return { cantrips: 0, spells: 0, maxLevel: 0 };
  return { cantrips: Math.max(0, b.cantrips - a.cantrips), spells: Math.max(0, b.prepared - a.prepared), maxLevel: maxSpellLevel(classId, from + 1) };
}

const addFeature = (c: Character, name: string, text: string) => {
  const existing = c.features.find((f) => f.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (existing) existing.text = text;
  else c.features.push({ id: uid(), name, text });
};
const pick = (list: Option[], id?: string) => (id ? list.find((x) => x.id === id) : undefined);
const raise = (c: Character, a: Ability, n: number, cap: number) => { c.abilities[a] = Math.min(cap, c.abilities[a] + n); };

export function applyLevelUp(c: Character, ch: LevelUpChoices): Character {
  const cls = classById(c.classId);
  const next = structuredClone(c);
  const level = Math.min(20, c.level + 1);
  next.level = level;
  const oldCon = mod(c.abilities.con);

  // Características (antes de calcular PG y recursos)
  if (ch.asi?.mode === 'asi') for (const [a, n] of Object.entries(ch.asi.plus)) raise(next, a as Ability, n ?? 0, 20);
  const feat = ch.asi?.mode === 'feat' ? pick(FEATS, ch.asi.featId) : undefined;
  if (feat && ch.asi?.mode === 'feat' && ch.asi.ability) {
    raise(next, ch.asi.ability, 1, 20);
    if (feat.saveProf && !next.saveProf.includes(ch.asi.ability)) next.saveProf.push(ch.asi.ability);
  }
  const boon = pick(BOONS, ch.boon?.id);
  if (boon && ch.boon?.ability) raise(next, ch.boon.ability, 1, 30);
  if (cls?.id === 'barbaro' && level === 20) { raise(next, 'str', 4, 25); raise(next, 'con', 4, 25); }
  if (cls?.id === 'monje' && level === 20) { raise(next, 'dex', 4, 25); raise(next, 'wis', 4, 25); }

  // PG: el dado de este nivel + lo que suba la CON en todos los niveles
  const conDelta = mod(next.abilities.con) - oldCon;
  const hpUp = Math.max(1, ch.hpGain) + conDelta * level + (boon?.id === 'fortitude' ? 40 : 0);
  next.hp.max = Math.max(1, c.hp.max + hpUp);
  next.hp.current = Math.max(0, Math.min(next.hp.max, c.hp.current + hpUp));

  if (cls) {
    // Espacios de conjuro y recursos de clase
    const slots = slotsFor(cls.caster, level);
    if (cls.caster === 'pact') next.pactSlots = { ...pactSlotsFor(level), used: Math.min(c.pactSlots?.used ?? 0, pactSlotsFor(level).max) };
    else if (cls.caster !== 'none') next.slots = slots.map((n, i) => ({ max: n, used: Math.min(n, c.slots[i]?.used ?? 0) }));
    const defs = cls.resources(level, abilityMods(next));
    next.resources = [
      ...defs.map((r) => {
        const prev = c.resources.find((x) => x.key === r.key);
        return { id: prev?.id ?? uid(), key: r.key, name: L(RESOURCE_NAMES[r.key]), max: r.max, used: Math.min(r.max, prev?.used ?? 0), recovers: r.recovers };
      }),
      ...c.resources.filter((x) => !defs.some((r) => r.key === x.key)),
    ];

    // Textos que escalan con el nivel (dado de Inspiración, Ataque furtivo…)
    for (const f of cls.features(level)) {
      const ex = next.features.find((x) => x.name === f.name.es || x.name === f.name.en);
      if (ex) ex.text = L(f.text);
    }

    // Subclase
    const sub = pick(SUBCLASSES[cls.id] ?? [], ch.subclass);
    if (sub) {
      next.subclass = L(sub.name);
      addFeature(next, L(sub.name), L(sub.text));
    }

    // Rasgos nuevos del nivel
    const entry = levelEntry(cls.id, level);
    for (const gain of entry.features) {
      if (['Subclass', 'Ability Score Improvement', 'Epic Boon'].includes(gain.name.en)) continue;
      if (gain.subclass) {
        const name = next.subclass ? `${next.subclass} (${T('nivel', 'level')} ${level})` : `${L(gain.name)} (${T('nivel', 'level')} ${level})`;
        addFeature(next, name, L(gain.text));
      } else addFeature(next, L(gain.name), L(gain.text));
    }
    for (const choice of entry.choices) {
      if (choice.kind !== 'option') continue;
      const opt = pick(choice.options, ch.options?.[choice.id]);
      if (opt) addFeature(next, `${L(choice.title)}: ${L(opt.name)}`, L(opt.text));
    }
  }

  if (feat) next.feats = [next.feats.trim(), `${L(feat.name)}: ${L(feat.text)}`].filter(Boolean).join('\n');
  if (boon) next.feats = [next.feats.trim(), `${L(boon.name)}: ${L(boon.text)}`].filter(Boolean).join('\n');
  const style = pick(FIGHTING_STYLES, ch.fightingStyle);
  if (style) addFeature(next, `${T('Estilo de combate', 'Fighting Style')}: ${L(style.name)}`, L(style.text));
  for (const id of ch.expertise ?? []) next.skillProf[id] = 2 as ProfLevel;
  for (const id of ch.metamagic ?? []) { const m = pick(METAMAGIC, id); if (m) addFeature(next, `${T('Metamagia', 'Metamagic')}: ${L(m.name)}`, L(m.text)); }
  for (const id of ch.invocations ?? []) { const m = pick(INVOCATIONS, id); if (m) addFeature(next, `${T('Invocación', 'Invocation')}: ${L(m.name)}`, L(m.text)); }

  for (const en of ch.spells ?? []) {
    const info = SPELLS.find((s) => s.name.en === en);
    if (!info || next.spells.some((s) => findSpell(s.name) === info)) continue;
    next.spells.push({
      id: uid(), name: L(info.name), level: info.level, prepared: true, castingTime: L(info.time), range: L(info.range),
      concentration: info.concentration, ritual: info.ritual, material: info.components.includes('M'),
    });
  }
  return next;
}
