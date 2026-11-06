import type { Ability, Character, DamageType, RollScope } from '../types';
import { CONDITIONS, SKILLS, abilityShort, conditionName, effectName } from './srd';
import { L, T } from '../i18n';
import { activeRules, adjValue, rulesBonus, type RollTarget } from './bonuses';
import { abilityScores, acFromGear, attackExtras, hpExtras, speedExtras } from './gear';
import type { Attack } from '../types';

export const mod = (score: number) => Math.floor((score - 10) / 2);
export const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
export const profBonus = (level: number) => 2 + Math.floor((Math.max(1, level) - 1) / 4);

/** Modificadores con las puntuaciones efectivas (objetos como los guanteletes de poder de ogro incluidos) */
export const abilityMods = (c: Character): Record<Ability, number> => {
  const s = abilityScores(c).scores;
  return { str: mod(s.str), dex: mod(s.dex), con: mod(s.con), int: mod(s.int), wis: mod(s.wis), cha: mod(s.cha) };
};

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

export function armorClass(c: Character): { value: number; parts: string[]; gear: string[] } {
  const m = abilityMods(c);
  const g = acFromGear(c, m.dex);
  const gear: string[] = [];
  let base = g.base ?? c.baseAc;
  const parts = [g.base != null ? g.baseText : `${T('Base', 'Base')} ${c.baseAc}${c.acNote ? ` (${c.acNote})` : ''}`];
  if (g.base != null) gear.push(g.baseText);
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
  const shield = Math.max(c.shield ? 2 : 0, g.shield);
  if (shield) {
    value += shield;
    parts.push(T(`+${shield} escudo`, `+${shield} Shield`));
    if (g.shield) gear.push(T(`+${shield} escudo`, `+${shield} Shield`));
  }
  for (const x of g.extras) {
    value += x.value;
    parts.push(x.text);
    gear.push(x.text);
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
  return { value, parts, gear };
}

export function speed(c: Character): { value: number; parts: string[]; gear: string[] } {
  const parts = [`${T('Base', 'Base')} ${c.speed} ${T('pies', 'ft')}`];
  const extra = speedExtras(c);
  const gear = extra.map((x) => x.text);
  const zero = c.conditions.filter((x) => ['agarrado', 'apresado', 'paralizado', 'petrificado', 'inconsciente'].includes(x));
  if (zero.length) return { value: 0, parts: [...parts, `0: ${zero.map(conditionName).join(', ')}`], gear };
  let v = c.speed;
  for (const x of extra) { v += x.value; parts.push(x.text); }
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
  return { value: Math.max(0, v), parts, gear };
}

export function maxHp(c: Character): number {
  return Math.max(0, c.hp.max + c.effects.reduce((a, e) => a + (e.mods.maxHp ?? 0), 0) + hpExtras(c).reduce((a, x) => a + x.value, 0) + (c.hpMaxMods ?? []).reduce((a, m) => a + m.amount, 0));
}

/** De dónde sale cada punto de los PG máximos (para explicarlo al tocar) */
export function maxHpParts(c: Character): { label: string; value: number; kind: 'base' | 'effect' | 'trait' | 'item' | 'temp'; id?: string; off?: boolean }[] {
  const out: { label: string; value: number; kind: 'base' | 'effect' | 'trait' | 'item' | 'temp'; id?: string; off?: boolean }[] = [{ label: T('Base de la hoja (dados de golpe + CON)', 'Sheet base (Hit Dice + CON)'), value: c.hp.max, kind: 'base' }];
  for (const x of hpExtras(c, true)) out.push({ label: x.text, value: x.value, kind: x.item ? 'item' : 'trait', id: x.id, off: x.off });
  for (const e of c.effects) if (e.mods.maxHp) out.push({ label: effectName(e), value: e.mods.maxHp, kind: 'effect' });
  for (const m of c.hpMaxMods ?? []) out.push({ label: `${m.source}${m.until === 'long' ? T(' (hasta descanso largo)', ' (until Long Rest)') : ''}`, value: m.amount, kind: 'temp', id: m.id });
  return out;
}

/** Líneas que explican un bonificador: «Modificador de FUE +3», «Competencia +2», «Bendición +1d4 (aparte)»… */
export interface Part { label: string; value: string; kind?: 'item' | 'trait' | 'effect' | 'penalty' }

/** Efectos activos que añaden dados a un tipo de tirada (Bendición, Perdición, Guía…) */
export function effectDice(c: Character, scope: RollScope): Part[] {
  return c.effects.filter((e) => e.mods.bonus?.[scope]).map((e) => ({ label: effectName(e), value: e.mods.bonus![scope]!.replace(/^(?=\d)/, '+'), kind: 'effect' as const }));
}

export const exhaustionPart = (c: Character): Part[] => (c.exhaustion > 0 ? [{ label: T(`Agotamiento ${c.exhaustion}`, `Exhaustion ${c.exhaustion}`), value: `−${2 * c.exhaustion}`, kind: 'penalty' }] : []);

/** Desglose del ataque de una fila de armas */
export function attackParts(c: Character, a: Attack): { total: number; attack: Part[]; damage: Part[] } {
  const m = abilityMods(c);
  const src = abilityScores(c).sources[a.ability];
  const ex = attackExtras(c, a);
  const attack: Part[] = [
    { label: `${T('Modificador de', 'Modifier from')} ${abilityShort(a.ability)}${src.length ? ` (${src.map((x) => x.label).join(', ')})` : ''}`, value: fmt(m[a.ability]), kind: src.length ? 'item' : undefined },
    ...(a.proficient ? [{ label: T('Competencia', 'Proficiency'), value: fmt(profBonus(c.level)) }] : []),
    ...(a.extraBonus ? [{ label: T('Bonus extra (escrito en la fila)', 'Extra bonus (typed in the row)'), value: fmt(a.extraBonus) }] : []),
    ...ex.attack.map((x) => ({ label: x.label, value: fmt(x.value), kind: x.item ? 'item' as const : 'trait' as const })),
    ...effectDice(c, 'attack'),
    ...exhaustionPart(c),
  ];
  const damage: Part[] = [
    { label: T('Dados del arma', 'Weapon dice'), value: a.damage },
    { label: `${T('Modificador de', 'Modifier from')} ${abilityShort(a.ability)}`, value: fmt(m[a.ability]) },
    ...ex.damage.map((x) => ({ label: x.label, value: fmt(x.value), kind: 'item' as const })),
    ...effectDice(c, 'damage'),
  ];
  return { total: weaponAttack(c, a), attack, damage };
}

/** Desglose de la CD y el ataque de conjuros */
export function spellParts(c: Character): Part[] {
  if (!c.spellAbility) return [];
  const m = abilityMods(c)[c.spellAbility];
  const src = abilityScores(c).sources[c.spellAbility];
  return [
    { label: `${T('Modificador de', 'Modifier from')} ${abilityShort(c.spellAbility)}${src.length ? ` (${src.map((x) => x.label).join(', ')})` : ''}`, value: fmt(m), kind: src.length ? 'item' : undefined },
    { label: T('Competencia', 'Proficiency'), value: fmt(profBonus(c.level)) },
  ];
}

/** Bonificador de ataque de una fila de armas (con arma mágica y estilo de combate) */
export function weaponAttack(c: Character, a: Attack): number {
  return attackBonus(c, a.ability, a.proficient, a.extraBonus + attackExtras(c, a).attack.reduce((s, x) => s + x.value, 0));
}

/** Lo que se suma a los dados de daño: modificador de característica y arma mágica */
export function weaponDamageFlat(c: Character, a: Attack): number {
  return abilityMods(c)[a.ability] + attackExtras(c, a).damage.reduce((s, x) => s + x.value, 0);
}

/** Competente en esta salvación (marcada en la hoja o por un rasgo, como Superviviente disciplinado) */
export const saveProficient = (c: Character, a: Ability) => c.saveProf.includes(a) || activeRules(c, { kind: 'save', ability: a }).some((r) => r.prof);

export function saveBonus(c: Character, a: Ability): number {
  const t: RollTarget = { kind: 'save', ability: a };
  return abilityMods(c)[a] + (saveProficient(c, a) ? profBonus(c.level) : 0) + rulesBonus(c, t) + adjValue(c, t).value;
}

export function skillBonus(c: Character, skillId: string): number {
  const s = SKILLS.find((x) => x.id === skillId)!;
  const p = c.skillProf[skillId] ?? 0;
  const t: RollTarget = { kind: 'skill', id: skillId };
  return abilityMods(c)[s.ability] + p * profBonus(c.level) + rulesBonus(c, t) + adjValue(c, t).value;
}

/** Prueba de característica sin habilidad */
export function checkBonus(c: Character, a: Ability): number {
  const t: RollTarget = { kind: 'check', ability: a };
  return abilityMods(c)[a] + rulesBonus(c, t) + adjValue(c, t).value;
}

/** Iniciativa: prueba de Destreza + Alerta, Emboscador temible… y lo añadido a mano */
export function initiativeBonus(c: Character): number {
  const t: RollTarget = { kind: 'init' };
  return abilityMods(c).dex + rulesBonus(c, t) + adjValue(c, t).value;
}

/** Tirada de la hoja → a qué reglas mira */
export const targetOf = (r: RollKind): RollTarget =>
  r.kind === 'check' ? (r.skill ? { kind: 'skill', id: r.skill } : { kind: 'check', ability: r.ability }) : r.kind === 'save' ? { kind: 'save', ability: r.ability } : r.kind === 'initiative' ? { kind: 'init' } : { kind: 'attack' };

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

/** Percepción pasiva: 10 + Percepción, +5 con ventaja y −5 con desventaja (reglas 2024) */
export function passiveParts(c: Character): { total: number; parts: Part[] } {
  const ctx = rollContext(c, { kind: 'check', ability: 'wis', skill: 'percepcion' });
  const adv = ctx.advantage.length > 0 && !ctx.disadvantage.length;
  const dis = ctx.disadvantage.length > 0 && !ctx.advantage.length;
  const parts: Part[] = [
    { label: T('Base', 'Base'), value: '10' },
    { label: T('Tu bonificador de Percepción', 'Your Perception bonus'), value: fmt(skillBonus(c, 'percepcion')) },
    ...(adv ? [{ label: T(`Ventaja (${ctx.advantage.join(', ')})`, `Advantage (${ctx.advantage.join(', ')})`), value: '+5', kind: 'trait' as const }] : []),
    ...(dis ? [{ label: T(`Desventaja (${ctx.disadvantage.join(', ')})`, `Disadvantage (${ctx.disadvantage.join(', ')})`), value: '−5', kind: 'penalty' as const }] : []),
  ];
  return { total: 10 + skillBonus(c, 'percepcion') + (adv ? 5 : 0) - (dis ? 5 : 0), parts };
}
export const passivePerception = (c: Character) => passiveParts(c).total;

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
  /** Recordatorios de rasgos que dependen de la situación (no se aplican solos) */
  notes: string[];
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
  // Rasgos de clase, especie y dotes
  const notes: string[] = [];
  for (const rule of activeRules(c, targetOf(r))) {
    if (rule.note) notes.push(`${rule.source}: ${rule.text}`);
    else if (rule.adv && !adv.includes(rule.source)) adv.push(rule.source);
    else if (rule.dis && !dis.includes(rule.source)) dis.push(rule.source);
  }
  return { advantage: adv, disadvantage: dis, autoFail, penalties, notes };
}

