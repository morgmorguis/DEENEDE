// Aplica una subida de nivel con las elecciones del jugador: PG, rasgos nuevos, subclase, mejoras de
// característica o dotes, estilos, pericias, metamagia, invocaciones y conjuros nuevos.
import type { Ability, Character, ProfLevel, Recharge } from '../types';
import { L, T } from '../i18n';
import { RESOURCE_NAMES, abilityShort, classById, pactSlotsFor, skillName, slotsFor } from './srd';
import { abilityMods, armorClass, fmt as fmtSigned, mod, passivePerception, profBonus as profBonusOf, speed, spellSaveDc } from './calc';
import { uid } from './factory';
import { BOONS, FEATS, FIGHTING_STYLES, GAIN_SPELLS, INVOCATIONS, METAMAGIC, SUBCLASSES, levelEntry, rechargeOf, spellCounts, type Option } from './progression';
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

const ABILITY_IDS: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

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

const addFeature = (c: Character, name: string, text: string, recharge?: Recharge) => {
  const existing = c.features.find((f) => f.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (existing) Object.assign(existing, { text }, recharge ? { recharge } : {});
  else c.features.push({ id: uid(), name, text, ...(recharge ? { recharge } : {}) });
};

/** Añade un conjuro de la base de datos a la ficha (si no lo tiene ya) */
export function addDbSpell(c: Character, en: string, alwaysPrepared = false) {
  const info = SPELLS.find((s) => s.name.en === en);
  if (!info || c.spells.some((s) => findSpell(s.name) === info)) return;
  c.spells.push({
    id: uid(), name: L(info.name), level: info.level, prepared: true, castingTime: L(info.time), range: L(info.range),
    concentration: info.concentration, ritual: info.ritual, material: info.components.includes('M'), components: info.components,
    ...(alwaysPrepared ? { alwaysPrepared: true } : {}),
  });
}
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
      // Lo genérico que se concreta con una elección (subclase, mejora, don, estilo) se añade ya elegido
      if (['Subclass', 'Ability Score Improvement', 'Epic Boon', 'Fighting Style'].includes(gain.name.en)) continue;
      if (gain.subclass) {
        const name = next.subclass ? `${next.subclass} (${T('nivel', 'level')} ${level})` : `${L(gain.name)} (${T('nivel', 'level')} ${level})`;
        addFeature(next, name, L(gain.text));
      } else addFeature(next, L(gain.name), L(gain.text), rechargeOf(gain.name.en));
      for (const en of GAIN_SPELLS[gain.name.en] ?? []) addDbSpell(next, en, true);
    }
    for (const choice of entry.choices) {
      if (choice.kind !== 'option') continue;
      const opt = pick(choice.options, ch.options?.[choice.id]);
      if (opt) addFeature(next, `${L(choice.title)}: ${L(opt.name)}`, L(opt.text));
    }
  }

  // Rasgos que dan competencia en salvaciones
  if (cls?.id === 'picaro' && level === 15) for (const a of ['wis', 'cha'] as Ability[]) if (!next.saveProf.includes(a)) next.saveProf.push(a);
  if (cls?.id === 'monje' && level === 14) next.saveProf = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

  if (feat) next.feats = [next.feats.trim(), `${L(feat.name)}: ${L(feat.text)}`].filter(Boolean).join('\n');
  if (boon) next.feats = [next.feats.trim(), `${L(boon.name)}: ${L(boon.text)}`].filter(Boolean).join('\n');
  const style = pick(FIGHTING_STYLES, ch.fightingStyle);
  if (style) addFeature(next, `${T('Estilo de combate', 'Fighting Style')}: ${L(style.name)}`, L(style.text));
  for (const id of ch.expertise ?? []) next.skillProf[id] = 2 as ProfLevel;
  for (const id of ch.metamagic ?? []) { const m = pick(METAMAGIC, id); if (m) addFeature(next, `${T('Metamagia', 'Metamagic')}: ${L(m.name)}`, L(m.text)); }
  for (const id of ch.invocations ?? []) {
    const m = pick(INVOCATIONS, id);
    if (!m) continue;
    addFeature(next, `${T('Invocación', 'Invocation')}: ${L(m.name)}`, L(m.text), /sin gastar espacio|without a spell slot|without a slot/i.test(m.text.en) ? 'atwill' : undefined);
    for (const en of GAIN_SPELLS[m.name.en] ?? []) addDbSpell(next, en, true);
  }

  for (const en of ch.spells ?? []) addDbSpell(next, en);
  return next;
}

