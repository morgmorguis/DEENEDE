// Intérprete local (sin IA) de frases sobre lo que le pasa al personaje, en español e inglés.
import type { Ability, Character, ConditionId, DamageType } from '../types';
import type { Command } from './engine';
import { ACTIONS, CONDITIONS, COST_NAMES, DAMAGE_TYPES, EFFECT_PRESETS, EXHAUSTION_INFO, MASTERIES, RULES, SKILLS, abilityShort } from './srd';
import { L, T, getLang } from '../i18n';

export const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’]/g, "'").replace(/[¿?¡!.,;:]/g, ' ').replace(/\s+/g, ' ').trim();

const NUM_ES = 'dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|diecisiete|dieciocho|diecinueve|veinte';
const NUM_EN = 'two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty';
const numValue = (w: string) => {
  const es = NUM_ES.split('|').indexOf(w);
  if (es >= 0) return es + 2;
  return NUM_EN.split('|').indexOf(w) + 2;
};
/** Convierte números escritos con letra ("siete de daño", "seven damage") a cifras. */
const wordsToDigits = (s: string) => s.replace(new RegExp(`\\b(${NUM_ES}|${NUM_EN})\\b`, 'g'), (w) => String(numValue(w)));

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TYPE_RE = DAMAGE_TYPES.flatMap((d) => [norm(d.name.es), norm(d.name.en)]).join('|');
const typeId = (word: string) => DAMAGE_TYPES.find((d) => norm(d.name.es) === word || norm(d.name.en) === word)!.id;

const ABILITY_WORDS: [RegExp, Ability][] = [
  [/\b(fuerza|fue|str|strength)\b/, 'str'],
  [/\b(destreza|des|dex|dexterity)\b/, 'dex'],
  [/\b(constitucion|con|constitution)\b/, 'con'],
  [/\b(inteligencia|int|intelligence)\b/, 'int'],
  [/\b(sabiduria|sab|wis|wisdom)\b/, 'wis'],
  [/\b(carisma|car|cha|charisma)\b/, 'cha'],
];

const CONDITION_WORDS: [RegExp, ConditionId][] = [
  [/\bagarrad[oa]s?\b|\bme agarra(n)?\b|\bgrappled\b|\bgrabs? me\b/, 'agarrado'],
  [/\bapresad[oa]s?\b|\benredad[oa]\b|\batrapad[oa]\b|\brestrained\b|\bentangled\b/, 'apresado'],
  [/\basustad[oa]\b|\baterrad[oa]\b|\bmiedo\b|\bfrightened\b|\bscared\b|\bafraid\b/, 'asustado'],
  [/\baturdid[oa]\b|\bme aturde|\bstunned\b/, 'aturdido'],
  [/\bcegad[oa]\b|\bciego\b|\bciega\b|\bblinded\b|\bblind\b/, 'cegado'],
  [/\bderribad[oa]\b|\btumbad[oa]\b|\ben el suelo\b|\bal suelo\b|\bme derriba|\bprone\b|\bknocked down\b|\bknocks? me down\b/, 'derribado'],
  [/\bensordecid[oa]\b|\bsord[oa]\b|\bdeafened\b|\bdeaf\b/, 'ensordecido'],
  [/\benvenenad[oa]\b|\bme envenena|\bpoisoned\b/, 'envenenado'],
  [/\bhechizad[oa]\b|\bencantad[oa]\b|\bme hechiza|\bcharmed\b/, 'hechizado'],
  [/\bincapacitad[oa]\b|\bincapacitated\b/, 'incapacitado'],
  [/\binconsciente\b|\bunconscious\b/, 'inconsciente'],
  [/\binvisible\b/, 'invisible'],
  [/\bparalizad[oa]\b|\bme paraliza|\bparalyzed\b|\bparalysed\b/, 'paralizado'],
  [/\bpetrificad[oa]\b|\bpetrified\b/, 'petrificado'],
];

const NEGATION = /\b(ya no|dejo de|deja de|no estoy|se me pasa|se me quita|quita(r)?|me libero|me suelto|me suelta(n)?|sin|termina|se acaba|acaba|fin de|pierdo|se termina|me quito|elimina(r)?|no longer|not|no more|remove|ends?|lose|lost|stop|free from|without)\b/;
const END_AFTER = /\b(termina|se acaba|se me acaba|acaba|se pasa|ends|ended|wears off|is over|expires)\b/;

