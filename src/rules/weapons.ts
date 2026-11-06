// Armas del Player’s Handbook 2024 (SRD 5.2) con sus propiedades, maestría y lo que permiten o no
// (ataques no letales, dos armas, recarga…), y reglas de «qué puedes y qué no puedes hacer».
import type { Character } from '../types';
import { L, T, type Tr } from '../i18n';
import { MASTERIES } from './srd';

const r = (es: string, en: string): Tr => ({ es, en });

export type WeaponProp = 'ammunition' | 'finesse' | 'heavy' | 'light' | 'loading' | 'reach' | 'thrown' | 'twoHanded' | 'versatile';

export const WEAPON_PROPS: Record<WeaponProp, { name: Tr; text: Tr; limit?: Tr }> = {
  ammunition: {
    name: r('Munición', 'Ammunition'),
    text: r('Necesitas munición para atacar (flechas, virotes, balas, agujas). Sacarla forma parte del ataque. Tras el combate recuperas la mitad de la munición gastada (con 1 minuto de búsqueda).', 'You need ammunition to attack (arrows, bolts, bullets, needles). Drawing it is part of the attack. After combat you recover half the ammunition you spent (1 minute of searching).'),
    limit: r('Alcance normal/largo: más allá del normal atacas con desventaja; más allá del largo no puedes. Con un enemigo a 5 pies que te vea y no esté incapacitado, tus ataques a distancia tienen desventaja.', 'Normal/long range: beyond normal range you attack with Disadvantage; beyond long range you can’t. With an enemy within 5 ft that can see you and isn’t Incapacitated, your ranged attacks have Disadvantage.'),
  },
  finesse: { name: r('Sutil', 'Finesse'), text: r('Eliges FUE o DES para el ataque y el daño (la misma para los dos).', 'Choose STR or DEX for the attack and damage rolls (the same one for both).') },
  heavy: {
    name: r('Pesada', 'Heavy'), text: r('Arma grande y difícil de manejar.', 'A large, unwieldy weapon.'),
    limit: r('Desventaja en el ataque si tu Fuerza es menor de 13 (cuerpo a cuerpo) o tu Destreza menor de 13 (a distancia).', 'Disadvantage on attack rolls if your Strength is under 13 (melee) or your Dexterity is under 13 (ranged).'),
  },
  light: { name: r('Ligera', 'Light'), text: r('Al atacar con ella en la acción Atacar puedes hacer un ataque extra como acción adicional con otra arma Ligera distinta; a ese ataque no le sumas tu modificador al daño (salvo que sea negativo).', 'When you attack with it as part of the Attack action, you can make one extra attack as a Bonus Action with a different Light weapon; don’t add your ability modifier to that attack’s damage (unless it’s negative).') },
  loading: {
    name: r('Recarga', 'Loading'), text: r('Hay que recargarla tras cada disparo.', 'It must be reloaded after each shot.'),
    limit: r('Solo puedes disparar una vez por acción, acción adicional o reacción, aunque tengas Ataque extra.', 'You can fire only once per action, Bonus Action or Reaction, even if you have Extra Attack.'),
  },
  reach: { name: r('Alcance', 'Reach'), text: r('Tu alcance con ella es de 10 pies en vez de 5 (también para los ataques de oportunidad).', 'Your reach with it is 10 ft instead of 5 ft (also for Opportunity Attacks).') },
  thrown: { name: r('Arrojadiza', 'Thrown'), text: r('Puedes lanzarla para hacer un ataque a distancia con la misma característica que usarías cuerpo a cuerpo. Sacarla forma parte del ataque.', 'You can throw it to make a ranged attack using the same ability you’d use in melee. Drawing it is part of the attack.'), limit: r('Lanzada cuenta como ataque a distancia: no permite ataques no letales.', 'Thrown, it counts as a ranged attack: no nonlethal attacks.') },
  twoHanded: { name: r('A dos manos', 'Two-Handed'), text: r('Necesitas las dos manos para atacar con ella (puedes llevarla en una).', 'You need both hands to attack with it (you can carry it in one).'), limit: r('No puedes atacar con ella mientras llevas un escudo o algo en la otra mano.', 'You can’t attack with it while holding a shield or anything in your other hand.') },
  versatile: { name: r('Versátil', 'Versatile'), text: r('Con una mano usa el dado normal; con las dos, el dado entre paréntesis.', 'One-handed it uses the normal die; two-handed, the die in parentheses.') },
};

