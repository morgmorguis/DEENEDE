import type { Ability, Character, ConditionId, DamageType, Effect } from '../types';
import {
  armorClass, abilityMods, damageDefenses, fmt, maxHp, rollD20, rollExpr, saveBonus, skillBonus,
} from './calc';
import {
  CONDITIONS, EFFECT_PRESETS, SHORT_REST_ONE_USE, SKILLS, abilityName, abilityShort, damageTypeName, effectMatches,
  effectName, effectNotes, resourceName,
} from './srd';
import { L, T } from '../i18n';

export type Command =
  | { type: 'damage'; amount: number; damageType?: DamageType | null; source?: string | null; attackRoll?: number | null; critical?: boolean }
  | { type: 'heal'; amount?: number | null; dice?: string | null; source?: string | null }
  | { type: 'tempHp'; amount: number }
  | { type: 'addCondition'; condition: ConditionId }
  | { type: 'removeCondition'; condition: ConditionId }
  | { type: 'addEffect'; presetId?: string | null; name?: string | null; rounds?: number | null; notes?: string | null; kind?: 'buff' | 'debuff' }
  | { type: 'removeEffect'; name: string }
  | { type: 'rest'; kind: 'short' | 'long'; hitDice?: number | null }
  | { type: 'useSlot'; level: number }
  | { type: 'rollSave'; ability: Ability }
  | { type: 'rollSkill'; skill: string }
  | { type: 'rollAbility'; ability: Ability }
  | { type: 'rollDice'; expr: string }
  | { type: 'rollInitiative' }
  | { type: 'exhaustion'; delta: number }
  | { type: 'deathSave'; roll?: number | null }
  | { type: 'nextRound' }
  | { type: 'endConcentration' }
  | { type: 'concentrate'; spell: string }
  | { type: 'inspiration'; value: boolean }
  | { type: 'useResource'; name: string; amount?: number | null }
  | { type: 'info'; text: string };

export interface ApplyResult {
  char: Character;
  lines: string[];
  quickRolls: { label: string; expr: string }[];
}

const clone = (c: Character): Character => structuredClone(c);
const uid = () => Math.random().toString(36).slice(2, 10);
const done = (char: Character, lines: string[]): ApplyResult => ({ char, lines, quickRolls: [] });

export function makeEffectFromPreset(presetId: string, rounds?: number | null): Effect | null {
  const p = EFFECT_PRESETS.find((x) => x.id === presetId);
  if (!p) return null;
  return {
    id: uid(),
    name: L(p.name),
    kind: p.kind,
    roundsLeft: rounds ?? p.rounds,
    concentration: p.concentration,
    mods: structuredClone(p.mods),
    notes: L(p.notes),
    presetId: p.id,
  };
}

function breakConcentration(c: Character, lines: string[], reason: string) {
  if (!c.concentratingOn) return;
  const spell = c.concentratingOn;
  c.concentratingOn = null;
  c.effects = c.effects.filter((e) => !(e.concentration && effectMatches(e, spell)));
  lines.push(T(`💥 Pierdes la concentración en ${spell} (${reason}).`, `💥 You lose concentration on ${spell} (${reason}).`));
}

function addConditionTo(c: Character, cond: ConditionId) {
  if (!c.conditions.includes(cond)) c.conditions.push(cond);
}

/** Busca un recurso por clave estable o por nombre (en cualquier idioma) */
export function findResource(c: Character, name: string) {
  const n = name.trim().toLowerCase();
  return c.resources.find((r) => r.key === n || r.name.toLowerCase().includes(n) || resourceName(r).toLowerCase().includes(n));
}

