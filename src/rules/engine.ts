import type { Ability, Character, ConditionId, DamageType, Effect } from '../types';
import {
  armorClass, abilityMods, damageDefenses, fmt, maxHp, rollD20, rollExpr, saveBonus, skillBonus,
} from './calc';
import { ABILITIES, CONDITIONS, EFFECT_PRESETS, SKILLS, abilityShort, damageTypeName } from './srd';

export type Command =
  | { type: 'damage'; amount: number; damageType?: DamageType | null; source?: string | null; attackRoll?: number | null; critical?: boolean }
  | { type: 'heal'; amount?: number | null; dice?: string | null; source?: string | null }
  | { type: 'tempHp'; amount: number }
  | { type: 'addCondition'; condition: ConditionId }
  | { type: 'removeCondition'; condition: ConditionId }
  | { type: 'addEffect'; presetId?: string | null; name?: string | null; rounds?: number | null; notes?: string | null }
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

export function makeEffectFromPreset(presetId: string, rounds?: number | null): Effect | null {
  const p = EFFECT_PRESETS.find((x) => x.id === presetId);
  if (!p) return null;
  return {
    id: uid(),
    name: p.name,
    kind: p.kind,
    roundsLeft: rounds ?? p.rounds,
    concentration: p.concentration,
    mods: structuredClone(p.mods),
    notes: p.notes,
    presetId: p.id,
  };
}

function breakConcentration(c: Character, lines: string[], reason: string) {
  if (!c.concentratingOn) return;
  const spell = c.concentratingOn;
  c.concentratingOn = null;
  c.effects = c.effects.filter((e) => !(e.concentration && e.name.toLowerCase() === spell.toLowerCase()));
  lines.push(`💥 Pierdes la concentración en ${spell} (${reason}).`);
}