export interface WeaponInfo {
  id: string;
  name: Tr;
  category: 'simple' | 'martial';
  kind: 'melee' | 'ranged';
  damage: string;
  type: Tr;
  props: WeaponProp[];
  /** «20/60», «80/320» */
  range?: string;
  versatile?: string;
  mastery: string;
  weight: number;
  cost: string;
  note?: Tr;
}

const P = r('perforante', 'piercing');
const S = r('cortante', 'slashing');
const B = r('contundente', 'bludgeoning');
const w = (id: string, es: string, en: string, category: WeaponInfo['category'], kind: WeaponInfo['kind'], damage: string, type: Tr, props: WeaponProp[], mastery: string, weight: number, cost: string, extra: Partial<WeaponInfo> = {}): WeaponInfo =>
  ({ id, name: r(es, en), category, kind, damage, type, props, mastery, weight, cost, ...extra });

export const WEAPONS: WeaponInfo[] = [
  // Sencillas cuerpo a cuerpo
  w('club', 'Clava', 'Club', 'simple', 'melee', '1d4', B, ['light'], 'slow', 2, '1 pp'),
  w('dagger', 'Daga', 'Dagger', 'simple', 'melee', '1d4', P, ['finesse', 'light', 'thrown'], 'nick', 1, '2 po', { range: '20/60' }),
  w('greatclub', 'Gran clava', 'Greatclub', 'simple', 'melee', '1d8', B, ['twoHanded'], 'push', 10, '2 pp'),
  w('handaxe', 'Hacha de mano', 'Handaxe', 'simple', 'melee', '1d6', S, ['light', 'thrown'], 'vex', 2, '5 po', { range: '20/60' }),
  w('javelin', 'Jabalina', 'Javelin', 'simple', 'melee', '1d6', P, ['thrown'], 'slow', 2, '5 pp', { range: '30/120' }),
  w('light-hammer', 'Martillo ligero', 'Light Hammer', 'simple', 'melee', '1d4', B, ['light', 'thrown'], 'nick', 2, '2 po', { range: '20/60' }),
  w('mace', 'Maza', 'Mace', 'simple', 'melee', '1d6', B, [], 'sap', 4, '5 po'),
  w('quarterstaff', 'Bastón', 'Quarterstaff', 'simple', 'melee', '1d6', B, ['versatile'], 'topple', 4, '2 pp', { versatile: '1d8' }),
  w('sickle', 'Hoz', 'Sickle', 'simple', 'melee', '1d4', S, ['light'], 'nick', 2, '1 po'),
  w('spear', 'Lanza', 'Spear', 'simple', 'melee', '1d6', P, ['thrown', 'versatile'], 'sap', 3, '1 po', { range: '20/60', versatile: '1d8' }),
  // Sencillas a distancia
  w('dart', 'Dardo', 'Dart', 'simple', 'ranged', '1d4', P, ['finesse', 'thrown'], 'vex', 0.25, '5 pc', { range: '20/60' }),
  w('light-crossbow', 'Ballesta ligera', 'Light Crossbow', 'simple', 'ranged', '1d8', P, ['ammunition', 'loading', 'twoHanded'], 'slow', 5, '25 po', { range: '80/320' }),
  w('shortbow', 'Arco corto', 'Shortbow', 'simple', 'ranged', '1d6', P, ['ammunition', 'twoHanded'], 'vex', 2, '25 po', { range: '80/320' }),
  w('sling', 'Honda', 'Sling', 'simple', 'ranged', '1d4', B, ['ammunition'], 'slow', 0, '1 pp', { range: '30/120' }),
  // Marciales cuerpo a cuerpo
  w('battleaxe', 'Hacha de batalla', 'Battleaxe', 'martial', 'melee', '1d8', S, ['versatile'], 'topple', 4, '10 po', { versatile: '1d10' }),
  w('flail', 'Mangual', 'Flail', 'martial', 'melee', '1d8', B, [], 'sap', 2, '10 po'),
  w('glaive', 'Guja', 'Glaive', 'martial', 'melee', '1d10', S, ['heavy', 'reach', 'twoHanded'], 'graze', 6, '20 po'),
  w('greataxe', 'Gran hacha', 'Greataxe', 'martial', 'melee', '1d12', S, ['heavy', 'twoHanded'], 'cleave', 7, '30 po'),
  w('greatsword', 'Mandoble', 'Greatsword', 'martial', 'melee', '2d6', S, ['heavy', 'twoHanded'], 'graze', 6, '50 po'),
  w('halberd', 'Alabarda', 'Halberd', 'martial', 'melee', '1d10', S, ['heavy', 'reach', 'twoHanded'], 'cleave', 6, '20 po'),
  w('lance', 'Lanza de caballería', 'Lance', 'martial', 'melee', '1d10', P, ['heavy', 'reach', 'twoHanded'], 'topple', 6, '10 po', { note: r('A dos manos salvo que vayas montado.', 'Two-Handed unless you’re mounted.') }),
  w('longsword', 'Espada larga', 'Longsword', 'martial', 'melee', '1d8', S, ['versatile'], 'sap', 3, '15 po', { versatile: '1d10' }),
  w('maul', 'Maza a dos manos', 'Maul', 'martial', 'melee', '2d6', B, ['heavy', 'twoHanded'], 'topple', 10, '10 po'),
  w('morningstar', 'Lucero del alba', 'Morningstar', 'martial', 'melee', '1d8', P, [], 'sap', 4, '15 po'),
  w('pike', 'Pica', 'Pike', 'martial', 'melee', '1d10', P, ['heavy', 'reach', 'twoHanded'], 'push', 18, '5 po'),
  w('rapier', 'Estoque', 'Rapier', 'martial', 'melee', '1d8', P, ['finesse'], 'vex', 2, '25 po'),
  w('scimitar', 'Cimitarra', 'Scimitar', 'martial', 'melee', '1d6', S, ['finesse', 'light'], 'nick', 3, '25 po'),
  w('shortsword', 'Espada corta', 'Shortsword', 'martial', 'melee', '1d6', P, ['finesse', 'light'], 'vex', 2, '10 po'),
  w('trident', 'Tridente', 'Trident', 'martial', 'melee', '1d8', P, ['thrown', 'versatile'], 'topple', 4, '5 po', { range: '20/60', versatile: '1d10' }),
  w('warhammer', 'Martillo de guerra', 'Warhammer', 'martial', 'melee', '1d8', B, ['versatile'], 'push', 5, '15 po', { versatile: '1d10' }),
  w('war-pick', 'Pico de guerra', 'War Pick', 'martial', 'melee', '1d8', P, ['versatile'], 'sap', 2, '5 po', { versatile: '1d10' }),
  w('whip', 'Látigo', 'Whip', 'martial', 'melee', '1d4', S, ['finesse', 'reach'], 'slow', 3, '2 po'),
  // Marciales a distancia
  w('blowgun', 'Cerbatana', 'Blowgun', 'martial', 'ranged', '1', P, ['ammunition', 'loading'], 'vex', 1, '10 po', { range: '25/100' }),
  w('hand-crossbow', 'Ballesta de mano', 'Hand Crossbow', 'martial', 'ranged', '1d6', P, ['ammunition', 'light', 'loading'], 'vex', 3, '75 po', { range: '30/120' }),
  w('heavy-crossbow', 'Ballesta pesada', 'Heavy Crossbow', 'martial', 'ranged', '1d10', P, ['ammunition', 'heavy', 'loading', 'twoHanded'], 'push', 18, '50 po', { range: '100/400' }),
  w('longbow', 'Arco largo', 'Longbow', 'martial', 'ranged', '1d8', P, ['ammunition', 'heavy', 'twoHanded'], 'slow', 2, '50 po', { range: '150/600' }),
  w('musket', 'Mosquete', 'Musket', 'martial', 'ranged', '1d12', P, ['ammunition', 'loading', 'twoHanded'], 'slow', 10, '500 po', { range: '40/120' }),
  w('pistol', 'Pistola', 'Pistol', 'martial', 'ranged', '1d10', P, ['ammunition', 'loading'], 'vex', 3, '250 po', { range: '30/90' }),
];