/** Aplica daño siguiendo el orden de las reglas 2024. */
export function applyDamage(input: Character, cmd: Extract<Command, { type: 'damage' }>): ApplyResult {
  const c = clone(input);
  const lines: string[] = [];
  const quickRolls: ApplyResult['quickRolls'] = [];
  const src = cmd.source ? `${cmd.source}: ` : '';

  if (cmd.attackRoll != null) {
    const ac = armorClass(c).value;
    if (cmd.attackRoll < ac && !cmd.critical) {
      lines.push(T(`🛡️ ${src}tirada de ataque ${cmd.attackRoll} contra tu CA ${ac}: ¡falla! No recibes daño.`, `🛡️ ${src}attack roll ${cmd.attackRoll} vs your AC ${ac}: it misses! You take no damage.`));
      lines.push(T('Si tu DM dice que impacta igualmente, escribe solo el daño.', 'If your DM says it hits anyway, just enter the damage.'));
      return { char: input, lines, quickRolls };
    }
    lines.push(T(`${src}tirada de ataque ${cmd.attackRoll} contra tu CA ${ac}: impacta.`, `${src}attack roll ${cmd.attackRoll} vs your AC ${ac}: it hits.`));
  }

  if (c.dead) return done(input, [T('Tu personaje ya está muerto.', 'Your character is already dead.')]);

  let dmg = Math.max(0, Math.floor(cmd.amount));
  const typeName = cmd.damageType ? damageTypeName(cmd.damageType).toLowerCase() : T('sin tipo', 'untyped');
  lines.push(T(`⚔️ ${src}${dmg} de daño ${typeName}${cmd.critical ? ' (crítico)' : ''}.`, `⚔️ ${src}${dmg} ${typeName} damage${cmd.critical ? ' (critical)' : ''}.`));

  const def = damageDefenses(c);
  if (cmd.damageType && def.immune.has(cmd.damageType)) {
    lines.push(T(`Eres inmune al daño ${typeName}: 0 de daño.`, `You are immune to ${typeName} damage: 0 damage.`));
    return { char: c, lines, quickRolls };
  }
  if ((cmd.damageType && def.resist.has(cmd.damageType)) || def.resistAll) {
    const eff = c.effects.find((e) => cmd.damageType && e.mods.resist?.includes(cmd.damageType));
    const why = eff ? effectName(eff) : def.resistAll ? L(CONDITIONS.find((x) => x.id === 'petrificado')!.name) : T('rasgo', 'trait');
    const before = dmg;
    dmg = Math.floor(dmg / 2);
    lines.push(T(`Resistencia (${why}): ${before} → ${dmg}.`, `Resistance (${why}): ${before} → ${dmg}.`));
  }
  if (cmd.damageType && def.vuln.has(cmd.damageType)) {
    const before = dmg;
    dmg *= 2;
    lines.push(T(`Vulnerabilidad: ${before} → ${dmg}.`, `Vulnerability: ${before} → ${dmg}.`));
  }

  const mhp = maxHp(c);
  const original = dmg;

  // Ya a 0 PG
  if (c.hp.current === 0) {
    if (dmg >= mhp) {
      c.dead = true;
      lines.push(T(`☠️ Recibes ${dmg} de daño estando a 0 PG, igual o más que tus PG máximos (${mhp}): mueres.`, `☠️ You take ${dmg} damage at 0 HP, equal to or more than your HP maximum (${mhp}): you die.`));
      return { char: c, lines, quickRolls };
    }
    if (dmg > 0) {
      const fails = cmd.critical ? 2 : 1;
      c.stable = false;
      c.deathSaves.fail = Math.min(3, c.deathSaves.fail + fails);
      lines.push(T(`A 0 PG: ${fails} fallo(s) de salvación contra la muerte (${c.deathSaves.fail}/3).`, `At 0 HP: ${fails} Death Saving Throw failure(s) (${c.deathSaves.fail}/3).`));
      if (c.deathSaves.fail >= 3) {
        c.dead = true;
        lines.push(T('☠️ Tres fallos: tu personaje muere.', '☠️ Three failures: your character dies.'));
      }
    }
    return { char: c, lines, quickRolls };
  }

  if (c.hp.temp > 0 && dmg > 0) {
    const absorbed = Math.min(c.hp.temp, dmg);
    c.hp.temp -= absorbed;
    dmg -= absorbed;
    lines.push(T(`PG temporales absorben ${absorbed} (quedan ${c.hp.temp}).`, `Temporary HP absorb ${absorbed} (${c.hp.temp} left).`));
  }

  const before = c.hp.current;
  const remaining = dmg - before;
  c.hp.current = Math.max(0, before - dmg);
  lines.push(`${T('PG', 'HP')}: ${before} → ${c.hp.current} / ${mhp}.`);

  if (c.hp.current === 0) {
    if (remaining >= mhp) {
      c.dead = true;
      lines.push(T(`☠️ Daño sobrante (${remaining}) ≥ PG máximos (${mhp}): muerte instantánea.`, `☠️ Remaining damage (${remaining}) ≥ HP maximum (${mhp}): instant death.`));
      return { char: c, lines, quickRolls };
    }
    lines.push(T('Caes a 0 PG: quedas Inconsciente. Al inicio de tus turnos tira salvaciones contra la muerte.', 'You drop to 0 HP and fall Unconscious. Make Death Saving Throws at the start of your turns.'));
    addConditionTo(c, 'inconsciente');
    addConditionTo(c, 'derribado');
    c.deathSaves = { success: 0, fail: 0 };
    c.stable = false;
    breakConcentration(c, lines, T('quedas inconsciente', 'you fall unconscious'));
    const rage = c.effects.find((e) => e.presetId === 'furia');
    if (rage) {
      c.effects = c.effects.filter((e) => e !== rage);
      lines.push(T('Tu Furia termina al quedar inconsciente.', 'Your Rage ends as you fall unconscious.'));
    }
    quickRolls.push({ label: T('Salvación contra la muerte', 'Death Saving Throw'), expr: 'deathsave' });
  } else if (c.concentratingOn && original > 0) {
    const dc = Math.min(30, Math.max(10, Math.floor(original / 2)));
    const b = saveBonus(c, 'con');
    lines.push(T(`🧠 Concentración en ${c.concentratingOn}: salvación de CON CD ${dc} (tu bonificador ${fmt(b)}).`, `🧠 Concentration on ${c.concentratingOn}: CON save DC ${dc} (your bonus ${fmt(b)}).`));
    quickRolls.push({ label: T(`Salvación CON (CD ${dc})`, `CON save (DC ${dc})`), expr: `concentration:${dc}` });
  }
  if (c.hp.current > 0 && c.hp.current <= Math.floor(mhp / 4)) lines.push(T('⚠️ Estás por debajo del 25 % de tus PG.', '⚠️ You are below 25% of your HP.'));
  return { char: c, lines, quickRolls };
}

