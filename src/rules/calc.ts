import type { Ability, Character, DamageType, RollScope } from '../types';
import { CONDITIONS, SKILLS, abilityShort, conditionName, effectName } from './srd';
import { L, T } from '../i18n';

export const mod = (score: number) => Math.floor((score - 10) / 2);
export const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
export const profBonus = (level: number) => 2 + Math.floor((Math.max(1, level) - 1) / 4);

export const abilityMods = (c: Character): Record<Ability, number> => ({
  str: mod(c.abilities.str),
  dex: mod(c.abilities.dex),
  con: mod(c.abilities.con),
  int: mod(c.abilities.int),
  wis: mod(c.abilities.wis),
  cha: mod(c.abilities.cha),
});

// ---------- Dados ----------

export interface RollResult {
  total: number;
  text: string;
  natural?: number;
}

const rand = (sides: number) => 1 + Math.floor(Math.random() * sides);

/** Tira una expresión tipo "2d6+3", "1d20-1+1d4". */
export function rollExpr(expr: string): RollResult {
  const clean = expr.replace(/\s+/g, '').toLowerCase();
  const terms = clean.match(/[+-]?[^+-]+/g) ?? [];
  let total = 0;
  const parts: string[] = [];
  for (const raw of terms) {
    const sign = raw.startsWith('-') ? -1 : 1;
    const t = raw.replace(/^[+-]/, '');
    const m = t.match(/^(\d*)d(\d+)$/);
    if (m) {
      const n = Number(m[1] || 1);
      const sides = Number(m[2]);
      const rolls = Array.from({ length: Math.min(n, 100) }, () => rand(sides));
      const sum = rolls.reduce((a, b) => a + b, 0);
      total += sign * sum;
      parts.push(`${sign < 0 ? '−' : parts.length ? '+' : ''}${n}d${sides}[${rolls.join(',')}]`);
    } else if (/^\d+$/.test(t)) {
      total += sign * Number(t);
      parts.push(`${sign < 0 ? '−' : parts.length ? '+' : ''}${t}`);
    }
  }
  return { total, text: parts.join(' ') };
}

export const isDiceExpr = (s: string) => /^\s*[+-]?\s*(\d*d\d+|\d+)(\s*[+-]\s*(\d*d\d+|\d+))*\s*$/i.test(s);

// ---------- Estadísticas derivadas ----------

export function armorClass(c: Character): { value: number; parts: string[] } {
  const m = abilityMods(c);
  let base = c.baseAc;
  const parts = [`${T('Base', 'Base')} ${c.baseAc}${c.acNote ? ` (${c.acNote})` : ''}`];
  for (const e of c.effects) {
    if (e.mods.acBase != null) {
      const alt = e.mods.acBase + m.dex;
      if (alt > base) {
        base = alt;
        parts.push(`${effectName(e)}: ${e.mods.acBase} + ${abilityShort('dex')} = ${alt}`);
      }
    }
  }
  let value = base;
  if (c.shield) {
    value += 2;
    parts.push(T('+2 escudo', '+2 Shield'));
  }
  for (const e of c.effects) {
    if (e.mods.ac) {
      value += e.mods.ac;
      parts.push(`${fmt(e.mods.ac)} ${effectName(e)}`);
    }
  }
  if (c.effects.some((e) => e.presetId === 'piel_roble') && value < 17) {
    value = 17;
    parts.push(T('Piel robliza: mínimo 17', 'Barkskin: minimum 17'));
  }
  return { value, parts };
}

export function speed(c: Character): { value: number; parts: string[] } {
  const parts = [`${T('Base', 'Base')} ${c.speed} ${T('pies', 'ft')}`];
  const zero = c.conditions.filter((x) => ['agarrado', 'apresado', 'paralizado', 'petrificado', 'inconsciente'].includes(x));
  if (zero.length) return { value: 0, parts: [...parts, `0: ${zero.map(conditionName).join(', ')}`] };
  let v = c.speed;
  for (const e of c.effects) {
    if (e.mods.speed) {
      v += e.mods.speed;
      parts.push(`${fmt(e.mods.speed)} ${effectName(e)}`);
    }
  }
  if (c.exhaustion > 0) {
    v -= 5 * c.exhaustion;
    parts.push(`−${5 * c.exhaustion} ${T('agotamiento', 'exhaustion')} ${c.exhaustion}`);
  }
  for (const e of c.effects) {
    if (e.mods.speedMult && e.mods.speedMult !== 1) {
      v = Math.floor(v * e.mods.speedMult);
      parts.push(`×${e.mods.speedMult} ${effectName(e)}`);
    }
  }
  return { value: Math.max(0, v), parts };
}

export function maxHp(c: Character): number {
  return c.hp.max + c.effects.reduce((a, e) => a + (e.mods.maxHp ?? 0), 0);
}