/** Armas que funcionan bien bajo el agua (cuerpo a cuerpo sin desventaja) */
const UNDERWATER_OK = ['dagger', 'javelin', 'shortsword', 'spear', 'trident'];

/** ¿Tiene el personaje competencia con esta arma? (por el texto de su hoja) */
function proficientWith(c: Character, wpn: WeaponInfo): boolean | null {
  const t = c.weaponProf.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!t.trim()) return null;
  if (/marcial|martial/.test(t) && wpn.category === 'martial') return true;
  if (/sencill|simple/.test(t) && wpn.category === 'simple') return true;
  const names = [wpn.name.es, wpn.name.en].map((n) => n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
  return names.some((n) => t.includes(n));
}

/** Líneas de una arma para la pestaña Reglas: qué hace, qué permite, sus límites y cómo te afecta a ti */
export function weaponLines(wpn: WeaponInfo, c?: Character): string[] {
  const lines: string[] = [];
  lines.push(`${T('Daño', 'Damage')}: ${wpn.damage}${wpn.versatile ? T(` (${wpn.versatile} a dos manos)`, ` (${wpn.versatile} two-handed)`) : ''} ${L(wpn.type)} · ${wpn.kind === 'melee' ? T('cuerpo a cuerpo', 'melee') : T('a distancia', 'ranged')}${wpn.range ? ` · ${T('alcance', 'range')} ${wpn.range} ${T('pies', 'ft')}` : ''} · ${wpn.weight} lb · ${wpn.cost}`);
  for (const p of wpn.props) lines.push(`${L(WEAPON_PROPS[p].name)}: ${L(WEAPON_PROPS[p].text)}`);
  const ms = MASTERIES.find((m) => m.id === wpn.mastery);
  if (ms) lines.push(`${T('Maestría', 'Mastery')} ${L(ms.name)}: ${L(ms.text)} ${T('(solo si tu clase te deja usar la maestría de esta arma)', '(only if your class lets you use this weapon’s mastery)')}`);
  // Lo que permite
  if (wpn.kind === 'melee') lines.push(T('✅ Permite ataques no letales (dejar inconsciente sin matar): al bajar a 0 PG a una criatura con un ataque cuerpo a cuerpo, puedes dejarla a 1 PG e Inconsciente.', '✅ Allows nonlethal attacks (knock out without killing): when you reduce a creature to 0 HP with a melee attack, you can leave it at 1 HP and Unconscious.'));
  else lines.push(T('⛔ No permite ataques no letales: es un ataque a distancia.', '⛔ No nonlethal attacks: it’s a ranged attack.'));
  if (wpn.props.includes('light')) lines.push(T('✅ Sirve para combatir con dos armas (con otra arma Ligera).', '✅ Works for two-weapon fighting (with another Light weapon).'));
  else if (wpn.kind === 'melee') lines.push(T('⛔ No sirve para el ataque extra de combatir con dos armas (no es Ligera), salvo con la dote Combatiente con dos armas.', '⛔ Not for the two-weapon fighting extra attack (not Light), unless you have the Dual Wielder feat.'));
  if (wpn.props.includes('thrown')) lines.push(T('✅ Se puede lanzar.', '✅ Can be thrown.'));
  if (UNDERWATER_OK.includes(wpn.id)) lines.push(T('✅ Bajo el agua atacas sin desventaja cuerpo a cuerpo.', '✅ Underwater you attack in melee without Disadvantage.'));
  else if (wpn.kind === 'melee') lines.push(T('⬇️ Bajo el agua (sin velocidad nadando) atacas con desventaja.', '⬇️ Underwater (without a Swim Speed) you attack with Disadvantage.'));
  for (const p of wpn.props) { const lim = WEAPON_PROPS[p].limit; if (lim) lines.push(`⚠️ ${L(lim)}`); }
  if (wpn.note) lines.push(`⚠️ ${L(wpn.note)}`);
  // Para tu personaje
  if (c) {
    const prof = proficientWith(c, wpn);
    if (prof === true) lines.push(T('👤 Tienes competencia: sumas tu bonificador de competencia al ataque.', '👤 You’re proficient: add your Proficiency Bonus to the attack.'));
    if (prof === false) lines.push(T('👤 Según tu hoja no tienes competencia: no sumas tu bonificador de competencia al ataque ni puedes usar su maestría.', '👤 According to your sheet you’re not proficient: you don’t add your Proficiency Bonus to the attack and can’t use its mastery.'));
    if (wpn.props.includes('heavy')) {
      const score = wpn.kind === 'melee' ? c.abilities.str : c.abilities.dex;
      if (score < 13) lines.push(T(`👤 Con tu ${wpn.kind === 'melee' ? 'Fuerza' : 'Destreza'} ${score} atacarías con desventaja (necesitas 13).`, `👤 With your ${wpn.kind === 'melee' ? 'Strength' : 'Dexterity'} ${score} you’d attack with Disadvantage (you need 13).`));
    }
  }
  return lines;
}