export function applyHeal(input: Character, amount: number, source?: string | null): ApplyResult {
  const c = clone(input);
  const lines: string[] = [];
  if (c.dead) return done(input, [T('Un personaje muerto no puede curarse con curación normal (necesita revivir).', 'A dead character can’t be healed normally (it needs to be revived).')]);
  const mhp = maxHp(c);
  const before = c.hp.current;
  c.hp.current = Math.min(mhp, before + Math.max(0, amount));
  lines.push(T(`💚 ${source ? source + ': ' : ''}curas ${amount}. PG: ${before} → ${c.hp.current} / ${mhp}.`, `💚 ${source ? source + ': ' : ''}you heal ${amount}. HP: ${before} → ${c.hp.current} / ${mhp}.`));
  if (before === 0 && c.hp.current > 0) {
    c.conditions = c.conditions.filter((x) => x !== 'inconsciente');
    c.deathSaves = { success: 0, fail: 0 };
    c.stable = false;
    lines.push(T('Recuperas la consciencia (sigues Derribado hasta que te levantes gastando la mitad de tu movimiento).', 'You regain consciousness (you remain Prone until you spend half your movement to stand).'));
  }
  return done(c, lines);
}

export function applyRest(input: Character, kind: 'short' | 'long', hitDice = 0): ApplyResult {
  const c = clone(input);
  const lines: string[] = [];
  if (kind === 'short') {
    lines.push(T('⛺ Descanso corto (1 hora).', '⛺ Short Rest (1 hour).'));
    const con = abilityMods(c).con;
    const available = c.level - c.hitDiceSpent;
    const n = Math.min(hitDice, available);
    let healed = 0;
    for (let i = 0; i < n; i++) healed += Math.max(0, rollExpr(`1d${c.hitDie}`).total + con);
    if (n > 0) {
      c.hitDiceSpent += n;
      const before = c.hp.current;
      c.hp.current = Math.min(maxHp(c), c.hp.current + healed);
      lines.push(T(`Gastas ${n} Dado(s) de Golpe (d${c.hitDie} ${fmt(con)}): +${healed} PG (${before} → ${c.hp.current}).`, `You spend ${n} Hit Point Dice (d${c.hitDie} ${fmt(con)}): +${healed} HP (${before} → ${c.hp.current}).`));
    } else {
      lines.push(T(`No gastas Dados de Golpe (disponibles: ${available}). Escribe "descanso corto gastando 2 dados" para usarlos.`, `No Hit Point Dice spent (available: ${available}). Type "short rest spending 2 dice" to use them.`));
    }
    for (const r of c.resources) {
      if (r.recovers === 'short' && r.used > 0) {
        r.used = 0;
        lines.push(T(`Recuperas ${resourceName(r)}.`, `You regain ${resourceName(r)}.`));
      } else if (r.recovers === 'long' && r.used > 0 && r.key && SHORT_REST_ONE_USE.includes(r.key)) {
        // En 2024 algunas capacidades recuperan un uso en descanso corto
        r.used -= 1;
        lines.push(T(`Recuperas 1 uso de ${resourceName(r)}.`, `You regain 1 use of ${resourceName(r)}.`));
      }
    }
    if (c.pactSlots && c.pactSlots.used > 0) {
      c.pactSlots.used = 0;
      lines.push(T('Recuperas tus espacios de Magia del pacto.', 'You regain your Pact Magic slots.'));
    }
  } else {
    lines.push(T('🌙 Descanso largo (8 horas).', '🌙 Long Rest (8 hours).'));
    c.effects = c.effects.filter((e) => e.roundsLeft === null && !e.concentration && e.presetId !== 'ayuda' && e.presetId !== 'armadura_mago');
    c.hp.current = maxHp(c);
    c.hp.temp = 0;
    c.hitDiceSpent = 0;
    c.slots.forEach((s) => (s.used = 0));
    if (c.pactSlots) c.pactSlots.used = 0;
    c.resources.forEach((r) => (r.used = 0));
    c.deathSaves = { success: 0, fail: 0 };
    c.stable = false;
    c.conditions = c.conditions.filter((x) => x !== 'inconsciente');
    c.concentratingOn = null;
    if (c.exhaustion > 0) {
      c.exhaustion -= 1;
      lines.push(T(`Agotamiento reducido a ${c.exhaustion}.`, `Exhaustion reduced to ${c.exhaustion}.`));
    }
    if (/humano|human/i.test(c.species) && !c.heroicInspiration) {
      c.heroicInspiration = true;
      lines.push(T('Como humano, ganas Inspiración heroica.', 'As a Human, you gain Heroic Inspiration.'));
    }
    lines.push(T('PG al máximo, Dados de Golpe, espacios de conjuro y recursos recuperados.', 'HP to maximum; Hit Point Dice, spell slots and resources recovered.'));
  }
  return done(c, lines);
}