/** Hace una tirada d20 completa aplicando ventaja/desventaja, agotamiento y bonificadores de efectos */
export function rollD20(c: Character, r: RollKind, bonus: number, label: string): { total: number; lines: string[]; natural: number } {
  const ctx = rollContext(c, r);
  const scope: RollScope = r.kind === 'attack' ? 'attack' : r.kind === 'save' ? 'save' : r.kind === 'initiative' ? 'initiative' : 'check';
  const extras = c.effects.flatMap((e) => (e.mods.bonus?.[scope] ? [{ expr: e.mods.bonus[scope]!, name: effectName(e) }] : []));
  const rules = activeRules(c, targetOf(r));
  const lucky = rules.find((x) => x.rerollOnes);
  const ruleLines: string[] = [];
  // Suerte del mediano: los 1 se repiten
  const d20 = () => {
    const n = rand(20);
    if (n !== 1 || !lucky) return n;
    const again = rand(20);
    ruleLines.push(T(`${lucky.source}: un 1 se repite → ${again}`, `${lucky.source}: a 1 is rerolled → ${again}`));
    return again;
  };
  const a = d20();
  const b = d20();
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
  // Talento fiable: un 9 o menos cuenta como 10
  const floor = rules.find((x) => x.minNatural);
  if (floor?.minNatural && natural < floor.minNatural) {
    ruleLines.push(T(`${floor.source}: el ${natural} cuenta como ${floor.minNatural}`, `${floor.source}: the ${natural} counts as ${floor.minNatural}`));
    natural = floor.minNatural;
  }
  let total = natural + bonus - 2 * c.exhaustion;
  const lines = [`🎲 ${label}: ${diceText} ${fmt(bonus)}`, ...ruleLines];
  if (c.exhaustion) lines.push(`${T('Agotamiento', 'Exhaustion')}: −${2 * c.exhaustion}`);
  for (const x of extras) {
    const res = rollExpr(x.expr);
    total += res.total;
    lines.push(`${x.name}: ${res.text}`);
  }
  if (hasAdv) lines.push(`${T('Ventaja por', 'Advantage from')}: ${ctx.advantage.join(', ')}`);
  if (hasDis) lines.push(`${T('Desventaja por', 'Disadvantage from')}: ${ctx.disadvantage.join(', ')}`);
  ctx.autoFail.forEach((f) => lines.push(`⚠️ ${f}`));
  // Poder indomable: el total no baja de tu puntuación de Fuerza
  const minT = rules.find((x) => x.minTotal);
  if (minT?.minTotal && total < minT.minTotal) {
    lines.push(T(`${minT.source}: ${total} → ${minT.minTotal}`, `${minT.source}: ${total} → ${minT.minTotal}`));
    total = minT.minTotal;
  }
  ctx.notes.forEach((n) => lines.push(`📌 ${n}`));
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