function addConditionTo(c: Character, cond: ConditionId) {
  if (!c.conditions.includes(cond)) c.conditions.push(cond);
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
      lines.push(`🛡️ ${src}tirada de ataque ${cmd.attackRoll} contra tu CA ${ac}: ¡falla! No recibes daño.`);
      lines.push('Si tu DM dice que impacta igualmente (p. ej. porque hay un efecto que no tengo en cuenta), escribe solo el daño.');
      return { char: input, lines, quickRolls };
    }
    lines.push(`${src}tirada de ataque ${cmd.attackRoll} contra tu CA ${ac}: impacta.`);
  }

  if (c.dead) {
    lines.push('Tu personaje ya está muerto.');
    return { char: input, lines, quickRolls };
  }

  let dmg = Math.max(0, Math.floor(cmd.amount));
  const typeName = cmd.damageType ? damageTypeName(cmd.damageType).toLowerCase() : 'sin tipo';
  lines.push(`⚔️ ${src}${dmg} de daño ${typeName}${cmd.critical ? ' (crítico)' : ''}.`);

  const def = damageDefenses(c);
  if (cmd.damageType && def.immune.has(cmd.damageType)) {
    lines.push(`Eres inmune al daño ${typeName}: 0 de daño.`);
    return { char: c, lines, quickRolls };
  }
  if ((cmd.damageType && def.resist.has(cmd.damageType)) || def.resistAll) {
    const why = c.effects.find((e) => cmd.damageType && e.mods.resist?.includes(cmd.damageType))?.name ?? (def.resistAll ? 'Petrificado' : 'rasgo');
    const before = dmg;
    dmg = Math.floor(dmg / 2);
    lines.push(`Resistencia (${why}): ${before} → ${dmg}.`);
  }
  if (cmd.damageType && def.vuln.has(cmd.damageType)) {
    const before = dmg;
    dmg *= 2;
    lines.push(`Vulnerabilidad: ${before} → ${dmg}.`);
  }

  const mhp = maxHp(c);
  const original = dmg;

  // Ya a 0 PG
  if (c.hp.current === 0) {
    if (dmg >= mhp) {
      c.dead = true;
      lines.push(`☠️ Recibes ${dmg} de daño estando a 0 PG, igual o más que tus PG máximos (${mhp}): mueres.`);
      return { char: c, lines, quickRolls };
    }
    if (dmg > 0) {
      const fails = cmd.critical ? 2 : 1;
      c.stable = false;
      c.deathSaves.fail = Math.min(3, c.deathSaves.fail + fails);
      lines.push(`A 0 PG: ${fails} fallo${fails > 1 ? 's' : ''} de salvación contra la muerte (${c.deathSaves.fail}/3).`);
      if (c.deathSaves.fail >= 3) {
        c.dead = true;
        lines.push('☠️ Tres fallos: tu personaje muere.');
      }
    }
    return { char: c, lines, quickRolls };
  }

  if (c.hp.temp > 0 && dmg > 0) {
    const absorbed = Math.min(c.hp.temp, dmg);
    c.hp.temp -= absorbed;
    dmg -= absorbed;
    lines.push(`PG temporales absorben ${absorbed} (quedan ${c.hp.temp}).`);
  }

  const before = c.hp.current;
  const remaining = dmg - before;
  c.hp.current = Math.max(0, before - dmg);
  lines.push(`PG: ${before} → ${c.hp.current} / ${mhp}.`);

  if (c.hp.current === 0) {
    if (remaining >= mhp) {
      c.dead = true;
      lines.push(`☠️ Daño sobrante (${remaining}) ≥ PG máximos (${mhp}): muerte instantánea.`);
      return { char: c, lines, quickRolls };
    }
    lines.push('Caes a 0 PG: quedas Inconsciente. Al inicio de tus turnos tira salvaciones contra la muerte.');
    addConditionTo(c, 'inconsciente');
    addConditionTo(c, 'derribado');
    c.deathSaves = { success: 0, fail: 0 };
    c.stable = false;
    breakConcentration(c, lines, 'quedas inconsciente');
    const rage = c.effects.find((e) => e.presetId === 'furia');
    if (rage) {
      c.effects = c.effects.filter((e) => e !== rage);
      lines.push('Tu Furia termina al quedar inconsciente.');
    }
    quickRolls.push({ label: 'Salvación contra la muerte', expr: 'deathsave' });
  } else if (c.concentratingOn && original > 0) {
    const dc = Math.min(30, Math.max(10, Math.floor(original / 2)));
    const b = saveBonus(c, 'con');
    lines.push(`🧠 Concentración en ${c.concentratingOn}: salvación de CON CD ${dc} (tu bonificador ${fmt(b)}).`);
    quickRolls.push({ label: `Salvación CON (CD ${dc})`, expr: `concentration:${dc}` });
  }
  if (c.hp.current > 0 && c.hp.current <= Math.floor(mhp / 4)) lines.push('⚠️ Estás por debajo del 25 % de tus PG.');
  return { char: c, lines, quickRolls };
}

export function applyHeal(input: Character, amount: number, source?: string | null): ApplyResult {
  const c = clone(input);
  const lines: string[] = [];
  if (c.dead) return { char: input, lines: ['Un personaje muerto no puede curarse con curación normal (necesita revivir).'], quickRolls: [] };
  const mhp = maxHp(c);
  const before = c.hp.current;
  c.hp.current = Math.min(mhp, before + Math.max(0, amount));
  lines.push(`💚 ${source ? source + ': ' : ''}curas ${amount}. PG: ${before} → ${c.hp.current} / ${mhp}.`);
  if (before === 0 && c.hp.current > 0) {
    c.conditions = c.conditions.filter((x) => x !== 'inconsciente');
    c.deathSaves = { success: 0, fail: 0 };
    c.stable = false;
    lines.push('Recuperas la consciencia (sigues Derribado hasta que te levantes gastando la mitad de tu movimiento).');
  }
  return { char: c, lines, quickRolls: [] };
}