function sourceOf(t: string): string | null {
  const es = t.match(/\b(?:un|una|el|la|los|las|otro|otra)\s+([a-z]+(?:\s+(?!me\b|nos\b|te\b|le\b|ha\b|con\b|de\b|y\b)[a-z]+)?)\s+(?:me|nos|te)\b/);
  const en = t.match(/\b(?:a|an|the|another)\s+([a-z]+(?:\s+(?!hits\b|hit\b|deals\b|does\b|attacks\b|bites\b|shoots\b|slashes\b|me\b|and\b|with\b)[a-z]+)?)\s+(?:hits|hit|deals|did|does|attacks|attacked|bites|bit|shoots|shot|slashes|stabs|claws|punches)\b/);
  const m = es ?? en;
  if (!m) return null;
  const name = m[1];
  if (/^(vez|ataque|golpe|flecha|conjuro|hechizo|attack|hit|arrow|spell)$/.test(name)) return null;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function typeFromText(t: string): DamageType | null {
  // Primero los tipos de daño explícitos, después palabras asociadas (espada → cortante)
  for (const d of DAMAGE_TYPES) if (new RegExp(`\\b(${norm(d.name.es)}|${norm(d.name.en)})\\b`).test(t)) return d.id;
  for (const d of DAMAGE_TYPES) for (const w of d.words) if (new RegExp(`\\b${escapeRe(norm(w))}\\b`).test(t)) return d.id;
  return null;
}

const POTIONS: [RegExp, string, { es: string; en: string }][] = [
  [/pocion de curacion suprema|supreme healing/, '10d4+20', { es: 'Poción de curación suprema', en: 'Potion of Supreme Healing' }],
  [/pocion de curacion superior|superior healing/, '8d4+8', { es: 'Poción de curación superior', en: 'Potion of Superior Healing' }],
  [/pocion de curacion mayor|greater healing/, '4d4+4', { es: 'Poción de curación mayor', en: 'Potion of Greater Healing' }],
  [/pocion( de curacion)?|potion( of healing)?|healing potion/, '2d4+2', { es: 'Poción de curación', en: 'Potion of Healing' }],
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
  const q = t.match(/^(?:que|como|cuando|cuanto)\s+(?:hace|es|funciona|significa|afecta|me afecta|dura)\s+(?:el |la |los |las |estar |un |una )?(.+)$/)
    ?? t.match(/^(?:what|how)\s+(?:does|is|are|do)\s+(?:the |a |an |being )?(.+?)(?:\s+(?:do|work|mean|works))?$/);
  if (q || /^(info|ayuda sobre|explica(me)?|regla(s)? de|explain|rules? for)\b/.test(t)) {
    const topic = (q ? q[1] : t.replace(/^(info|ayuda sobre|explica(me)?|regla(s)? de|explain|rules? for)\s*/, '')).trim();
    const answer = lookupTopic(topic, c);
    if (answer) return { commands: [{ type: 'info', text: answer }], question: true };
  }

  // ---------- Descansos ----------
  if (/descanso corto|descansamos (un rato|una hora)|short rest/.test(t)) {
    const hd = t.match(/(\d+)\s*(?:dados?|dg|hit dice|dice|hd)/);
    return { commands: [{ type: 'rest', kind: 'short', hitDice: hd ? Number(hd[1]) : 0 }], question: false };
  }
  if (/descanso largo|dormimos|descansamos (toda la noche|8 horas)|long rest/.test(t)) {
    return { commands: [{ type: 'rest', kind: 'long' }], question: false };
  }

  // ---------- Combate: rondas / iniciativa ----------
  if (/\b(nueva ronda|siguiente ronda|fin de (mi )?turno|termino (mi )?turno|nuevo turno|siguiente turno|next round|new round|end (of )?(my )?turn|next turn)\b/.test(t)) cmds.push({ type: 'nextRound' });
  if (/\b(iniciativa|initiative)\b/.test(t) && !/que es|what is/.test(t)) cmds.push({ type: 'rollInitiative' });

  // ---------- Salvaciones contra la muerte ----------
  const ds = t.match(/salvacion(?:es)? (?:contra (?:la )?|de )muerte(?:\D+(\d+))?|death sav(?:e|ing throw)s?(?:\D+(\d+))?/);
  if (ds) {
    const n = ds[1] ?? ds[2];
    return { commands: [{ type: 'deathSave', roll: n ? Number(n) : null }], question: false };
  }

  // ---------- Tiradas ----------
  const save = t.match(/salvacion(?: de)? (\w+)/) ?? t.match(/(\w+) sav(?:e|ing throw)\b/) ?? t.match(/saving throw (?:of |for )?(\w+)/);
  if (save) {
    const ab = ABILITY_WORDS.find(([re]) => re.test(save[1]));
    if (ab) cmds.push({ type: 'rollSave', ability: ab[1] });
  }
  if (/\b(tiro|tira|tirada|prueba|chequeo|check|roll|rolling)\b/.test(t) && !save) {
    const skill = SKILLS.find((s) => new RegExp(`\\b(${norm(s.name.es)}|${norm(s.name.en)})\\b`).test(t));
    if (skill) cmds.push({ type: 'rollSkill', skill: skill.id });
    else {
      const abm = t.match(/\b(?:prueba|tirada|chequeo|tiro|tira|roll)(?: de| an?)? (\w+)/) ?? t.match(/\b(\w+) check\b/);
      const ab = abm && ABILITY_WORDS.find(([re]) => re.test(abm[1]));
      if (ab) cmds.push({ type: 'rollAbility', ability: ab[1] });
    }
  }
  const dice = t.match(/\b(?:tiro|tira|tirar|lanzo|roll)\s+(?:a\s+)?(\d*d\d+(?:\s*[+-]\s*\d+)*)/);
  if (dice) cmds.push({ type: 'rollDice', expr: dice[1].replace(/\s/g, '') });

  // ---------- PG temporales ----------
  const temp = t.match(/(\d+)\s*(?:puntos de golpe |pg |pv |de vida |puntos )?temporales/) ?? t.match(/(\d+)\s*(?:temporary|temp)\s*(?:hit points|hp|hit point)?/);
  if (temp) {
    cmds.push({ type: 'tempHp', amount: Number(temp[1]) });
    t = t.replace(temp[0], ' ');
  }

  // ---------- Curación ----------
  const healVerb = /\b(me curo|me cura(n)?|curo|recupero|me sana(n)?|sano|curacion|curar|me tomo|bebo|me bebo|me dan|heal|heals|healed|healing|regain|regained|recover|drink|drank|quaff)\b/;
  if (healVerb.test(t)) {
    const potion = POTIONS.find(([re]) => re.test(t));
    const diceHeal = t.match(/(\d*d\d+(?:\s*[+-]\s*\d+)?)/);
    const numHeal = t.match(/(?:curo|cura|curan|recupero|sana|sanan|curacion de|sano|heal(?:s|ed)?(?: me)?(?: for)?|regain(?:ed)?|recover(?:ed)?)\D{0,25}?(\d+)/)
      ?? t.match(/(\d+)\s*(?:pg|pv|puntos de golpe|de vida|de curacion|hp|hit points)/);
    const potionName = potion ? L(potion[2]) : null;
    if (numHeal && !/temporales|temporary|temp/.test(t)) cmds.push({ type: 'heal', amount: Number(numHeal[1]), source: potionName });
    else if (diceHeal) cmds.push({ type: 'heal', dice: diceHeal[1].replace(/\s/g, ''), source: potionName });
    else if (potion) cmds.push({ type: 'heal', dice: potion[1], source: potionName });
  }
  if (/tomar aliento|second wind|segundo aliento/.test(t) && /\b(uso|usar|gasto|activo|tomo|use|using|used)\b/.test(t)) {
    cmds.push({ type: 'useResource', name: 'second_wind' });
    cmds.push({ type: 'heal', dice: `1d10+${c.level}`, source: T('Tomar aliento', 'Second Wind') });
  }

  // ---------- Daño ----------
  const isHeal = cmds.some((x) => x.type === 'heal');
  const damageContext = /\b(dano|danos|hecho|hace|hacen|golpea|golpe|quita|quitan|recibo|recibido|pierdo|perdido|impacta|ataca|atacado|muerde|mordido|dispara|alcanza|quema|corta|pega|pegado|apunala|explota|clava|lanza|damage|dmg|hit|hits|take|took|taking|deals|dealt|does|lose|lost|attacks|attacked|bites|bit|shoots|shot|slashes|stabs|claws|burns|punches)\b/.test(t);
  if (damageContext && !isHeal) {
    const found: { amount: number; type: DamageType | null; idx: number }[] = [];
    const typed = new RegExp(`(\\d+)\\s*(?:puntos?\\s+)?(?:de\\s+)?(?:dano\\s+)?(?:de\\s+)?(?:tipo\\s+)?(?:points? of\\s+)?(${TYPE_RE})\\b`, 'g');
    let m: RegExpExecArray | null;
    while ((m = typed.exec(t))) found.push({ amount: Number(m[1]), type: typeId(m[2]), idx: m.index });
    const plain = /(\d+)\s*(?:puntos?\s+)?(?:de\s+)?(?:points? of\s+)?(?:dano|danos|pg|pv|puntos de golpe|de vida|vida|hp|damage|dmg|hit points)\b/g;
    while ((m = plain.exec(t))) {
      if (!found.some((f) => Math.abs(f.idx - m!.index) < 3)) found.push({ amount: Number(m[1]), type: null, idx: m.index });
    }
    if (found.length === 0) {
      const loose = t.match(/(?:me (?:ha )?(?:hecho|hace|quita|quitado)|recibo|pierdo|he perdido|me pega|me golpea por|hits? me for|hit me for|i take|i took|i lose|i lost|deals?|dealt|for)\s+(\d+)/);
      if (loose) found.push({ amount: Number(loose[1]), type: null, idx: loose.index ?? 0 });
    }
    const atk = t.match(/(?:con (?:un |una )?|saca (?:un |una )?|tirada de |ataque de |tira (?:un |una )?|rolls? (?:a |an )?|with (?:a |an )?)(\d+)\s*(?:para (?:impactar|golpear|dar)|de ataque|al ataque|contra (?:mi |la )?ca|to hit|on the attack|vs (?:my )?ac|against (?:my )?ac)/)
      ?? t.match(/(\d+)\s*(?:para (?:impactar|golpear|dar)|contra (?:mi |la )?ca|to hit|vs (?:my )?ac|against (?:my )?ac)/)
      ?? t.match(/attack roll (?:of )?(\d+)/);
    const crit = /\bcritico\b|\bcritica\b|\bcrit\b|\bcritical\b/.test(t);
    const fallback = typeFromText(t);
    const source = sourceOf(t);
    found.sort((a, b) => a.idx - b.idx);
    // No confundir la tirada de ataque con el daño
    const atkNum = atk ? Number(atk[1]) : null;
    const dmgs = atk ? found.filter((f) => !(f.amount === atkNum && f.type === null && found.length > 1)) : found;
    for (const [i, f] of dmgs.entries()) {
      cmds.push({ type: 'damage', amount: f.amount, damageType: f.type ?? (dmgs.length === 1 ? fallback : null), source, attackRoll: i === 0 && atk ? atkNum : null, critical: crit });
    }
    if (dmgs.length === 0 && atk) {
      cmds.push({ type: 'info', text: T(`${source ? source + ': ' : ''}tirada de ataque ${atk[1]}. Si me dices el daño, lo calculo (p. ej. "${atk[1]} para impactar y 6 de daño cortante").`, `${source ? source + ': ' : ''}attack roll ${atk[1]}. Tell me the damage and I’ll work it out (e.g. "${atk[1]} to hit and 6 slashing damage").`) });
    }
  }

  // ---------- Efectos (beneficios / perjuicios) ----------
  const aliasList = EFFECT_PRESETS.flatMap((p) => p.aliases.map((a) => ({ alias: norm(a), id: p.id }))).sort((a, b) => b.alias.length - a.alias.length);
  let effText = t;
  const castVerb = /\b(lanzo|casteo|i cast|i'm casting|i am casting)\b/;
  for (const { alias, id } of aliasList) {
    const re = new RegExp(`\\b${escapeRe(alias)}\\b`);
    const mm = effText.match(re);
    if (!mm) continue;
    if (id === 'escudo' && !/\b(lanzo|conjuro|reaccion|cast|reaction)\b/.test(t)) continue;
    if (id === 'esquivar' && !/\b(esquivo|esquivar|accion de esquivar|dodge|dodging)\b/.test(t)) continue;
    const before = effText.slice(Math.max(0, (mm.index ?? 0) - 25), mm.index);
    const negative = NEGATION.test(before) || END_AFTER.test(effText.slice(mm.index ?? 0));
    const p = EFFECT_PRESETS.find((x) => x.id === id)!;
    if (negative) cmds.push({ type: 'removeEffect', name: L(p.name) });
    else {
      cmds.push({ type: 'addEffect', presetId: id });
      if (p.concentration && castVerb.test(t)) cmds.push({ type: 'concentrate', spell: L(p.name) });
    }
    effText = effText.replace(re, ' ');
  }

  // ---------- Lanzar conjuros de la hoja / gastar recursos ----------
  const slot = t.match(/(?:espacio|slot|hueco|ranura)s?\s+(?:de\s+)?(?:nivel|level)\s+(\d)/) ?? t.match(/\b(?:a nivel|at level|level) (\d)\b/) ?? t.match(/\b(\d)(?:st|nd|rd|th)[- ]level\b/);
  if (/\b(lanzo|casteo|gasto|uso|cast|casts|use|spend)\b/.test(t)) {
    const spell = c.spells.find((s) => s.level > 0 && s.name && t.includes(norm(s.name)));
    if (spell) {
      cmds.push({ type: 'useSlot', level: slot ? Number(slot[1]) : spell.level });
      if (spell.concentration && !cmds.some((x) => x.type === 'concentrate')) cmds.push({ type: 'concentrate', spell: spell.name });
    } else if (slot) cmds.push({ type: 'useSlot', level: Number(slot[1]) });
    for (const r of c.resources) {
      if (r.key === 'second_wind' || r.key === 'rage') continue;
      const names = [r.name, ...(r.key ? [] : [])].map(norm);
      const hit = names.find((n) => n && t.includes(n));
      if (hit) {
        const n = t.match(new RegExp(`(\\d+)\\s*(?:puntos? de |usos? de |points? of |uses? of )?${escapeRe(hit)}`));
        cmds.push({ type: 'useResource', name: r.key ?? r.name, amount: n ? Number(n[1]) : 1 });
      }
    }
  }

  // ---------- Condiciones ----------
  for (const [re, id] of CONDITION_WORDS) {
    const mm = t.match(re);
    if (!mm) continue;
    if (id === 'inconsciente' && cmds.some((x) => x.type === 'damage')) continue;
    if (id === 'invisible' && cmds.some((x) => x.type === 'addEffect')) continue;
    const idx = mm.index ?? 0;
    const before = t.slice(Math.max(0, idx - 22), idx);
    const negative = NEGATION.test(before) || END_AFTER.test(t.slice(idx));
    cmds.push(negative ? { type: 'removeCondition', condition: id } : { type: 'addCondition', condition: id });
  }
  if (/\bme levanto\b|\bme pongo de pie\b|\bstand up\b|\bget up\b|\bi stand\b/.test(t)) cmds.push({ type: 'removeCondition', condition: 'derribado' });
  if (/\b(me libero|escapo del agarre|me suelto|break free|escape the grapple|i escape)\b/.test(t) && !cmds.some((x) => x.type === 'removeCondition')) {
    cmds.push({ type: 'removeCondition', condition: c.conditions.includes('apresado') ? 'apresado' : 'agarrado' });
  }

  // ---------- Agotamiento ----------
  const exh = t.match(/(\d+)?\s*(?:nivel(?:es)? de |levels? of )?(?:agotamiento|exhaustion)/);
  if (exh && !/que es|what is/.test(t)) {
    const n = Number(exh[1] ?? 1);
    if (/\b(pierdo|quito|reduzco|baja|bajo|elimino|menos|lose|remove|reduce|less)\b/.test(t)) cmds.push({ type: 'exhaustion', delta: -n });
    else cmds.push({ type: 'exhaustion', delta: n });
  }

  // ---------- Concentración / inspiración ----------
  if (/pierdo (la )?concentracion|rompo (la )?concentracion|dejo de concentrarme|lose (my )?concentration|lost (my )?concentration|break (my )?concentration|drop concentration/.test(t)) cmds.push({ type: 'endConcentration' });
  const conc = t.match(/(?:me concentro en|concentrating on|i concentrate on) (.+)$/);
  if (conc) cmds.push({ type: 'concentrate', spell: conc[1].replace(/^\w/, (x) => x.toUpperCase()) });
  if (/inspiracion( heroica)?|heroic inspiration|\binspiration\b/.test(t) && !/bardica|bardic/.test(t)) {
    if (/\b(gano|me dan|consigo|recibo|obtengo|gain|get|got|receive)\b/.test(t)) cmds.push({ type: 'inspiration', value: true });
    else if (/\b(uso|gasto|pierdo|use|spend|spent|used)\b/.test(t)) cmds.push({ type: 'inspiration', value: false });
  }

  // ---------- Ataque que falla ----------
  if (cmds.length === 0 && /\b(falla|fallado|no me da|no me impacta|me esquiva|misses|missed|miss)\b/.test(t)) {
    cmds.push({ type: 'info', text: T('¡Uf! El ataque falla. No cambio nada en tu hoja.', 'Phew! The attack misses. Nothing changes on your sheet.') });
  }

  return { commands: cmds, question: false };
}

/** Busca un tema de reglas por nombre y devuelve una explicación con el estado actual del personaje. */
export function lookupTopic(topicRaw: string, c: Character): string | null {
  const topic = norm(topicRaw);
  if (!topic) return null;
  const hasName = (name: { es: string; en: string } | string) => {
    const names = typeof name === 'string' ? [name] : [name.es, name.en];
    return names.some((n) => {
      const nn = norm(n);
      return nn === topic || nn.includes(topic) || topic.includes(nn.split(' (')[0]);
    });
  };

  const cond = CONDITIONS.find((x) => hasName(x.name) || topic.startsWith(norm(x.name.es).slice(0, -1)));
  if (cond) {
    const active = c.conditions.includes(cond.id) ? T('\n(Ahora mismo TIENES esta condición.)', '\n(You currently HAVE this condition.)') : '';
    return `${L(cond.name)}:\n${cond.effects.map((e) => '• ' + L(e)).join('\n')}${active}`;
  }
  const skill = SKILLS.find((s) => hasName(s.name));
  if (skill) return `${L(skill.name)} (${abilityShort(skill.ability)}): ${L(skill.desc)}\n${T('Ejemplos', 'Examples')}: ${L(skill.examples)}`;
  const action = ACTIONS.find((a) => hasName(a.name));
  if (action) return `${L(action.name)} [${L(COST_NAMES[action.cost])}]: ${L(action.text)}`;
  const preset = EFFECT_PRESETS.find((p) => p.aliases.some((a) => norm(a) === topic) || hasName(p.name));
  if (preset) return `${L(preset.name)}: ${L(preset.notes)}${preset.concentration ? T(' (Concentración)', ' (Concentration)') : ''}`;
  const mastery = MASTERIES.find((m) => hasName(m.name));
  if (mastery) return `${L(mastery.name)}: ${L(mastery.text)}`;
  const rule = RULES.find((r) => hasName(r.name));
  if (rule) return `${L(rule.name)}:\n${rule.text.map((x) => '• ' + L(x)).join('\n')}`;
  if (/agotamiento|exhaustion/.test(topic)) return `${T('Agotamiento', 'Exhaustion')}:\n${EXHAUSTION_INFO.map((x) => '• ' + L(x)).join('\n')}`;
  const spell = c.spells.find((s) => s.name && hasName(s.name));
  if (spell) return `${spell.name} (${spell.level ? T(`nivel ${spell.level}`, `level ${spell.level}`) : T('truco', 'cantrip')}): ${spell.castingTime}, ${T('alcance', 'range')} ${spell.range}${spell.concentration ? T(', concentración', ', concentration') : ''}. ${spell.notes ?? ''}`;
  const feat = c.features.find((x) => x.name && hasName(x.name));
  if (feat) return `${feat.name}: ${feat.text}`;
  return null;
}

/** Ejemplos de frases para la pantalla del asistente */
export const examplePhrases = () => (getLang() === 'es'
  ? ['Un goblin me ha atacado y me ha hecho 7 de daño cortante', 'El orco saca 15 para impactar y me hace 9', 'Me lanzan bendición', 'Estoy envenenado', 'Me bebo una poción de curación', '¿Qué hace derribado?', 'Tiro percepción', 'Fin de turno', 'Descanso corto gastando 2 dados']
  : ['A goblin hits me for 7 slashing damage', 'The orc rolls 15 to hit and deals 9 damage', 'I’m blessed', 'I’m poisoned', 'I drink a potion of healing', 'What does prone do?', 'Roll perception', 'End turn', 'Short rest spending 2 dice']);