/** Avanza una ronda: reduce duraciones, reinicia la economía de acciones. */
export function nextRound(input: Character): ApplyResult {
  const c = clone(input);
  const lines: string[] = [];
  c.combat.round += 1;
  c.combat.action = false;
  c.combat.bonus = false;
  c.combat.reaction = false;
  c.combat.movementUsed = 0;
  lines.push(T(`🔁 Ronda ${c.combat.round}. Tienes de nuevo acción, acción adicional, reacción y movimiento.`, `🔁 Round ${c.combat.round}. You have your action, bonus action, reaction and movement again.`));
  const expired: Effect[] = [];
  c.effects = c.effects.filter((e) => {
    if (e.roundsLeft === null) return true;
    e.roundsLeft -= 1;
    if (e.roundsLeft <= 0) {
      expired.push(e);
      return false;
    }
    return true;
  });
  if (expired.length) {
    lines.push(T(`⏳ Terminan: ${expired.map(effectName).join(', ')}.`, `⏳ Ending: ${expired.map(effectName).join(', ')}.`));
    if (c.concentratingOn && expired.some((x) => effectMatches(x, c.concentratingOn!))) c.concentratingOn = null;
  }
  for (const e of c.effects) if (e.roundsLeft !== null && e.roundsLeft <= 2) lines.push(T(`${effectName(e)}: quedan ${e.roundsLeft} ronda(s).`, `${effectName(e)}: ${e.roundsLeft} round(s) left.`));
  if (c.effects.some((e) => e.presetId === 'furia')) lines.push(T('Furia: recuerda atacar, forzar una salvación o usar tu acción adicional para mantenerla.', 'Rage: remember to attack, force a save or use a Bonus Action to keep it going.'));
  if (c.effects.some((e) => e.presetId === 'heroismo')) lines.push(T('Heroísmo: ganas PG temporales iguales al mod. de lanzamiento.', 'Heroism: gain Temporary HP equal to the spellcasting modifier.'));
  const dying = c.hp.current === 0 && !c.stable && !c.dead;
  if (dying) lines.push(T('Estás a 0 PG: tira tu salvación contra la muerte.', 'You are at 0 HP: make your Death Saving Throw.'));
  return { char: c, lines, quickRolls: dying ? [{ label: T('Salvación contra la muerte', 'Death Saving Throw'), expr: 'deathsave' }] : [] };
}

