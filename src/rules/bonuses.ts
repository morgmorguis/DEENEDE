// Bonificadores y ventajas que dan las reglas 2024 a las pruebas d20 (habilidades, pruebas de característica,
// salvaciones, iniciativa) según la clase, la subclase, la especie y las dotes del personaje, más los
// bonificadores que el jugador añade a mano («Otro bonificador»).
import type { Ability, BonusAdj, Character } from '../types';
import { SKILLS, abilityShort } from './srd';
import { classLevels } from './multiclass';
import { findSpecies } from './species';
import { T } from '../i18n';

/** A qué tirada afecta */
export type RollTarget =
  | { kind: 'skill'; id: string }
  | { kind: 'check'; ability: Ability }
  | { kind: 'save'; ability: Ability }
  | { kind: 'init' }
  | { kind: 'attack' };

export interface RuleMod {
  /** Id estable (para poder desactivarla en la ficha) */
  id: string;
  /** De dónde sale: «Taumaturgo (Orden divina, clérigo 1)» */
  source: string;
  /** Qué dice la regla */
  text: string;
  bonus?: number;
  adv?: boolean;
  /** Da competencia (salvaciones) */
  prof?: boolean;
  /** Un d20 de 9 o menos cuenta como 10 (Talento fiable) */
  minNatural?: number;
  /** Repite los 1 naturales (Suerte del mediano) */
  rerollOnes?: boolean;
  /** El total no puede ser menor que esto (Poder indomable) */
  minTotal?: number;
  /** Solo un recordatorio: depende de la situación y no se aplica sola */
  note?: boolean;
  /** El jugador la ha desactivado en su ficha */
  off?: boolean;
}

const mod = (n: number) => Math.floor((n - 10) / 2);
const pbOf = (level: number) => 2 + Math.floor((Math.max(1, level) - 1) / 4);
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Clave del bonificador manual de cada tirada */
export const adjKey = (t: RollTarget) => (t.kind === 'skill' ? `skill:${t.id}` : t.kind === 'init' ? 'init' : t.kind === 'attack' ? 'attack' : `${t.kind}:${t.ability}`);

/** Bonificador manual: número fijo + modificador de una característica (p. ej. «+ SAB») */
export function adjValue(c: Character, t: RollTarget): { value: number; adj?: BonusAdj } {
  const adj = c.bonusAdj?.[adjKey(t)];
  if (!adj) return { value: 0 };
  return { value: (adj.flat || 0) + (adj.ability ? mod(c.abilities[adj.ability]) : 0), adj };
}

export const adjText = (adj: BonusAdj) => [adj.flat ? `${adj.flat > 0 ? '+' : ''}${adj.flat}` : '', adj.ability ? `+ ${abilityShort(adj.ability)}` : ''].filter(Boolean).join(' ');

const ALL_ABILITIES: Ability[] = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

