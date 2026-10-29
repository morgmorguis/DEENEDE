// Intérprete local (sin IA) de frases en español sobre lo que le pasa al personaje.
import type { Ability, Character, ConditionId, DamageType } from '../types';
import type { Command } from './engine';
import { ACTIONS, CONDITIONS, DAMAGE_TYPES, EFFECT_PRESETS, MASTERIES, RULES, SKILLS } from './srd';

export const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¿?¡!.,;:]/g, ' ').replace(/\s+/g, ' ').trim();

const NUM_WORDS: Record<string, number> = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20,
};

/** Convierte números escritos con letra ("siete de daño") a cifras. */
function wordsToDigits(s: string) {
  return s.replace(/\b(dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|diecisiete|dieciocho|diecinueve|veinte)\b/g, (w) => String(NUM_WORDS[w]));
}

const TYPE_RE = DAMAGE_TYPES.map((d) => norm(d.name)).join('|');

const ABILITY_WORDS: [RegExp, Ability][] = [
  [/\b(fuerza|fue|str)\b/, 'str'],
  [/\b(destreza|des|dex)\b/, 'dex'],
  [/\b(constitucion|con)\b/, 'con'],
  [/\b(inteligencia|int)\b/, 'int'],
  [/\b(sabiduria|sab|wis)\b/, 'wis'],
  [/\b(carisma|car|cha)\b/, 'cha'],
];

const CONDITION_WORDS: [RegExp, ConditionId][] = [
  [/\bagarrad[oa]s?\b|\bme agarra(n)?\b|\bme tiene agarrad/, 'agarrado'],
  [/\bapresad[oa]s?\b|\benredad[oa]\b|\batrapad[oa]\b|\bme apresa/, 'apresado'],
  [/\basustad[oa]\b|\baterrad[oa]\b|\bmiedo\b/, 'asustado'],
  [/\baturdid[oa]\b|\bme aturde/, 'aturdido'],
  [/\bcegad[oa]\b|\bciego\b|\bciega\b|\bme ciega/, 'cegado'],
  [/\bderribad[oa]\b|\btumbad[oa]\b|\ben el suelo\b|\bal suelo\b|\bme tira(n)? al suelo|\bme derriba/, 'derribado'],
  [/\bensordecid[oa]\b|\bsord[oa]\b/, 'ensordecido'],
  [/\benvenenad[oa]\b|\bme envenena/, 'envenenado'],
  [/\bhechizad[oa]\b|\bencantad[oa]\b|\bme hechiza/, 'hechizado'],
  [/\bincapacitad[oa]\b/, 'incapacitado'],
  [/\binconsciente\b/, 'inconsciente'],
  [/\binvisible\b/, 'invisible'],
  [/\bparalizad[oa]\b|\bme paraliza/, 'paralizado'],
  [/\bpetrificad[oa]\b/, 'petrificado'],
];

const NEGATION = /\b(ya no|dejo de|deja de|no estoy|se me pasa|se me quita|quita(r)?|me libero|me suelto|me suelta(n)?|sin|termina|se acaba|acaba|fin de|pierdo|se termina|me quito|elimina(r)?)\b/;