/** Ataques sin arma y armas improvisadas */
export const OTHER_ATTACKS: { name: Tr; lines: Tr[] }[] = [
  { name: r('Ataque sin armas', 'Unarmed Strike'), lines: [
    r('Puñetazo, patada, cabezazo… Usas FUE y sumas tu competencia. Eliges uno: daño (1 + mod. FUE, contundente), agarrar o empujar.', 'Punch, kick, headbutt… Use STR and add your proficiency. Choose one: damage (1 + STR mod, bludgeoning), grapple or shove.'),
    r('✅ Permite ataques no letales (es cuerpo a cuerpo).', '✅ Allows nonlethal attacks (it’s melee).'),
    r('Agarrar o empujar: el objetivo hace una salvación de FUE o DES (a su elección) contra CD 8 + mod. FUE + competencia. Necesitas una mano libre para agarrar y el objetivo no puede ser más de un tamaño mayor que tú.', 'Grapple or shove: the target makes a STR or DEX save (its choice) against DC 8 + STR mod + proficiency. You need a free hand to grapple, and the target can be no more than one size larger than you.'),
  ] },
  { name: r('Armas improvisadas', 'Improvised Weapons'), lines: [
    r('Una silla, una botella, una pata de mesa… Hacen 1d4 de daño (del tipo que decida el DM).', 'A chair, a bottle, a table leg… They deal 1d4 damage (of a type the DM decides).'),
    r('No sumas tu competencia, salvo que se parezca a un arma que dominas (el DM puede tratarla como esa arma).', 'You don’t add your proficiency, unless it resembles a weapon you’re proficient with (the DM can treat it as that weapon).'),
    r('Lanzada: alcance 20/60 pies.', 'Thrown: range 20/60 ft.'),
  ] },
];