export function saveBonus(c: Character, a: Ability): number {
  const m = abilityMods(c)[a];
  return m + (c.saveProf.includes(a) ? profBonus(c.level) : 0);
}

export function skillBonus(c: Character, skillId: string): number {
  const s = SKILLS.find((x) => x.id === skillId)!;
  const p = c.skillProf[skillId] ?? 0;
  return abilityMods(c)[s.ability] + p * profBonus(c.level);
}

export function attackBonus(c: Character, ability: Ability, proficient: boolean, extra = 0): number {
  return abilityMods(c)[ability] + (proficient ? profBonus(c.level) : 0) + extra;
}

export function spellSaveDc(c: Character): number | null {
  if (!c.spellAbility) return null;
  return 8 + abilityMods(c)[c.spellAbility] + profBonus(c.level);
}

export function spellAttack(c: Character): number | null {
  if (!c.spellAbility) return null;
  return abilityMods(c)[c.spellAbility] + profBonus(c.level);
}

export const passivePerception = (c: Character) => 10 + skillBonus(c, 'percepcion');

export function damageDefenses(c: Character): { resist: Set<DamageType>; immune: Set<DamageType>; vuln: Set<DamageType>; resistAll: boolean } {
  const resist = new Set<DamageType>(c.resistances);
  const immune = new Set<DamageType>(c.immunities);
  for (const e of c.effects) {
    e.mods.resist?.forEach((d) => resist.add(d));
    e.mods.immune?.forEach((d) => immune.add(d));
  }
  return { resist, immune, vuln: new Set(c.vulnerabilities), resistAll: c.conditions.includes('petrificado') };
}

// ---------- Ventaja / desventaja según condiciones ----------

export type RollKind =
  | { kind: 'attack' }
  | { kind: 'save'; ability: Ability }
  | { kind: 'check'; ability: Ability; skill?: string }
  | { kind: 'initiative' };

export interface RollContext {
  advantage: string[];
  disadvantage: string[];
  autoFail: string[];
  penalties: string[];
}

export function rollContext(c: Character, r: RollKind): RollContext {
  const adv: string[] = [];
  const dis: string[] = [];
  const autoFail: string[] = [];
  const penalties: string[] = [];
  const has = (id: string) => c.conditions.includes(id as never);
  const cn = (id: string) => conditionName(id as never);

  if (c.exhaustion > 0) penalties.push(T(`−${2 * c.exhaustion} por Agotamiento ${c.exhaustion}`, `−${2 * c.exhaustion} from Exhaustion ${c.exhaustion}`));

  if (r.kind === 'attack') {
    if (has('envenenado')) dis.push(cn('envenenado'));
    if (has('asustado')) dis.push(T('Asustado (si ves la fuente)', 'Frightened (if the source is in sight)'));
    if (has('cegado')) dis.push(cn('cegado'));
    if (has('derribado')) dis.push(cn('derribado'));
    if (has('apresado')) dis.push(cn('apresado'));
    if (has('agarrado')) dis.push(T('Agarrado (si no atacas a quien te agarra)', 'Grappled (unless attacking the grappler)'));
    if (has('invisible')) adv.push(T('Invisible (si no te ven)', 'Invisible (if they can’t see you)'));
  }
  // La iniciativa es una prueba de Destreza
  const isCheck = r.kind === 'check' || r.kind === 'initiative';
  if (isCheck) {
    if (has('envenenado')) dis.push(cn('envenenado'));
    if (has('asustado')) dis.push(T('Asustado (si ves la fuente)', 'Frightened (if the source is in sight)'));
    const skill = r.kind === 'check' && r.skill ? SKILLS.find((s) => s.id === r.skill) : undefined;
    if (skill?.senses?.includes('sight') && has('cegado')) autoFail.push(T('Cegado: fallas si requiere la vista', 'Blinded: you fail if it requires sight'));
    if (skill?.senses?.includes('hearing') && has('ensordecido')) autoFail.push(T('Ensordecido: fallas si requiere el oído', 'Deafened: you fail if it requires hearing'));
  }
  if (r.kind === 'initiative') {
    if (has('invisible')) adv.push(cn('invisible'));
    if (has('incapacitado') || has('aturdido') || has('paralizado') || has('inconsciente') || has('petrificado')) dis.push(cn('incapacitado'));
  }
  if (r.kind === 'save') {
    if ((r.ability === 'str' || r.ability === 'dex') && ['aturdido', 'paralizado', 'inconsciente', 'petrificado'].some(has)) {
      autoFail.push(T('Fallo automático en FUE/DES por tu condición', 'Automatic failure on STR/DEX from your condition'));
    }
    if (r.ability === 'dex' && has('apresado')) dis.push(cn('apresado'));
  }

  const key = r.kind === 'save' ? `save:${r.ability}` : r.kind === 'check' ? `check:${r.ability}` : r.kind === 'initiative' ? 'check:dex' : '';
  for (const e of c.effects) {
    if (key && e.mods.advantage?.includes(key)) adv.push(effectName(e));
    if (key && e.mods.disadvantage?.includes(key)) dis.push(effectName(e));
  }
  return { advantage: adv, disadvantage: dis, autoFail, penalties };
}