export function applyRest(input: Character, kind: 'short' | 'long', hitDice = 0): ApplyResult {
  const c = clone(input);
  const lines: string[] = [];
  if (kind === 'short') {
    lines.push('⛺ Descanso corto (1 hora).');
    const con = abilityMods(c).con;
    const available = c.level - c.hitDiceSpent;
    const n = Math.min(hitDice, available);
    let healed = 0;
    for (let i = 0; i < n; i++) {
      const r = rollExpr(`1d${c.hitDie}`);
      healed += Math.max(0, r.total + con);
    }
    if (n > 0) {
      c.hitDiceSpent += n;
      const before = c.hp.current;
      c.hp.current = Math.min(maxHp(c), c.hp.current + healed);
      lines.push(`Gastas ${n} Dado(s) de Golpe (d${c.hitDie} ${fmt(con)}): +${healed} PG (${before} → ${c.hp.current}).`);
    } else {
      lines.push(`No gastas Dados de Golpe (disponibles: ${available}). Escribe "descanso corto gastando 2 dados" para usarlos.`);
    }
    for (const r of c.resources) {
      if (r.recovers === 'short' && r.used > 0) {
        r.used = 0;
        lines.push(`Recuperas ${r.name}.`);
      }
    }
    // En 2024 algunas capacidades recuperan un uso en descanso corto
    for (const r of c.resources) {
      if (r.recovers === 'long' && r.used > 0 && ['Furia', 'Tomar aliento', 'Canalizar divinidad', 'Forma salvaje'].includes(r.name)) {
        r.used -= 1;
        lines.push(`Recuperas 1 uso de ${r.name}.`);
      }
    }
    if (c.pactSlots && c.pactSlots.used > 0) {
      c.pactSlots.used = 0;
      lines.push('Recuperas tus espacios de Magia del pacto.');
    }
  } else {
    lines.push('🌙 Descanso largo (8 horas).');
    c.hp.current = maxHp(c);
    c.hp.temp = 0;
    c.hitDiceSpent = 0;
    c.slots.forEach((s) => (s.used = 0));
    if (c.pactSlots) c.pactSlots.used = 0;
    c.resources.forEach((r) => (r.used = 0));
    c.deathSaves = { success: 0, fail: 0 };
    c.stable = false;
    c.conditions = c.conditions.filter((x) => x !== 'inconsciente');
    c.effects = c.effects.filter((e) => e.roundsLeft === null && !e.concentration && e.presetId !== 'ayuda' && e.presetId !== 'armadura_mago');
    c.concentratingOn = null;
    if (c.exhaustion > 0) {
      c.exhaustion -= 1;
      lines.push(`Agotamiento reducido a ${c.exhaustion}.`);
    }
    if (/humano/i.test(c.species) && !c.heroicInspiration) {
      c.heroicInspiration = true;
      lines.push('Como humano, ganas Inspiración heroica.');
    }
    lines.push('PG al máximo, Dados de Golpe, espacios de conjuro y recursos recuperados.');
  }
  return { char: c, lines, quickRolls: [] };
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
  lines.push(`🔁 Ronda ${c.combat.round}. Tienes de nuevo acción, acción adicional, reacción y movimiento.`);
  const expired: string[] = [];
  c.effects = c.effects.filter((e) => {
    if (e.roundsLeft === null) return true;
    e.roundsLeft -= 1;
    if (e.roundsLeft <= 0) {
      expired.push(e.name);
      return false;
    }
    return true;
  });
  if (expired.length) {
    lines.push(`⏳ Terminan: ${expired.join(', ')}.`);
    if (c.concentratingOn && expired.some((x) => x.toLowerCase() === c.concentratingOn!.toLowerCase())) c.concentratingOn = null;
  }
  for (const e of c.effects) if (e.roundsLeft !== null && e.roundsLeft <= 2) lines.push(`${e.name}: quedan ${e.roundsLeft} ronda(s).`);
  if (c.effects.some((e) => e.presetId === 'furia')) lines.push('Furia: recuerda atacar, forzar una salvación o usar tu acción adicional para mantenerla.');
  if (c.effects.some((e) => e.presetId === 'heroismo')) lines.push('Heroísmo: ganas PG temporales iguales a tu mod. de lanzamiento.');
  if (c.hp.current === 0 && !c.stable && !c.dead) lines.push('Estás a 0 PG: tira tu salvación contra la muerte.');
  return { char: c, lines, quickRolls: c.hp.current === 0 && !c.stable && !c.dead ? [{ label: 'Salvación contra la muerte', expr: 'deathsave' }] : [] };
}