export interface LevelUpDiff {
  stats: { label: string; from: string; to: string }[];
  features: { name: string; text: string; recharge?: Recharge; updated: boolean }[];
  spells: { name: string; level: number; components: string; always: boolean; concentration: boolean }[];
  feats: string[];
}

/** Qué cambia entre la ficha antes y después de subir: estadísticas, rasgos y conjuros nuevos */
export function levelUpDiff(before: Character, after: Character): LevelUpDiff {
  const stats: LevelUpDiff['stats'] = [];
  const add = (label: string, a: string | number, b: string | number) => { if (String(a) !== String(b)) stats.push({ label, from: String(a), to: String(b) }); };
  add(T('Nivel', 'Level'), before.level, after.level);
  add(T('PG máximos', 'Max HP'), before.hp.max, after.hp.max);
  add(T('Dados de golpe', 'Hit Dice'), `${before.level}d${before.hitDie}`, `${after.level}d${after.hitDie}`);
  add(T('Bonificador por competencia', 'Proficiency Bonus'), fmtSigned(profBonusOf(before.level)), fmtSigned(profBonusOf(after.level)));
  for (const a of ABILITY_IDS) {
    if (before.abilities[a] !== after.abilities[a]) add(abilityShort(a), `${before.abilities[a]} (${fmtSigned(mod(before.abilities[a]))})`, `${after.abilities[a]} (${fmtSigned(mod(after.abilities[a]))})`);
  }
  add(T('Clase de armadura', 'Armor Class'), armorClass(before).value, armorClass(after).value);
  add(T('Velocidad', 'Speed'), speed(before).value, speed(after).value);
  add(T('Percepción pasiva', 'Passive Perception'), passivePerception(before), passivePerception(after));
  const dcA = spellSaveDc(before); const dcB = spellSaveDc(after);
  if (dcA != null && dcB != null) add(T('CD de salvación de conjuros', 'Spell save DC'), dcA, dcB);
  const newSaves = after.saveProf.filter((x) => !before.saveProf.includes(x));
  if (newSaves.length) stats.push({ label: T('Salvaciones con competencia', 'Proficient saves'), from: before.saveProf.map(abilityShort).join(', ') || '—', to: after.saveProf.map(abilityShort).join(', ') });
  const newExp = Object.keys(after.skillProf).filter((k) => after.skillProf[k] === 2 && before.skillProf[k] !== 2);
  if (newExp.length) stats.push({ label: T('Pericia', 'Expertise'), from: '', to: newExp.map(skillName).join(', ') });
  if (before.subclass !== after.subclass) add(T('Subclase', 'Subclass'), before.subclass || '—', after.subclass);
  const slotsTxt = (c: Character) => c.pactSlots ? T(`${c.pactSlots.max} de nv ${c.pactSlots.level} (pacto)`, `${c.pactSlots.max} of lvl ${c.pactSlots.level} (pact)`) : c.slots.map((s, i) => `${s.max}×${i + 1}`).join(' · ') || '—';
  add(T('Espacios de conjuro', 'Spell slots'), slotsTxt(before), slotsTxt(after));
  for (const r of after.resources) {
    const prev = before.resources.find((x) => x.key ? x.key === r.key : x.name === r.name);
    const rc = r.recovers === 'short' ? T('desc. corto', 'short rest') : T('desc. largo', 'long rest');
    if (!prev) stats.push({ label: `${r.name} (${rc})`, from: '—', to: String(r.max) });
    else if (prev.max !== r.max) stats.push({ label: `${r.name} (${rc})`, from: String(prev.max), to: String(r.max) });
  }
  const features = after.features
    .filter((f) => { const p = before.features.find((x) => x.name === f.name); return !p || p.text !== f.text; })
    .map((f) => ({ name: f.name, text: f.text, recharge: f.recharge ?? rechargeOf(f.name), updated: before.features.some((x) => x.name === f.name) }));
  const spells = after.spells.filter((s) => !before.spells.some((x) => x.id === s.id)).map((s) => ({
    name: s.name, level: s.level, components: s.components ?? '', always: !!s.alwaysPrepared, concentration: s.concentration,
  }));
  const featLines = (txt: string) => txt.split('\n').map((x) => x.trim()).filter(Boolean);
  const feats = featLines(after.feats).filter((x) => !featLines(before.feats).includes(x)).map((x) => x.split(':')[0]);
  return { stats, features, spells, feats };
}