/** Todas las reglas que pueden afectar a esta tirada (también las desactivadas, marcadas con off) */
export function ruleMods(c: Character, t: RollTarget): RuleMod[] {
  const out: RuleMod[] = [];
  const m = (a: Ability) => mod(c.abilities[a]);
  const pb = pbOf(c.level);
  const lv = new Map<string, { level: number; sub: string }>();
  for (const e of classLevels(c)) lv.set(e.cls.id, { level: e.level, sub: fold(e.subclass ?? '') });
  const cl = (id: string) => lv.get(id)?.level ?? 0;
  const sub = (id: string, re: RegExp, min = 3) => cl(id) >= min && re.test(lv.get(id)!.sub);
  const featText = fold([...c.features.map((f) => f.name), c.feats].join(' | '));
  const has = (re: RegExp) => re.test(featText);
  const { species } = findSpecies(c.species);
  const sp = species?.id;

  const skill = t.kind === 'skill' ? SKILLS.find((s) => s.id === t.id) : undefined;
  const ability: Ability | undefined = t.kind === 'skill' ? skill?.ability : t.kind === 'check' || t.kind === 'save' ? t.ability : t.kind === 'init' ? 'dex' : undefined;
  const isCheck = t.kind === 'skill' || t.kind === 'check' || t.kind === 'init';
  const prof = skill ? c.skillProf[skill.id] ?? 0 : 0;
  const push = (r: RuleMod) => out.push(r);

  // ---------- Clases ----------
  // Clérigo · Orden divina: Taumaturgo
  if (cl('clerigo') && has(/\b(taumaturgo|thaumaturge)\b/) && skill && ['arcanos', 'religion'].includes(skill.id)) {
    push({ id: 'thaumaturge', source: T('Taumaturgo (Orden divina, clérigo)', 'Thaumaturge (Divine Order, Cleric)'), text: T('Sumas tu modificador de Sabiduría (mínimo +1) a las pruebas de Inteligencia (Arcanos o Religión).', 'Add your Wisdom modifier (minimum +1) to your Intelligence (Arcana or Religion) checks.'), bonus: Math.max(1, m('wis')) });
  }
  // Druida · Orden primigenia: Mago
  if (cl('druida') && has(/(orden primigenia|primal order)\s*:\s*(mago|magician)|\bmagician\b/) && skill && ['arcanos', 'naturaleza'].includes(skill.id)) {
    push({ id: 'magician', source: T('Mago (Orden primigenia, druida)', 'Magician (Primal Order, Druid)'), text: T('Sumas tu modificador de Sabiduría (mínimo +1) a las pruebas de Inteligencia (Arcanos o Naturaleza).', 'Add your Wisdom modifier (minimum +1) to your Intelligence (Arcana or Nature) checks.'), bonus: Math.max(1, m('wis')) });
  }
  // Bardo 2 · Aprendiz de todo (2024: solo habilidades sin competencia)
  if (cl('bardo') >= 2 && skill && prof === 0) {
    push({ id: 'jack_of_all_trades', source: T('Aprendiz de todo (bardo 2)', 'Jack of All Trades (Bard 2)'), text: T('Sumas la mitad de tu bonificador de competencia (redondeando abajo) a las pruebas de habilidades en las que no eres competente.', 'Add half your Proficiency Bonus (round down) to ability checks using a skill you lack proficiency in.'), bonus: Math.floor(pb / 2) });
  }
  // Bardo del Conocimiento 14 · Habilidad sin igual
  if (isCheck && t.kind !== 'init' && sub('bardo', /conocimiento|lore/, 14)) {
    push({ id: 'peerless_skill', note: true, source: T('Habilidad sin igual (Colegio del Conocimiento 14)', 'Peerless Skill (College of Lore 14)'), text: T('Si fallas una prueba de característica, gasta Inspiración bárdica, tira el dado y súmalo (si sigues fallando, no se gasta).', 'If you fail an ability check, expend Bardic Inspiration, roll the die and add it (it isn’t expended if you still fail).') });
  }
  // Bardo de la Danza · Virtuoso de la danza / Paso en tándem
  if (skill?.id === 'interpretacion' && sub('bardo', /danza|dance/)) push({ id: 'dance_virtuoso', note: true, source: T('Virtuoso de la danza (Colegio de la Danza 3)', 'Dance Virtuoso (College of Dance 3)'), text: T('Ventaja en las pruebas de Carisma (Interpretación) en las que bailas.', 'Advantage on Charisma (Performance) checks that involve you dancing.') });
  if (t.kind === 'init' && sub('bardo', /danza|dance/, 6)) push({ id: 'tandem_footwork', note: true, source: T('Paso en tándem (Colegio de la Danza 6)', 'Tandem Footwork (College of Dance 6)'), text: T('Al tirar iniciativa puedes gastar Inspiración bárdica y sumar el dado a tu iniciativa y a la de los aliados cercanos que te vean u oigan.', 'When you roll Initiative, you can expend Bardic Inspiration and add the roll to your Initiative and that of nearby allies who can see or hear you.') });
  // Bárbaro
  if (t.kind === 'save' && t.ability === 'dex' && cl('barbaro') >= 2) push({ id: 'danger_sense', source: T('Sentido del peligro (bárbaro 2)', 'Danger Sense (Barbarian 2)'), text: T('Ventaja en las salvaciones de Destreza, salvo si estás incapacitado.', 'Advantage on Dexterity saving throws unless you have the Incapacitated condition.'), adv: true });
  if (t.kind === 'init' && cl('barbaro') >= 7) push({ id: 'feral_instinct', source: T('Instinto salvaje (bárbaro 7)', 'Feral Instinct (Barbarian 7)'), text: T('Ventaja en las tiradas de iniciativa.', 'Advantage on Initiative rolls.'), adv: true });
  if (skill && ['acrobacias', 'intimidacion', 'percepcion', 'sigilo', 'supervivencia'].includes(skill.id) && cl('barbaro') >= 3) {
    const raging = c.effects.some((e) => e.presetId === 'furia');
    const diff = m('str') - m(skill.ability);
    push({
      id: 'primal_knowledge', source: T('Conocimiento primigenio (bárbaro 3)', 'Primal Knowledge (Barbarian 3)'),
      text: T('En Furia puedes hacer esta prueba como prueba de Fuerza (con la ventaja de la Furia).', 'While your Rage is active, you can make this check as a Strength check (with Rage’s Advantage).'),
      ...(raging && diff >= 0 ? { bonus: diff, adv: true } : { note: true }),
    });
  }
  if (cl('barbaro') >= 18 && ability === 'str' && (t.kind === 'check' || t.kind === 'save' || (skill && skill.ability === 'str'))) push({ id: 'indomitable_might', source: T('Poder indomable (bárbaro 18)', 'Indomitable Might (Barbarian 18)'), text: T(`Si el total de una prueba o salvación de Fuerza es menor que tu puntuación de Fuerza (${c.abilities.str}), usas la puntuación.`, `If your total for a Strength check or saving throw is less than your Strength score (${c.abilities.str}), use the score instead.`), minTotal: c.abilities.str });
  // Guerrero
  if (isCheck && t.kind !== 'init' && cl('guerrero') >= 2) push({ id: 'tactical_mind', note: true, source: T('Mente táctica (guerrero 2)', 'Tactical Mind (Fighter 2)'), text: T('Si fallas una prueba de característica, puedes gastar un uso de Tomar aliento para sumar 1d10 (si sigues fallando, no se gasta).', 'If you fail an ability check, you can expend a use of Second Wind to add 1d10 (it isn’t expended if you still fail).') });
  if (t.kind === 'save' && cl('guerrero') >= 9) push({ id: 'indomitable', note: true, source: T('Indomable (guerrero 9)', 'Indomitable (Fighter 9)'), text: T(`Si fallas una salvación, puedes repetirla con un bonificador igual a tu nivel de guerrero (+${cl('guerrero')}).`, `If you fail a saving throw, you can reroll it with a bonus equal to your Fighter level (+${cl('guerrero')}).`) });
  if (sub('guerrero', /campeon|champion/) && (t.kind === 'init' || skill?.id === 'atletismo')) push({ id: 'remarkable_athlete', source: T('Atleta excepcional (Campeón 3)', 'Remarkable Athlete (Champion 3)'), text: T('Ventaja en la iniciativa y en las pruebas de Fuerza (Atletismo).', 'Advantage on Initiative rolls and Strength (Athletics) checks.'), adv: true });
  // Monje 14 · Superviviente disciplinado
  if (t.kind === 'save' && cl('monje') >= 14) push({ id: 'disciplined_survivor', source: T('Superviviente disciplinado (monje 14)', 'Disciplined Survivor (Monk 14)'), text: T('Competencia en todas las tiradas de salvación (y puedes gastar 1 punto de concentración para repetir una fallada).', 'Proficiency in all saving throws (and you can spend 1 Focus Point to reroll a failed one).'), prof: true });
  // Paladín 6 · Aura de protección
  if (t.kind === 'save' && cl('paladin') >= 6) push({ id: 'aura_of_protection', source: T('Aura de protección (paladín 6)', 'Aura of Protection (Paladin 6)'), text: T('Sumas tu modificador de Carisma (mínimo +1) a tus salvaciones (y a las de tus aliados en el aura) mientras no estés incapacitado.', 'You (and allies in your aura) add your Charisma modifier (minimum +1) to saving throws while you aren’t Incapacitated.'), bonus: Math.max(1, m('cha')) });
  // Explorador
  if (sub('explorador', /errante feerico|fey wanderer/) && ability === 'cha' && (t.kind === 'check' || skill)) push({ id: 'otherworldly_glamour', source: T('Encanto de otro mundo (Errante feérico 3)', 'Otherworldly Glamour (Fey Wanderer 3)'), text: T('Sumas tu modificador de Sabiduría (mínimo +1) a tus pruebas de Carisma.', 'Add your Wisdom modifier (minimum +1) to your Charisma checks.'), bonus: Math.max(1, m('wis')) });
  if (t.kind === 'init' && sub('explorador', /acechador|gloom stalker/)) push({ id: 'dread_ambusher', source: T('Emboscador temible (Acechador en la penumbra 3)', 'Dread Ambusher (Gloom Stalker 3)'), text: T('Sumas tu modificador de Sabiduría a la iniciativa.', 'Add your Wisdom modifier to your Initiative rolls.'), bonus: m('wis') });
  // Pícaro
  if (skill && prof >= 1 && cl('picaro') >= 7) push({ id: 'reliable_talent', source: T('Talento fiable (pícaro 7)', 'Reliable Talent (Rogue 7)'), text: T('En las pruebas con competencia, un 9 o menos en el d20 cuenta como 10.', 'On checks you’re proficient in, treat a d20 roll of 9 or lower as a 10.'), minNatural: 10 });
  if (t.kind === 'save' && (t.ability === 'wis' || t.ability === 'cha') && cl('picaro') >= 15) push({ id: 'slippery_mind', source: T('Mente escurridiza (pícaro 15)', 'Slippery Mind (Rogue 15)'), text: T('Competencia en las salvaciones de Sabiduría y Carisma.', 'Proficiency in Wisdom and Charisma saving throws.'), prof: true });
  if (t.kind === 'init' && sub('picaro', /asesino|assassin/)) push({ id: 'assassinate', source: T('Asesinar (Asesino 3)', 'Assassinate (Assassin 3)'), text: T('Ventaja en las tiradas de iniciativa.', 'Advantage on Initiative rolls.'), adv: true });
  if (skill && prof >= 1 && sub('picaro', /cuchillo del alma|soulknife/)) push({ id: 'psi_knack', note: true, source: T('Pericia psíquica (Cuchillo del alma 3)', 'Psi-Bolstered Knack (Soulknife 3)'), text: T('Si fallas una prueba con competencia, puedes tirar un dado de energía psiónica y sumarlo.', 'If you fail a check you’re proficient in, you can roll a Psionic Energy Die and add it.') });
  // Brujo, hechicero y mago: suerte y presagios
  if ((isCheck || t.kind === 'save') && sub('brujo', /infernal|fiend/, 6)) push({ id: 'dark_ones_luck', note: true, source: T('Suerte del Oscuro (Patrón Infernal 6)', 'Dark One’s Own Luck (Fiend Patron 6)'), text: T('Puedes sumar 1d10 a una prueba de característica o salvación (usos = mod. CAR, mín. 1, por descanso largo).', 'You can add 1d10 to an ability check or saving throw (uses = CHA mod, min 1, per Long Rest).') });
  if (sub('hechicero', /salvaje|wild magic/, 1) && t.kind !== 'attack') push({ id: 'tides_of_chaos', note: true, source: T('Mareas del caos (Hechicería salvaje)', 'Tides of Chaos (Wild Magic)'), text: T('Puedes darte ventaja en una prueba d20 (se recupera con un descanso largo o tras una oleada de magia salvaje).', 'You can give yourself Advantage on one D20 Test (regained on a Long Rest or after a Wild Magic Surge).') });
  if (sub('mago', /adivino|diviner/)) push({ id: 'portent', note: true, source: T('Presagio (Adivino 3)', 'Portent (Diviner 3)'), text: T('Puedes sustituir esta tirada por uno de tus dados de presagio.', 'You can replace this roll with one of your Portent dice.') });
  // Concentración
  if (t.kind === 'save' && t.ability === 'con' && has(/lanzador de guerra|war caster/)) push({ id: 'war_caster', note: true, source: T('Lanzador de guerra (dote)', 'War Caster (feat)'), text: T('Ventaja en las salvaciones de Constitución para mantener la concentración.', 'Advantage on Constitution saving throws to maintain Concentration.') });
  if (t.kind === 'save' && t.ability === 'con' && has(/mente sobrenatural|eldritch mind/)) push({ id: 'eldritch_mind', note: true, source: T('Mente sobrenatural (invocación)', 'Eldritch Mind (invocation)'), text: T('Ventaja en las salvaciones de Constitución para mantener la concentración.', 'Advantage on Constitution saving throws to maintain Concentration.') });

  // ---------- Dotes ----------
  if (t.kind === 'init' && has(/\b(alerta|alert)\b/)) push({ id: 'alert', source: T('Alerta (dote)', 'Alert (feat)'), text: T('Sumas tu bonificador de competencia a la iniciativa.', 'Add your Proficiency Bonus to Initiative rolls.'), bonus: pb });
  if (t.kind !== 'attack' && has(/\b(afortunado|lucky)\b/)) push({ id: 'lucky', note: true, source: T('Afortunado (dote)', 'Lucky (feat)'), text: T('Puedes gastar un punto de suerte para darte ventaja en una prueba d20 (puntos = bonif. de competencia por descanso largo).', 'You can spend a Luck Point to give yourself Advantage on a D20 Test (points = Proficiency Bonus per Long Rest).') });
  if (skill && ['engano', 'interpretacion'].includes(skill.id) && has(/\b(actor)\b/)) push({ id: 'actor', note: true, source: T('Actor (dote)', 'Actor (feat)'), text: T('Ventaja en Engaño e Interpretación cuando te haces pasar por otra persona.', 'Advantage on Deception and Performance checks to pass yourself off as someone else.') });

  // ---------- Especies ----------
  if (sp === 'gnomo' && t.kind === 'save' && ['int', 'wis', 'cha'].includes(t.ability)) push({ id: 'gnomish_cunning', source: T('Astucia gnoma (gnomo)', 'Gnomish Cunning (Gnome)'), text: T('Ventaja en las salvaciones de Inteligencia, Sabiduría y Carisma.', 'Advantage on Intelligence, Wisdom and Charisma saving throws.'), adv: true });
  if (sp === 'mediano') push({ id: 'halfling_luck', source: T('Suerte (mediano)', 'Luck (Halfling)'), text: T('Cuando sacas un 1 en el d20 de una prueba d20, vuelves a tirar y usas el nuevo resultado.', 'When you roll a 1 on the d20 of a D20 Test, you can reroll the die and must use the new roll.'), rerollOnes: true });
  if (sp === 'mediano' && t.kind === 'save') push({ id: 'brave', note: true, source: T('Valiente (mediano)', 'Brave (Halfling)'), text: T('Ventaja en las salvaciones para evitar o acabar con el estado Asustado.', 'Advantage on saving throws to avoid or end the Frightened condition.') });
  if (sp === 'elfo' && t.kind === 'save') push({ id: 'fey_ancestry', note: true, source: T('Linaje feérico (elfo)', 'Fey Ancestry (Elf)'), text: T('Ventaja en las salvaciones para evitar o acabar con el estado Hechizado.', 'Advantage on saving throws to avoid or end the Charmed condition.') });
  if (sp === 'enano' && t.kind === 'save') push({ id: 'dwarven_resilience', note: true, source: T('Resistencia enana (enano)', 'Dwarven Resilience (Dwarf)'), text: T('Ventaja en las salvaciones para evitar o acabar con el estado Envenenado.', 'Advantage on saving throws to avoid or end the Poisoned condition.') });
  if (sp === 'goliat' && skill && ['atletismo', 'acrobacias'].includes(skill.id)) push({ id: 'powerful_build', note: true, source: T('Constitución poderosa (goliat)', 'Powerful Build (Goliath)'), text: T('Ventaja en las pruebas para librarte de un agarre.', 'Advantage on any ability check you make to end the Grappled condition.') });

  const off = new Set(c.rulesOff ?? []);
  return out.map((r) => (off.has(r.id) ? { ...r, off: true } : r));
}

/** Reglas que se aplican (no desactivadas) */
export const activeRules = (c: Character, t: RollTarget) => ruleMods(c, t).filter((r) => !r.off);

/** Suma de los bonificadores de reglas activas */
export const rulesBonus = (c: Character, t: RollTarget) => activeRules(c, t).reduce((s, r) => s + (r.note ? 0 : r.bonus ?? 0), 0);

export { ALL_ABILITIES };