function sourceOf(t: string): string | null {
  const m = t.match(/\b(?:un|una|el|la|los|las|otro|otra)\s+([a-z]+(?:\s+(?!me\b|nos\b|te\b|le\b|ha\b|con\b|de\b|y\b)[a-z]+)?)\s+(?:me|nos|te)\b/);
  if (!m) return null;
  const name = m[1];
  if (/^(vez|ataque|golpe|flecha|conjuro|hechizo)$/.test(name)) return null;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function typeFromText(t: string): DamageType | null {
  // Primero los tipos de daño explícitos, después palabras asociadas (espada → cortante)
  for (const d of DAMAGE_TYPES) if (new RegExp(`\\b${norm(d.name)}\\b`).test(t)) return d.id;
  for (const d of DAMAGE_TYPES) for (const w of d.words) if (new RegExp(`\\b${norm(w)}\\b`).test(t)) return d.id;
  return null;
}

const POTIONS: [RegExp, string, string][] = [
  [/pocion de curacion suprema/, '10d4+20', 'Poción de curación suprema'],
  [/pocion de curacion superior/, '8d4+8', 'Poción de curación superior'],
  [/pocion de curacion mayor/, '4d4+4', 'Poción de curación mayor'],
  [/pocion( de curacion)?/, '2d4+2', 'Poción de curación'],
];

export interface ParseResult {
  commands: Command[];
  /** true si la frase parecía una pregunta de reglas */
  question: boolean;
}

export function parseInput(raw: string, c: Character): ParseResult {
  let t = wordsToDigits(norm(raw));
  const cmds: Command[] = [];

  // ---------- Preguntas de reglas ----------
  const q = t.match(/^(?:que|como|cuando|cuanto)\s+(?:hace|es|funciona|significa|afecta|me afecta|dura|hago con)\s+(?:el |la |los |las |estar |un |una )?(.+)$/);
  if (q || /^(info|ayuda sobre|explica(me)?|regla(s)? de)\b/.test(t)) {
    const topic = (q ? q[1] : t.replace(/^(info|ayuda sobre|explica(me)?|regla(s)? de)\s*/, '')).trim();
    const answer = lookupTopic(topic, c);
    if (answer) return { commands: [{ type: 'info', text: answer }], question: true };
  }

  // ---------- Descansos ----------
  if (/descanso corto|descansamos (un rato|una hora)/.test(t)) {
    const hd = t.match(/(\d+)\s*(?:dados?|dg)/);
    cmds.push({ type: 'rest', kind: 'short', hitDice: hd ? Number(hd[1]) : 0 });
    return { commands: cmds, question: false };
  }
  if (/descanso largo|dormimos|descansamos (toda la noche|8 horas)/.test(t)) {
    cmds.push({ type: 'rest', kind: 'long' });
    return { commands: cmds, question: false };
  }

  // ---------- Combate: rondas / iniciativa ----------
  if (/\b(nueva ronda|siguiente ronda|fin de (mi )?turno|termino (mi )?turno|nuevo turno|siguiente turno|empieza mi turno)\b/.test(t)) cmds.push({ type: 'nextRound' });
  if (/\b(tiro|tira|tirar|tirada de)?\s*iniciativa\b/.test(t) && !/que es/.test(t)) cmds.push({ type: 'rollInitiative' });

  // ---------- Salvaciones contra la muerte ----------
  const ds = t.match(/salvacion(?:es)? (?:contra (?:la )?|de )muerte(?:\D+(\d+))?/);
  if (ds) {
    cmds.push({ type: 'deathSave', roll: ds[1] ? Number(ds[1]) : null });
    return { commands: cmds, question: false };
  }

  // ---------- Tiradas ----------
  const save = t.match(/salvacion(?: de)? (\w+)/);
  if (save) {
    const ab = ABILITY_WORDS.find(([re]) => re.test(save[1]));
    if (ab && !/\bcd\b.*\bdano\b|\bme hace\b/.test(t)) cmds.push({ type: 'rollSave', ability: ab[1] });
  }
  if (/\b(tiro|tira|tirada|prueba|chequeo|check)\b/.test(t) && !save) {
    const skill = SKILLS.find((s) => new RegExp(`\\b${norm(s.name)}\\b`).test(t));
    if (skill) cmds.push({ type: 'rollSkill', skill: skill.id });
    else {
      const abm = t.match(/\b(?:prueba|tirada|chequeo|tiro|tira)(?: de)? (\w+)/);
      const ab = abm && ABILITY_WORDS.find(([re]) => re.test(abm[1]));
      if (ab) cmds.push({ type: 'rollAbility', ability: ab[1] });
    }
  }
  const dice = t.match(/\b(?:tiro|tira|tirar|lanzo|roll)\s+(\d*d\d+(?:\s*[+-]\s*\d+)*)/);
  if (dice) cmds.push({ type: 'rollDice', expr: dice[1].replace(/\s/g, '') });

  // ---------- PG temporales ----------
  const temp = t.match(/(\d+)\s*(?:puntos de golpe |pg |pv |de vida |puntos )?temporales/);
  if (temp) {
    cmds.push({ type: 'tempHp', amount: Number(temp[1]) });
    t = t.replace(temp[0], ' ');
  }

  // ---------- Curación ----------
  const healVerb = /\b(me curo|me cura(n)?|curo|recupero|me sana(n)?|sano|curacion|curar|me tomo|bebo|me bebo|me dan)\b/;
  if (healVerb.test(t)) {
    const potion = POTIONS.find(([re]) => re.test(t));
    const diceHeal = t.match(/(\d*d\d+(?:\s*[+-]\s*\d+)?)/);
    const numHeal = t.match(/(?:curo|cura|curan|recupero|sana|sanan|curacion de|sano)\D{0,25}?(\d+)/) ?? t.match(/(\d+)\s*(?:pg|pv|puntos de golpe|de vida|de curacion)/);
    if (numHeal && !/temporales/.test(t)) cmds.push({ type: 'heal', amount: Number(numHeal[1]), source: potion?.[2] ?? null });
    else if (diceHeal) cmds.push({ type: 'heal', dice: diceHeal[1].replace(/\s/g, ''), source: potion?.[2] ?? null });
    else if (potion) cmds.push({ type: 'heal', dice: potion[1], source: potion[2] });
  }
  if (/tomar aliento|second wind|segundo aliento/.test(t) && /\b(uso|usar|gasto|activo|tomo)\b/.test(t)) {
    cmds.push({ type: 'useResource', name: 'Tomar aliento' });
    cmds.push({ type: 'heal', dice: `1d10+${c.level}`, source: 'Tomar aliento' });
  }

  // ---------- Daño ----------
  const isHeal = cmds.some((x) => x.type === 'heal');
  const damageContext = /\b(dano|danos|hecho|hace|hacen|golpea|golpe|quita|quitan|recibo|recibido|pierdo|perdido|impacta|ataca|atacado|muerde|mordido|dispara|alcanza|quema|corta|pega|pegado|apunala|explota|clava|lanza)\b/.test(t);
  if (damageContext && !isHeal) {
    const found: { amount: number; type: DamageType | null; idx: number }[] = [];
    const typed = new RegExp(`(\\d+)\\s*(?:puntos?\\s+)?(?:de\\s+)?(?:dano\\s+)?(?:de\\s+)?(?:tipo\\s+)?(${TYPE_RE})\\b`, 'g');
    let m: RegExpExecArray | null;
    while ((m = typed.exec(t))) {
      const dt = DAMAGE_TYPES.find((d) => norm(d.name) === m![2])!.id;
      found.push({ amount: Number(m[1]), type: dt, idx: m.index });
    }
    const plain = /(\d+)\s*(?:puntos?\s+)?(?:de\s+)?(?:dano|danos|pg|pv|puntos de golpe|de vida|vida|hp)\b/g;
    while ((m = plain.exec(t))) {
      if (!found.some((f) => Math.abs(f.idx - m!.index) < 3)) found.push({ amount: Number(m[1]), type: null, idx: m.index });
    }
    if (found.length === 0) {
      const loose = t.match(/(?:me (?:ha )?(?:hecho|hace|quita|quitado)|recibo|pierdo|he perdido|me pega|me golpea por)\s+(\d+)/);
      if (loose) found.push({ amount: Number(loose[1]), type: null, idx: loose.index ?? 0 });
    }
    const atk = t.match(/(?:con (?:un |una )?|saca (?:un |una )?|tirada de |ataque de |tira (?:un |una )?)(\d+)\s*(?:para (?:impactar|golpear|dar)|de ataque|al ataque|contra (?:mi |la )?ca)/) ??
      t.match(/(\d+)\s*(?:para (?:impactar|golpear|dar)|contra (?:mi |la )?ca)/);
    const crit = /\bcritico\b|\bcritica\b/.test(t);
    const fallback = typeFromText(t);
    const source = sourceOf(t);
    found.sort((a, b) => a.idx - b.idx);
    for (const [i, f] of found.entries()) {
      cmds.push({ type: 'damage', amount: f.amount, damageType: f.type ?? (found.length === 1 ? fallback : null), source, attackRoll: i === 0 && atk ? Number(atk[1]) : null, critical: crit });
    }
    if (found.length === 0 && atk) {
      cmds.push({ type: 'info', text: `${source ? source + ': ' : ''}tirada de ataque ${atk[1]}. Si me dices el daño, lo calculo (p. ej. "${atk[1]} para impactar y 6 de daño cortante").` });
    }
  }

  // ---------- Efectos (beneficios / perjuicios) ----------
  const aliasList = EFFECT_PRESETS.flatMap((p) => p.aliases.map((a) => ({ alias: norm(a), id: p.id }))).sort((a, b) => b.alias.length - a.alias.length);
  let effText = t;
  for (const { alias, id } of aliasList) {
    const re = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    const mm = effText.match(re);
    if (!mm) continue;
    if (id === 'escudo' && !/\b(lanzo|conjuro|reaccion)\b/.test(t)) continue;
    if (id === 'esquivar' && !/\b(esquivo|esquivar|accion de esquivar)\b/.test(t)) continue;
    const before = effText.slice(Math.max(0, (mm.index ?? 0) - 25), mm.index);
    const negative = NEGATION.test(before) || /\b(termina|se acaba|se me acaba|acaba|se pasa)\b/.test(effText.slice(mm.index ?? 0));
    if (negative) cmds.push({ type: 'removeEffect', name: EFFECT_PRESETS.find((p) => p.id === id)!.name });
    else {
      cmds.push({ type: 'addEffect', presetId: id });
      const p = EFFECT_PRESETS.find((x) => x.id === id)!;
      if (p.concentration && /\b(lanzo|me lanzo|casteo|conjuro)\b/.test(t)) cmds.push({ type: 'concentrate', spell: p.name });
    }
    effText = effText.replace(re, ' ');
  }

  // ---------- Lanzar conjuros de la hoja / gastar espacios ----------
  const slot = t.match(/(?:espacio|slot|hueco|ranura)s?\s+(?:de\s+)?nivel\s+(\d)/) ?? t.match(/\ba nivel (\d)\b/);
  if (/\b(lanzo|casteo|gasto|uso)\b/.test(t)) {
    const spell = c.spells.find((s) => s.level > 0 && t.includes(norm(s.name)));
    if (spell) {
      cmds.push({ type: 'useSlot', level: slot ? Number(slot[1]) : spell.level });
      if (spell.concentration && !cmds.some((x) => x.type === 'concentrate')) cmds.push({ type: 'concentrate', spell: spell.name });
    } else if (slot) cmds.push({ type: 'useSlot', level: Number(slot[1]) });
    for (const r of c.resources) {
      if (r.name !== 'Tomar aliento' && r.name !== 'Furia' && t.includes(norm(r.name))) {
        const n = t.match(new RegExp(`(\\d+)\\s*(?:puntos? de |usos? de )?${norm(r.name)}`));
        cmds.push({ type: 'useResource', name: r.name, amount: n ? Number(n[1]) : 1 });
      }
    }
  }

  // ---------- Condiciones ----------
  for (const [re, id] of CONDITION_WORDS) {
    const mm = t.match(re);
    if (!mm) continue;
    if (id === 'inconsciente' && cmds.some((x) => x.type === 'damage')) continue;
    const idx = mm.index ?? 0;
    const before = t.slice(Math.max(0, idx - 22), idx);
    const negative = NEGATION.test(before) || /\b(se me pasa|termina|se acaba)\b/.test(t.slice(idx));
    cmds.push(negative ? { type: 'removeCondition', condition: id } : { type: 'addCondition', condition: id });
  }
  if (/\bme levanto\b|\bme pongo de pie\b/.test(t)) cmds.push({ type: 'removeCondition', condition: 'derribado' });
  if (/\b(me libero|escapo del agarre|me suelto)\b/.test(t) && !cmds.some((x) => x.type === 'removeCondition')) {
    cmds.push({ type: 'removeCondition', condition: c.conditions.includes('apresado') ? 'apresado' : 'agarrado' });
  }

  // ---------- Agotamiento ----------
  const exh = t.match(/(\d+)?\s*(?:nivel(?:es)? de )?agotamiento/);
  if (exh && !/que es/.test(t)) {
    const n = Number(exh[1] ?? 1);
    if (/\b(pierdo|quito|reduzco|baja|bajo|elimino|menos)\b/.test(t)) cmds.push({ type: 'exhaustion', delta: -n });
    else cmds.push({ type: 'exhaustion', delta: n });
  }

  // ---------- Concentración / inspiración ----------
  if (/pierdo (la )?concentracion|rompo (la )?concentracion|dejo de concentrarme/.test(t)) cmds.push({ type: 'endConcentration' });
  const conc = t.match(/me concentro en (.+)$/);
  if (conc) cmds.push({ type: 'concentrate', spell: conc[1].replace(/^\w/, (x) => x.toUpperCase()) });
  if (/inspiracion( heroica)?/.test(t) && !/bardica/.test(t)) {
    if (/\b(gano|me dan|consigo|recibo|obtengo)\b/.test(t)) cmds.push({ type: 'inspiration', value: true });
    else if (/\b(uso|gasto|pierdo)\b/.test(t)) cmds.push({ type: 'inspiration', value: false });
  }

  // ---------- Ataque que falla ----------
  if (cmds.length === 0 && /\b(falla|fallado|no me da|no me impacta|esquivo el|me esquiva)\b/.test(t)) {
    cmds.push({ type: 'info', text: '¡Uf! El ataque falla. No cambio nada en tu hoja.' });
  }

  return { commands: cmds, question: false };
}

/** Busca un tema de reglas por nombre y devuelve una explicación con el estado actual del personaje. */
export function lookupTopic(topicRaw: string, c: Character): string | null {
  const topic = norm(topicRaw);
  if (!topic) return null;
  const has = (name: string) => norm(name).includes(topic) || topic.includes(norm(name).split(' (')[0]);

  const cond = CONDITIONS.find((x) => has(x.name) || topic.startsWith(norm(x.name).slice(0, -1)));
  if (cond) {
    const active = c.conditions.includes(cond.id) ? '\n(Ahora mismo TIENES esta condición.)' : '';
    return `${cond.name}:\n${cond.effects.map((e) => '• ' + e).join('\n')}${active}`;
  }
  const skill = SKILLS.find((s) => has(s.name));
  if (skill) return `${skill.name} (${skill.ability.toUpperCase()}): ${skill.desc}\nEjemplos: ${skill.examples}`;
  const action = ACTIONS.find((a) => has(a.name));
  if (action) return `${action.name} [${action.cost}]: ${action.text}`;
  const preset = EFFECT_PRESETS.find((p) => p.aliases.some((a) => norm(a) === topic) || has(p.name));
  if (preset) return `${preset.name}: ${preset.notes}${preset.concentration ? ' (Concentración)' : ''}`;
  const mastery = MASTERIES.find((m) => has(m.name));
  if (mastery) return `${mastery.name}: ${mastery.text}`;
  const rule = RULES.find((r) => has(r.name));
  if (rule) return `${rule.name}:\n${rule.text.map((x) => '• ' + x).join('\n')}`;
  if (/agotamiento/.test(topic)) return 'Agotamiento: −2 × nivel a todas las pruebas d20 y −5 pies × nivel a la velocidad. Con 6 niveles mueres. Un descanso largo quita 1 nivel.';
  const spell = c.spells.find((s) => has(s.name));
  if (spell) return `${spell.name} (nivel ${spell.level || 'truco'}): ${spell.castingTime}, alcance ${spell.range}${spell.concentration ? ', concentración' : ''}. ${spell.notes ?? ''}`;
  const feat = c.features.find((f) => has(f.name));
  if (feat) return `${feat.name}: ${feat.text}`;
  return null;
}