/** Hace una tirada d20 completa aplicando ventaja/desventaja, agotamiento y bonificadores de efectos */
export function rollD20(c: Character, r: RollKind, bonus: number, label: string): { total: number; lines: string[]; natural: number } {
  const ctx = rollContext(c, r);
  const scope: RollScope = r.kind === 'attack' ? 'attack' : r.kind === 'save' ? 'save' : r.kind === 'initiative' ? 'initiative' : 'check';
  const extras = c.effects.flatMap((e) => (e.mods.bonus?.[scope] ? [{ expr: e.mods.bonus[scope]!, name: effectName(e) }] : []));
  const a = rand(20);
  const b = rand(20);
  const hasAdv = ctx.advantage.length > 0;
  const hasDis = ctx.disadvantage.length > 0;
  let natural = a;
  let diceText = `d20[${a}]`;
  if (hasAdv && !hasDis) {
    natural = Math.max(a, b);
    diceText = T(`2d20 con ventaja [${a}, ${b}] → ${natural}`, `2d20 with advantage [${a}, ${b}] → ${natural}`);
  } else if (hasDis && !hasAdv) {
    natural = Math.min(a, b);
    diceText = T(`2d20 con desventaja [${a}, ${b}] → ${natural}`, `2d20 with disadvantage [${a}, ${b}] → ${natural}`);
  } else if (hasAdv && hasDis) {
    diceText = T(`d20[${a}] (ventaja y desventaja se anulan)`, `d20[${a}] (advantage and disadvantage cancel out)`);
  }
  let total = natural + bonus - 2 * c.exhaustion;
  const lines = [`🎲 ${label}: ${diceText} ${fmt(bonus)}`];
  if (c.exhaustion) lines.push(`${T('Agotamiento', 'Exhaustion')}: −${2 * c.exhaustion}`);
  for (const x of extras) {
    const res = rollExpr(x.expr);
    total += res.total;
    lines.push(`${x.name}: ${res.text}`);
  }
  if (hasAdv) lines.push(`${T('Ventaja por', 'Advantage from')}: ${ctx.advantage.join(', ')}`);
  if (hasDis) lines.push(`${T('Desventaja por', 'Disadvantage from')}: ${ctx.disadvantage.join(', ')}`);
  ctx.autoFail.forEach((f) => lines.push(`⚠️ ${f}`));
  if (natural === 20 && r.kind === 'attack') lines.push(T('¡20 natural: crítico!', 'Natural 20: critical hit!'));
  if (natural === 1 && r.kind === 'attack') lines.push(T('1 natural: fallo automático.', 'Natural 1: automatic miss.'));
  lines.push(`Total: ${total}`);
  return { total, lines, natural };
}

/** Recordatorios de qué te afecta ahora mismo */
export function activeReminders(c: Character): string[] {
  const out: string[] = [];
  if (c.dead) return [T('☠️ Tu personaje ha muerto.', '☠️ Your character is dead.')];
  if (c.hp.current === 0 && !c.stable) out.push(T('A 0 PG: tira una salvación contra la muerte al inicio de tu turno.', 'At 0 HP: make a Death Saving Throw at the start of your turn.'));
  if (c.hp.current === 0 && c.stable) out.push(T('Estable a 0 PG: inconsciente, sin tirar salvaciones de muerte.', 'Stable at 0 HP: unconscious, no more Death Saving Throws.'));
  for (const id of c.conditions) {
    const info = CONDITIONS.find((x) => x.id === id);
    if (info) out.push(`${L(info.name)}: ${L(info.short)}`);
  }
  if (c.exhaustion > 0) out.push(T(`Agotamiento ${c.exhaustion}: −${2 * c.exhaustion} a pruebas d20, −${5 * c.exhaustion} pies de velocidad.`, `Exhaustion ${c.exhaustion}: −${2 * c.exhaustion} to D20 Tests, −${5 * c.exhaustion} ft Speed.`));
  if (c.concentratingOn) out.push(T(`Concentrado en ${c.concentratingOn}: si recibes daño, salvación de CON (CD 10 o mitad del daño).`, `Concentrating on ${c.concentratingOn}: when you take damage, CON save (DC 10 or half the damage).`));
  if (c.heroicInspiration) out.push(T('Tienes Inspiración heroica: puedes repetir una tirada.', 'You have Heroic Inspiration: you can reroll a die.'));
  return out;
}