export function deathSave(input: Character, roll?: number | null): ApplyResult {
  const c = clone(input);
  const lines: string[] = [];
  if (c.hp.current > 0 || c.dead || c.stable) return done(input, [T('No necesitas tirar salvaciones contra la muerte ahora.', 'You don’t need to make Death Saving Throws right now.')]);
  const r = roll ?? 1 + Math.floor(Math.random() * 20);
  lines.push(T(`💀 Salvación contra la muerte: ${r}.`, `💀 Death Saving Throw: ${r}.`));
  if (r === 20) {
    c.hp.current = 1;
    c.deathSaves = { success: 0, fail: 0 };
    c.conditions = c.conditions.filter((x) => x !== 'inconsciente');
    lines.push(T('¡20 natural! Recuperas 1 PG y la consciencia.', 'Natural 20! You regain 1 HP and consciousness.'));
  } else if (r === 1) {
    c.deathSaves.fail = Math.min(3, c.deathSaves.fail + 2);
    lines.push(T(`1 natural: dos fallos (${c.deathSaves.fail}/3).`, `Natural 1: two failures (${c.deathSaves.fail}/3).`));
  } else if (r >= 10) {
    c.deathSaves.success += 1;
    lines.push(T(`Éxito (${c.deathSaves.success}/3).`, `Success (${c.deathSaves.success}/3).`));
  } else {
    c.deathSaves.fail += 1;
    lines.push(T(`Fallo (${c.deathSaves.fail}/3).`, `Failure (${c.deathSaves.fail}/3).`));
  }
  if (c.deathSaves.fail >= 3) {
    c.dead = true;
    lines.push(T('☠️ Tres fallos: tu personaje muere.', '☠️ Three failures: your character dies.'));
  } else if (c.deathSaves.success >= 3) {
    c.stable = true;
    c.deathSaves = { success: 0, fail: 0 };
    lines.push(T('Tres éxitos: estás Estable (sigues inconsciente a 0 PG).', 'Three successes: you are Stable (still unconscious at 0 HP).'));
  }
  return done(c, lines);
}