export function deathSave(input: Character, roll?: number | null): ApplyResult {
  const c = clone(input);
  const lines: string[] = [];
  if (c.hp.current > 0 || c.dead || c.stable) return { char: input, lines: ['No necesitas tirar salvaciones contra la muerte ahora.'], quickRolls: [] };
  const r = roll ?? 1 + Math.floor(Math.random() * 20);
  lines.push(`💀 Salvación contra la muerte: ${r}.`);
  if (r === 20) {
    c.hp.current = 1;
    c.deathSaves = { success: 0, fail: 0 };
    c.conditions = c.conditions.filter((x) => x !== 'inconsciente');
    lines.push('¡20 natural! Recuperas 1 PG y la consciencia.');
  } else if (r === 1) {
    c.deathSaves.fail = Math.min(3, c.deathSaves.fail + 2);
    lines.push(`1 natural: dos fallos (${c.deathSaves.fail}/3).`);
  } else if (r >= 10) {
    c.deathSaves.success += 1;
    lines.push(`Éxito (${c.deathSaves.success}/3).`);
  } else {
    c.deathSaves.fail += 1;
    lines.push(`Fallo (${c.deathSaves.fail}/3).`);
  }
  if (c.deathSaves.fail >= 3) {
    c.dead = true;
    lines.push('☠️ Tres fallos: tu personaje muere.');
  } else if (c.deathSaves.success >= 3) {
    c.stable = true;
    c.deathSaves = { success: 0, fail: 0 };
    lines.push('Tres éxitos: estás Estable (sigues inconsciente a 0 PG).');
  }
  return { char: c, lines, quickRolls: [] };
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
        return { char: c, lines: [`🛡️ PG temporales: ${before} → ${c.hp.temp}. (No se suman: te quedas con el mayor.)`], quickRolls: [] };
      }
      return { char: input, lines: [`Ya tienes ${c.hp.temp} PG temporales; los PG temporales no se acumulan, conservas los actuales.`], quickRolls: [] };
    }
    case 'addCondition': {
      const c = clone(input);
      const info = CONDITIONS.find((x) => x.id === cmd.condition)!;
      const lines = [`➕ Ahora estás ${info.name}.`, ...info.effects.map((e) => `• ${e}`)];
      if (cmd.condition === 'envenenado' && c.conditions.includes('petrificado')) return { char: input, lines: ['Petrificado: eres inmune a Envenenado.'], quickRolls: [] };
      if (cmd.condition === 'asustado' && c.effects.some((e) => e.presetId === 'heroismo')) return { char: input, lines: ['Heroísmo: eres inmune a Asustado.'], quickRolls: [] };
      addConditionTo(c, cmd.condition);
      if (['incapacitado', 'aturdido', 'paralizado', 'petrificado', 'inconsciente'].includes(cmd.condition)) {
        breakConcentration(c, lines, `${info.name} incluye Incapacitado`);
      }
      return { char: c, lines, quickRolls: [] };
    }
    case 'removeCondition': {
      const c = clone(input);
      const info = CONDITIONS.find((x) => x.id === cmd.condition)!;
      if (!c.conditions.includes(cmd.condition)) return { char: input, lines: [`No estabas ${info.name}.`], quickRolls: [] };
      c.conditions = c.conditions.filter((x) => x !== cmd.condition);
      const lines = [`➖ Ya no estás ${info.name}.`];
      if (cmd.condition === 'derribado') {
        lines.push(`Levantarte cuesta la mitad de tu velocidad (${Math.floor(input.speed / 2)} pies).`);
        c.combat.movementUsed += Math.floor(input.speed / 2);
      }
      return { char: c, lines, quickRolls: [] };
    }
    case 'addEffect': {
      const c = clone(input);
      const lines: string[] = [];
      let eff: Effect | null = cmd.presetId ? makeEffectFromPreset(cmd.presetId, cmd.rounds) : null;
      if (!eff) {
        eff = { id: uid(), name: cmd.name ?? 'Efecto', kind: 'buff', roundsLeft: cmd.rounds ?? null, concentration: false, mods: {}, notes: cmd.notes ?? '' };
      }
      if (eff.presetId === 'furia') {
        const rageBonus = c.level >= 16 ? 4 : c.level >= 9 ? 3 : 2;
        eff.mods.bonus = { damage: `+${rageBonus}` };
        const res = c.resources.find((r) => r.name === 'Furia');
        if (res) {
          if (res.used >= res.max) lines.push('⚠️ No te quedan usos de Furia (lo aplico igualmente).');
          else res.used += 1;
        }
        breakConcentration(c, lines, 'la Furia impide concentrarse');
      }
      c.effects = c.effects.filter((e) => !(e.presetId && e.presetId === eff!.presetId));
      c.effects.push(eff);
      lines.unshift(`✨ ${eff.kind === 'buff' ? 'Beneficio' : 'Perjuicio'}: ${eff.name}${eff.roundsLeft ? ` (${eff.roundsLeft} rondas)` : ''}.`);
      if (eff.notes) lines.push(eff.notes);
      if (eff.mods.maxHp) {
        c.hp.current += eff.mods.maxHp;
        lines.push(`PG máximos y actuales +${eff.mods.maxHp}.`);
      }
      return { char: c, lines, quickRolls: [] };
    }
    case 'removeEffect': {
      const c = clone(input);
      const n = cmd.name.toLowerCase();
      const found = c.effects.find((e) => e.name.toLowerCase().includes(n) || (e.presetId && EFFECT_PRESETS.find((p) => p.id === e.presetId)?.aliases.some((a) => n.includes(a))));
      if (!found) return { char: input, lines: [`No encuentro el efecto "${cmd.name}".`], quickRolls: [] };
      c.effects = c.effects.filter((e) => e !== found);
      if (found.mods.maxHp) c.hp.current = Math.min(c.hp.current, maxHp(c));
      if (c.concentratingOn && c.concentratingOn.toLowerCase() === found.name.toLowerCase()) c.concentratingOn = null;
      return { char: c, lines: [`Termina ${found.name}.`], quickRolls: [] };
    }
    case 'rest':
      return applyRest(input, cmd.kind, cmd.hitDice ?? 0);
    case 'useSlot': {
      const c = clone(input);
      if (c.pactSlots && (c.slots.length === 0 || cmd.level === c.pactSlots.level)) {
        if (c.pactSlots.used >= c.pactSlots.max) return { char: input, lines: ['⚠️ No te quedan espacios de pacto.'], quickRolls: [] };
        c.pactSlots.used += 1;
        return { char: c, lines: [`Gastas un espacio de pacto (nivel ${c.pactSlots.level}). Quedan ${c.pactSlots.max - c.pactSlots.used}.`], quickRolls: [] };
      }
      const s = c.slots[cmd.level - 1];
      if (!s || s.max === 0) return { char: input, lines: [`No tienes espacios de nivel ${cmd.level}.`], quickRolls: [] };
      if (s.used >= s.max) return { char: input, lines: [`⚠️ No te quedan espacios de nivel ${cmd.level}.`], quickRolls: [] };
      s.used += 1;
      return { char: c, lines: [`🔮 Gastas un espacio de nivel ${cmd.level}. Quedan ${s.max - s.used}/${s.max}.`], quickRolls: [] };
    }
    case 'rollSave': {
      const r = rollD20(input, { kind: 'save', ability: cmd.ability }, saveBonus(input, cmd.ability), `Salvación de ${abilityShort(cmd.ability)}`);
      return { char: input, lines: r.lines, quickRolls: [] };
    }
    case 'rollSkill': {
      const s = SKILLS.find((x) => x.id === cmd.skill)!;
      const r = rollD20(input, { kind: 'check', ability: s.ability, skill: s.id }, skillBonus(input, s.id), `${s.name} (${abilityShort(s.ability)})`);
      return { char: input, lines: r.lines, quickRolls: [] };
    }
    case 'rollAbility': {
      const r = rollD20(input, { kind: 'check', ability: cmd.ability }, abilityMods(input)[cmd.ability], `Prueba de ${ABILITIES.find((a) => a.id === cmd.ability)!.name}`);
      return { char: input, lines: r.lines, quickRolls: [] };
    }
    case 'rollInitiative': {
      const c = clone(input);
      const r = rollD20(input, { kind: 'initiative' }, abilityMods(input).dex, 'Iniciativa');
      c.combat.initiative = r.total;
      return { char: c, lines: r.lines, quickRolls: [] };
    }
    case 'rollDice': {
      const r = rollExpr(cmd.expr);
      return { char: input, lines: [`🎲 ${cmd.expr}: ${r.text} = ${r.total}`], quickRolls: [] };
    }
    case 'exhaustion': {
      const c = clone(input);
      c.exhaustion = Math.max(0, Math.min(6, c.exhaustion + cmd.delta));
      const lines = [`Agotamiento: ${input.exhaustion} → ${c.exhaustion}.`];
      if (c.exhaustion >= 6) {
        c.dead = true;
        lines.push('☠️ Con 6 niveles de agotamiento, mueres.');
      } else if (c.exhaustion > 0) {
        lines.push(`−${2 * c.exhaustion} a pruebas d20 y −${5 * c.exhaustion} pies de velocidad.`);
      }
      return { char: c, lines, quickRolls: [] };
    }
    case 'deathSave':
      return deathSave(input, cmd.roll);
    case 'nextRound':
      return nextRound(input);
    case 'endConcentration': {
      const c = clone(input);
      const lines: string[] = [];
      if (!c.concentratingOn) return { char: input, lines: ['No estabas concentrado en nada.'], quickRolls: [] };
      breakConcentration(c, lines, 'decidido por ti o por una tirada fallida');
      return { char: c, lines, quickRolls: [] };
    }
    case 'concentrate': {
      const c = clone(input);
      const lines: string[] = [];
      if (c.effects.some((e) => e.presetId === 'furia')) return { char: input, lines: ['⚠️ No puedes concentrarte mientras estás en Furia.'], quickRolls: [] };
      if (c.concentratingOn) breakConcentration(c, lines, `empiezas a concentrarte en ${cmd.spell}`);
      c.concentratingOn = cmd.spell;
      lines.push(`🧠 Te concentras en ${cmd.spell}.`);
      return { char: c, lines, quickRolls: [] };
    }
    case 'inspiration': {
      const c = clone(input);
      c.heroicInspiration = cmd.value;
      return { char: c, lines: [cmd.value ? '⭐ Ganas Inspiración heroica.' : 'Gastas tu Inspiración heroica: repite la tirada y usa el nuevo resultado.'], quickRolls: [] };
    }
    case 'useResource': {
      const c = clone(input);
      const r = c.resources.find((x) => x.name.toLowerCase().includes(cmd.name.toLowerCase()));
      if (!r) return { char: input, lines: [`No encuentro el recurso "${cmd.name}".`], quickRolls: [] };
      const amt = cmd.amount ?? 1;
      if (r.used + amt > r.max) return { char: input, lines: [`⚠️ No te quedan suficientes usos de ${r.name} (${r.max - r.used}/${r.max}).`], quickRolls: [] };
      r.used += amt;
      return { char: c, lines: [`Usas ${r.name}: quedan ${r.max - r.used}/${r.max}.`], quickRolls: [] };
    }
    case 'info':
      return { char: input, lines: [cmd.text], quickRolls: [] };
  }
}

/** Ejecuta un "quick roll" sugerido por el motor (salvación de concentración, salvación de muerte...). */
export function runQuickRoll(c: Character, expr: string): ApplyResult {
  if (expr === 'deathsave') return deathSave(c);
  if (expr.startsWith('concentration:')) {
    const dc = Number(expr.split(':')[1]);
    const r = rollD20(c, { kind: 'save', ability: 'con' }, saveBonus(c, 'con'), 'Salvación de CON (concentración)');
    const lines = [...r.lines];
    if (r.total >= dc) {
      lines.push(`✅ Supera CD ${dc}: mantienes la concentración.`);
      return { char: c, lines, quickRolls: [] };
    }
    lines.push(`❌ No supera CD ${dc}.`);
    const res = applyCommand(c, { type: 'endConcentration' });
    return { char: res.char, lines: [...lines, ...res.lines], quickRolls: [] };
  }
  return applyCommand(c, { type: 'rollDice', expr });
}