/** Lo que puedes y no puedes hacer (reglas 2024 resumidas) */
export const CAN_DO: { name: Tr; lines: Tr[] }[] = [
  { name: r('Tu turno: qué cabe', 'Your turn: what fits'), lines: [
    r('✅ Moverte hasta tu velocidad (puedes partir el movimiento antes y después de la acción) y hacer UNA acción.', '✅ Move up to your Speed (you can split it before and after your action) and take ONE action.'),
    r('✅ Una interacción gratuita con un objeto (sacar o guardar un arma, abrir una puerta). Una segunda requiere la acción Utilizar.', '✅ One free object interaction (draw or stow a weapon, open a door). A second one needs the Utilize action.'),
    r('✅ Hablar brevemente (unas frases) es gratis.', '✅ Speaking briefly (a few sentences) is free.'),
    r('⛔ Acción adicional solo si un rasgo, conjuro u objeto te la da; no puedes usar tu acción como acción adicional ni al revés.', '⛔ A Bonus Action only if a feature, spell or item gives you one; you can’t use your action as a Bonus Action or vice versa.'),
    r('⛔ Una sola reacción por ronda; vuelves a tenerla al empezar tu turno.', '⛔ Only one Reaction per round; you get it back at the start of your turn.'),
  ] },
  { name: r('Ataques no letales (dejar inconsciente)', 'Nonlethal attacks (knocking out)'), lines: [
    r('✅ Cuando bajas a 0 PG a una criatura con un ataque cuerpo a cuerpo (arma o sin armas), puedes dejarla a 1 PG e Inconsciente. Empieza un descanso corto y se despierta al acabar o si recibe curación.', '✅ When you reduce a creature to 0 HP with a melee attack (weapon or unarmed), you can leave it at 1 HP and Unconscious. It starts a Short Rest and wakes up when it ends or if it’s healed.'),
    r('⛔ No con ataques a distancia (arcos, ballestas, armas lanzadas) ni con conjuros.', '⛔ Not with ranged attacks (bows, crossbows, thrown weapons) or spells.'),
  ] },
  { name: r('Conjuros: límites', 'Spells: limits'), lines: [
    r('⛔ Solo puedes gastar UN espacio de conjuro por turno. Puedes lanzar un truco con la acción y otro conjuro con espacio como acción adicional (o al revés), pero no dos con espacio.', '⛔ You can spend only ONE spell slot per turn. You can cast a cantrip with your action and a slotted spell as a Bonus Action (or vice versa), but not two slotted spells.'),
    r('⛔ Sin entrenamiento con la armadura que llevas no puedes lanzar conjuros.', '⛔ Without training in the armor you wear you can’t cast spells.'),
    r('⛔ Componente verbal (V): no si no puedes hablar (Silencio, amordazado). Somático (S): necesitas una mano libre (puede ser la del canalizador). Material (M): canalizador o bolsa de componentes, salvo que tenga coste o se consuma.', '⛔ Verbal (V): not if you can’t speak (Silence, gagged). Somatic (S): you need a free hand (it can be the one holding your focus). Material (M): a focus or component pouch, unless it has a cost or is consumed.'),
    r('⛔ Solo un conjuro de concentración a la vez.', '⛔ Only one Concentration spell at a time.'),
    r('✅ Rituales: si el conjuro tiene la etiqueta Ritual y lo tienes preparado, puedes lanzarlo sin espacio tardando 10 minutos más.', '✅ Rituals: if the spell has the Ritual tag and you have it prepared, you can cast it without a slot by taking 10 extra minutes.'),
  ] },
  { name: r('Ataques de oportunidad', 'Opportunity Attacks'), lines: [
    r('✅ Cuando un enemigo que puedes ver sale de tu alcance, puedes usar tu reacción para hacerle un ataque cuerpo a cuerpo.', '✅ When an enemy you can see leaves your reach, you can use your Reaction to make one melee attack against it.'),
    r('⛔ No provoca quien hace la acción Destrabarse, quien se teletransporta ni quien es movido sin usar su movimiento (empujado, arrastrado).', '⛔ It isn’t provoked by someone who takes the Disengage action, teleports, or is moved without using its movement (pushed, dragged).'),
  ] },
  { name: r('Moverse entre criaturas', 'Moving around creatures'), lines: [
    r('✅ Puedes atravesar el espacio de un aliado, de una criatura incapacitada, de una Diminuta, o de una dos tamaños mayor o menor que tú (cuenta como terreno difícil).', '✅ You can move through the space of an ally, an Incapacitated creature, a Tiny creature, or one two sizes larger or smaller than you (it counts as Difficult Terrain).'),
    r('⛔ No puedes terminar tu movimiento voluntariamente en el espacio de otra criatura.', '⛔ You can’t willingly end your move in another creature’s space.'),
    r('Terreno difícil: cada pie cuesta 2. Levantarte de Derribado cuesta la mitad de tu velocidad.', 'Difficult Terrain: each foot costs 2. Standing up from Prone costs half your Speed.'),
  ] },
  { name: r('Esconderse', 'Hiding'), lines: [
    r('✅ Acción Esconderse: prueba de DES (Sigilo) CD 15 estando muy oscuro o tras cobertura de tres cuartos o total, y fuera de la vista de los enemigos. Si lo logras, tienes el estado Invisible.', '✅ Hide action: DEX (Stealth) check DC 15 while Heavily Obscured or behind Three-Quarters or Total Cover, and out of enemies’ line of sight. On a success you have the Invisible condition.'),
    r('⛔ Dejas de estar escondido si haces ruido, atacas, lanzas un conjuro con componente V o te encuentran.', '⛔ You stop being hidden if you make noise, attack, cast a spell with a V component, or are found.'),
  ] },
  { name: r('Atacar en situaciones especiales', 'Attacking in special situations'), lines: [
    r('⬇️ A distancia con un enemigo a 5 pies que te ve: desventaja.', '⬇️ Ranged with an enemy within 5 ft that sees you: Disadvantage.'),
    r('✅ Contra un objetivo Derribado a 5 pies: ventaja. ⬇️ Si está más lejos: desventaja.', '✅ Against a Prone target within 5 ft: Advantage. ⬇️ If farther away: Disadvantage.'),
    r('✅ Si el objetivo no te ve (estás Invisible o escondido): ventaja. ⬇️ Si tú no lo ves: desventaja.', '✅ If the target can’t see you (Invisible or hidden): Advantage. ⬇️ If you can’t see it: Disadvantage.'),
    r('Bajo el agua sin velocidad nadando: cuerpo a cuerpo con desventaja salvo daga, jabalina, espada corta, lanza o tridente; a distancia, desventaja dentro del alcance normal y fallo automático más allá. Todo tiene resistencia al fuego.', 'Underwater without a Swim Speed: melee with Disadvantage unless dagger, javelin, shortsword, spear or trident; ranged, Disadvantage within normal range and automatic miss beyond. Everything has Resistance to fire.'),
  ] },
  { name: r('Objetos y equipo', 'Items and gear'), lines: [
    r('✅ Beber una poción o dársela a alguien a 5 pies es una acción adicional.', '✅ Drinking a potion or giving it to someone within 5 ft is a Bonus Action.'),
    r('✅ Ponerse o quitarse un escudo: acción Utilizar. Armadura ligera: 1 min ponerse / 1 min quitarse; intermedia: 5 / 1; pesada: 10 / 5.', '✅ Don or doff a shield: Utilize action. Light armor: 1 min to don / 1 min to doff; medium: 5 / 1; heavy: 10 / 5.'),
    r('⛔ Máximo 3 objetos sintonizados a la vez; sintonizarse requiere un descanso corto con el objeto.', '⛔ At most 3 attuned items at once; attuning requires a Short Rest with the item.'),
    r('Carga: puedes llevar FUE × 15 libras (criaturas Pequeñas o Medianas); empujar, arrastrar o levantar hasta FUE × 30 (a 5 pies de velocidad si pasas de lo que llevas).', 'Carrying: you can carry STR × 15 lb (Small or Medium creatures); push, drag or lift up to STR × 30 (at 5 ft Speed if over your carrying capacity).'),
  ] },
  { name: r('Saltar, aguantar la respiración, caer', 'Jumping, holding breath, falling'), lines: [
    r('Salto de longitud: tantos pies como tu puntuación de FUE con 10 pies de carrerilla (la mitad sin carrerilla). Salto de altura: 3 + mod. FUE pies (la mitad sin carrerilla).', 'Long jump: as many feet as your STR score with a 10 ft run-up (half without). High jump: 3 + STR mod feet (half without).'),
    r('Aguantar la respiración: 1 + mod. CON minutos (mínimo 30 s). Después, tantos asaltos como tu mod. CON (mínimo 1) y caes a 0 PG.', 'Holding breath: 1 + CON mod minutes (minimum 30 s). After that, as many rounds as your CON mod (minimum 1), then you drop to 0 HP.'),
    r('Caída: 1d6 contundente por cada 10 pies (máximo 20d6) y quedas Derribado.', 'Falling: 1d6 bludgeoning per 10 ft (maximum 20d6) and you land Prone.'),
  ] },
  { name: r('Descansos: límites', 'Rests: limits'), lines: [
    r('⛔ Solo un descanso largo cada 24 horas, y necesitas al menos 1 PG para empezarlo.', '⛔ Only one Long Rest every 24 hours, and you need at least 1 HP to start it.'),
    r('⛔ Se interrumpe si tiras iniciativa, lanzas un conjuro que no sea un truco, recibes daño o haces 1 hora de esfuerzo físico. Si ya llevabas al menos 1 hora, cuenta como descanso corto.', '⛔ It’s interrupted if you roll Initiative, cast a spell other than a cantrip, take damage, or do 1 hour of physical exertion. If you’d rested at least 1 hour, you get a Short Rest’s benefits.'),
    r('Descanso corto: 1 hora; puedes gastar Dados de Golpe para curarte.', 'Short Rest: 1 hour; you can spend Hit Point Dice to heal.'),
  ] },
  { name: r('Visión y luz', 'Vision and light'), lines: [
    r('Poco visible (luz tenue, niebla ligera): desventaja en Percepción con la vista.', 'Lightly Obscured (dim light, light fog): Disadvantage on Perception checks that rely on sight.'),
    r('Muy oscuro (oscuridad, niebla densa): es como estar Cegado para ver lo que hay dentro.', 'Heavily Obscured (darkness, dense fog): effectively Blinded when trying to see something in it.'),
    r('Visión en la oscuridad: ves en la oscuridad como en luz tenue (en blanco y negro), dentro de su alcance.', 'Darkvision: you see in darkness as if it were dim light (in shades of gray), within its range.'),
  ] },
  { name: r('Sorpresa', 'Surprise'), lines: [
    r('Si te pillan desprevenido al empezar el combate, tiras la iniciativa con desventaja (reglas 2024; ya no se pierde el turno).', 'If you’re caught off guard when combat starts, you roll Initiative with Disadvantage (2024 rules; you no longer lose your turn).'),
  ] },
];