export function applyCommand(input: Character, cmd: Command): ApplyResult {
  switch (cmd.type) {
    case 'damage':
      return applyDamage(input, cmd);
    case 'heal': {
      if (cmd.dice) {
        const r = rollExpr(cmd.dice);
        const res = applyHeal(input, r.total, cmd.source);
        res.lines.unshift(`🎲 ${cmd.dice}: ${r.text} = ${r.total}`);
        return res;
      }
      return applyHeal(input, cmd.amount ?? 0, cmd.source);
    }
    case 'tempHp': {
      const c = clone(input);
      if (cmd.amount > c.hp.temp) {
        const before = c.hp.temp;
        c.hp.temp = cmd.amount;
        return done(c, [T(`🛡️ PG temporales: ${before} → ${c.hp.temp}. (No se suman: te quedas con el mayor.)`, `🛡️ Temporary HP: ${before} → ${c.hp.temp}. (They don’t stack: you keep the higher.)`)]);
      }
      return done(input, [T(`Ya tienes ${c.hp.temp} PG temporales; no se acumulan, conservas los actuales.`, `You already have ${c.hp.temp} Temporary HP; they don’t stack, so you keep them.`)]);
    }
    case 'addCondition': {
      const c = clone(input);
      const info = CONDITIONS.find((x) => x.id === cmd.condition)!;
      if (cmd.condition === 'envenenado' && c.conditions.includes('petrificado')) return done(input, [T('Petrificado: eres inmune a Envenenado.', 'Petrified: you are immune to Poisoned.')]);
      if (cmd.condition === 'asustado' && c.effects.some((e) => e.presetId === 'heroismo')) return done(input, [T('Heroísmo: eres inmune a Asustado.', 'Heroism: you are immune to Frightened.')]);
      const lines = [T(`➕ Ahora estás ${L(info.name)}.`, `➕ You are now ${L(info.name)}.`), ...info.effects.map((e) => `• ${L(e)}`)];
      addConditionTo(c, cmd.condition);
      if (['incapacitado', 'aturdido', 'paralizado', 'petrificado', 'inconsciente'].includes(cmd.condition)) {
        breakConcentration(c, lines, T(`${L(info.name)} incluye Incapacitado`, `${L(info.name)} includes Incapacitated`));
      }
      return done(c, lines);
    }
    case 'removeCondition': {
      const c = clone(input);
      const info = CONDITIONS.find((x) => x.id === cmd.condition)!;
      if (!c.conditions.includes(cmd.condition)) return done(input, [T(`No estabas ${L(info.name)}.`, `You weren’t ${L(info.name)}.`)]);
      c.conditions = c.conditions.filter((x) => x !== cmd.condition);
      const lines = [T(`➖ Ya no estás ${L(info.name)}.`, `➖ You are no longer ${L(info.name)}.`)];
      if (cmd.condition === 'derribado') {
        const half = Math.floor(input.speed / 2);
        lines.push(T(`Levantarte cuesta la mitad de tu velocidad (${half} pies).`, `Standing up costs half your Speed (${half} ft).`));
        c.combat.movementUsed += half;
      }
      return done(c, lines);
    }
    case 'addEffect': {
      const c = clone(input);
      const lines: string[] = [];
      let eff: Effect | null = cmd.presetId ? makeEffectFromPreset(cmd.presetId, cmd.rounds) : null;
      if (!eff) {
        eff = { id: uid(), name: cmd.name ?? T('Efecto', 'Effect'), kind: cmd.kind ?? 'buff', roundsLeft: cmd.rounds ?? null, concentration: false, mods: {}, notes: cmd.notes ?? '' };
      }
      if (eff.presetId === 'furia') {
        const rageBonus = c.level >= 16 ? 4 : c.level >= 9 ? 3 : 2;
        eff.mods.bonus = { damage: `+${rageBonus}` };
        const res = c.resources.find((r) => r.key === 'rage');
        if (res) {
          if (res.used >= res.max) lines.push(T('⚠️ No te quedan usos de Furia (lo aplico igualmente).', '⚠️ You have no Rage uses left (applying it anyway).'));
          else res.used += 1;
        }
        breakConcentration(c, lines, T('la Furia impide concentrarse', 'Rage prevents concentration'));
      }
      c.effects = c.effects.filter((e) => !(e.presetId && e.presetId === eff!.presetId));
      c.effects.push(eff);
      const rounds = eff.roundsLeft ? T(` (${eff.roundsLeft} rondas)`, ` (${eff.roundsLeft} rounds)`) : '';
      lines.unshift(`✨ ${eff.kind === 'buff' ? T('Beneficio', 'Buff') : T('Perjuicio', 'Debuff')}: ${effectName(eff)}${rounds}.`);
      const notes = effectNotes(eff);
      if (notes) lines.push(notes);
      if (eff.mods.maxHp) {
        c.hp.current += eff.mods.maxHp;
        lines.push(T(`PG máximos y actuales +${eff.mods.maxHp}.`, `Maximum and current HP +${eff.mods.maxHp}.`));
      }
      return done(c, lines);
    }
    case 'removeEffect': {
      const c = clone(input);
      const n = cmd.name.toLowerCase();
      const found = c.effects.find((e) => effectMatches(e, n) || e.name.toLowerCase().includes(n) || effectName(e).toLowerCase().includes(n)
        || (e.presetId && EFFECT_PRESETS.find((p) => p.id === e.presetId)?.aliases.some((a) => n.includes(a))));
      if (!found) return done(input, [T(`No encuentro el efecto "${cmd.name}".`, `I can’t find the effect "${cmd.name}".`)]);
      c.effects = c.effects.filter((e) => e !== found);
      if (found.mods.maxHp) c.hp.current = Math.min(c.hp.current, maxHp(c));
      if (c.concentratingOn && effectMatches(found, c.concentratingOn)) c.concentratingOn = null;
      return done(c, [T(`Termina ${effectName(found)}.`, `${effectName(found)} ends.`)]);
    }
    case 'rest':
      return applyRest(input, cmd.kind, cmd.hitDice ?? 0);
    case 'useSlot': {
      const c = clone(input);
      if (c.pactSlots && (c.slots.every((s) => s.max === 0) || cmd.level === c.pactSlots.level)) {
        if (c.pactSlots.used >= c.pactSlots.max) return done(input, [T('⚠️ No te quedan espacios de pacto.', '⚠️ You have no Pact Magic slots left.')]);
        c.pactSlots.used += 1;
        return done(c, [T(`Gastas un espacio de pacto (nivel ${c.pactSlots.level}). Quedan ${c.pactSlots.max - c.pactSlots.used}.`, `You spend a Pact Magic slot (level ${c.pactSlots.level}). ${c.pactSlots.max - c.pactSlots.used} left.`)]);
      }
      const s = c.slots[cmd.level - 1];
      if (!s || s.max === 0) return done(input, [T(`No tienes espacios de nivel ${cmd.level}.`, `You have no level ${cmd.level} slots.`)]);
      if (s.used >= s.max) return done(input, [T(`⚠️ No te quedan espacios de nivel ${cmd.level}.`, `⚠️ You have no level ${cmd.level} slots left.`)]);
      s.used += 1;
      return done(c, [T(`🔮 Gastas un espacio de nivel ${cmd.level}. Quedan ${s.max - s.used}/${s.max}.`, `🔮 You spend a level ${cmd.level} slot. ${s.max - s.used}/${s.max} left.`)]);
    }
    case 'rollSave': {
      const r = rollD20(input, { kind: 'save', ability: cmd.ability }, saveBonus(input, cmd.ability), T(`Salvación de ${abilityShort(cmd.ability)}`, `${abilityShort(cmd.ability)} save`));
      return done(input, r.lines);
    }
    case 'rollSkill': {
      const s = SKILLS.find((x) => x.id === cmd.skill)!;
      const r = rollD20(input, { kind: 'check', ability: s.ability, skill: s.id }, skillBonus(input, s.id), `${L(s.name)} (${abilityShort(s.ability)})`);
      return done(input, r.lines);
    }
    case 'rollAbility': {
      const r = rollD20(input, { kind: 'check', ability: cmd.ability }, abilityMods(input)[cmd.ability], T(`Prueba de ${abilityName(cmd.ability)}`, `${abilityName(cmd.ability)} check`));
      return done(input, r.lines);
    }
    case 'rollInitiative': {
      const c = clone(input);
      const r = rollD20(input, { kind: 'initiative' }, abilityMods(input).dex, T('Iniciativa', 'Initiative'));
      c.combat.initiative = r.total;
      return done(c, r.lines);
    }
    case 'rollDice': {
      const r = rollExpr(cmd.expr);
      return done(input, [`🎲 ${cmd.expr}: ${r.text} = ${r.total}`]);
    }
    case 'exhaustion': {
      const c = clone(input);
      c.exhaustion = Math.max(0, Math.min(6, c.exhaustion + cmd.delta));
      const lines = [T(`Agotamiento: ${input.exhaustion} → ${c.exhaustion}.`, `Exhaustion: ${input.exhaustion} → ${c.exhaustion}.`)];
      if (c.exhaustion >= 6) {
        c.dead = true;
        lines.push(T('☠️ Con 6 niveles de agotamiento, mueres.', '☠️ At 6 levels of Exhaustion, you die.'));
      } else if (c.exhaustion > 0) {
        lines.push(T(`−${2 * c.exhaustion} a pruebas d20 y −${5 * c.exhaustion} pies de velocidad.`, `−${2 * c.exhaustion} to D20 Tests and −${5 * c.exhaustion} ft Speed.`));
      }
      return done(c, lines);
    }
    case 'deathSave':
      return deathSave(input, cmd.roll);
    case 'nextRound':
      return nextRound(input);
    case 'endConcentration': {
      const c = clone(input);
      const lines: string[] = [];
      if (!c.concentratingOn) return done(input, [T('No estabas concentrado en nada.', 'You weren’t concentrating on anything.')]);
      breakConcentration(c, lines, T('decidido por ti o por una tirada fallida', 'by your choice or a failed save'));
      return done(c, lines);
    }
    case 'concentrate': {
      const c = clone(input);
      const lines: string[] = [];
      if (c.effects.some((e) => e.presetId === 'furia')) return done(input, [T('⚠️ No puedes concentrarte mientras estás en Furia.', '⚠️ You can’t concentrate while raging.')]);
      if (c.concentratingOn) breakConcentration(c, lines, T(`empiezas a concentrarte en ${cmd.spell}`, `you start concentrating on ${cmd.spell}`));
      c.concentratingOn = cmd.spell;
      lines.push(T(`🧠 Te concentras en ${cmd.spell}.`, `🧠 You concentrate on ${cmd.spell}.`));
      return done(c, lines);
    }
    case 'inspiration': {
      const c = clone(input);
      c.heroicInspiration = cmd.value;
      return done(c, [cmd.value
        ? T('⭐ Ganas Inspiración heroica.', '⭐ You gain Heroic Inspiration.')
        : T('Gastas tu Inspiración heroica: repite la tirada y usa el nuevo resultado.', 'You spend Heroic Inspiration: reroll and use the new result.')]);
    }
    case 'useResource': {
      const c = clone(input);
      const r = findResource(c, cmd.name);
      if (!r) return done(input, [T(`No encuentro el recurso "${cmd.name}".`, `I can’t find the resource "${cmd.name}".`)]);
      const amt = cmd.amount ?? 1;
      if (r.used + amt > r.max) return done(input, [T(`⚠️ No te quedan suficientes usos de ${resourceName(r)} (${r.max - r.used}/${r.max}).`, `⚠️ Not enough uses of ${resourceName(r)} left (${r.max - r.used}/${r.max}).`)]);
      r.used += amt;
      return done(c, [T(`Usas ${resourceName(r)}: quedan ${r.max - r.used}/${r.max}.`, `You use ${resourceName(r)}: ${r.max - r.used}/${r.max} left.`)]);
    }
    case 'info':
      return done(input, [cmd.text]);
  }
}

/** Ejecuta un "quick roll" sugerido por el motor (salvación de concentración, salvación de muerte...). */
export function runQuickRoll(c: Character, expr: string): ApplyResult {
  if (expr === 'deathsave') return deathSave(c);
  if (expr.startsWith('concentration:')) {
    const dc = Number(expr.split(':')[1]);
    const r = rollD20(c, { kind: 'save', ability: 'con' }, saveBonus(c, 'con'), T('Salvación de CON (concentración)', 'CON save (concentration)'));
    const lines = [...r.lines];
    if (r.total >= dc) {
      lines.push(T(`✅ Supera CD ${dc}: mantienes la concentración.`, `✅ Beats DC ${dc}: you keep concentrating.`));
      return done(c, lines);
    }
    lines.push(T(`❌ No supera CD ${dc}.`, `❌ Fails DC ${dc}.`));
    const res = applyCommand(c, { type: 'endConcentration' });
    return done(res.char, [...lines, ...res.lines]);
  }
  return applyCommand(c, { type: 'rollDice', expr });
}
