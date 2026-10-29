// Datos de reglas basados en el System Reference Document 5.2 (reglas de D&D 2024),
// publicado por Wizards of the Coast bajo licencia CC-BY-4.0. Textos resumidos;
// en español traducidos y parafraseados.
import type { Ability, ConditionId, DamageType, EffectMods } from '../types';
import { L, type Tr } from '../i18n';

export const ABILITIES: { id: Ability; name: Tr; short: Tr }[] = [
  { id: 'str', name: { es: 'Fuerza', en: 'Strength' }, short: { es: 'FUE', en: 'STR' } },
  { id: 'dex', name: { es: 'Destreza', en: 'Dexterity' }, short: { es: 'DES', en: 'DEX' } },
  { id: 'con', name: { es: 'Constitución', en: 'Constitution' }, short: { es: 'CON', en: 'CON' } },
  { id: 'int', name: { es: 'Inteligencia', en: 'Intelligence' }, short: { es: 'INT', en: 'INT' } },
  { id: 'wis', name: { es: 'Sabiduría', en: 'Wisdom' }, short: { es: 'SAB', en: 'WIS' } },
  { id: 'cha', name: { es: 'Carisma', en: 'Charisma' }, short: { es: 'CAR', en: 'CHA' } },
];

export const abilityName = (a: Ability) => L(ABILITIES.find((x) => x.id === a)!.name);
export const abilityShort = (a: Ability) => L(ABILITIES.find((x) => x.id === a)!.short);

export interface SkillInfo {
  id: string;
  name: Tr;
  ability: Ability;
  desc: Tr;
  examples: Tr;
  /** Sentidos de los que suele depender (para avisar de condiciones como Cegado) */
  senses?: ('sight' | 'hearing')[];
}

export const SKILLS: SkillInfo[] = [
  { id: 'acrobacias', name: { es: 'Acrobacias', en: 'Acrobatics' }, ability: 'dex',
    desc: { es: 'Mantener el equilibrio, hacer piruetas y escapar de situaciones complicadas con agilidad.', en: 'Stay on your feet in tricky situations, or perform an acrobatic stunt.' },
    examples: { es: 'Cruzar una cornisa helada, mantenerte de pie en un barco que se balancea, hacer una voltereta.', en: 'Cross an icy ledge, keep your balance on a rocking ship, perform a flip.' } },
  { id: 'trato_animales', name: { es: 'Trato con animales', en: 'Animal Handling' }, ability: 'wis',
    desc: { es: 'Calmar, entrenar o intuir las intenciones de un animal.', en: 'Calm or train an animal, or get an animal to behave in a certain way.' },
    examples: { es: 'Tranquilizar a un caballo asustado, saber si un lobo va a atacar.', en: 'Calm a frightened horse, tell whether a wolf is about to attack.' } },
  { id: 'arcanos', name: { es: 'Arcanos', en: 'Arcana' }, ability: 'int',
    desc: { es: 'Recordar saber sobre conjuros, objetos mágicos, símbolos arcanos, planos de existencia y criaturas mágicas.', en: 'Recall lore about spells, magic items, and the planes of existence.' },
    examples: { es: 'Identificar un conjuro que ves lanzar, reconocer un círculo de invocación.', en: 'Identify a spell being cast, recognize a summoning circle.' } },
  { id: 'atletismo', name: { es: 'Atletismo', en: 'Athletics' }, ability: 'str',
    desc: { es: 'Escalar, saltar, nadar y proezas de fuerza física.', en: 'Jump farther than normal, stay afloat in rough water, or break something.' },
    examples: { es: 'Trepar un muro, nadar contra corriente, saltar un foso largo.', en: 'Climb a wall, swim against a current, leap across a wide pit.' } },
  { id: 'engano', name: { es: 'Engaño', en: 'Deception' }, ability: 'cha',
    desc: { es: 'Ocultar la verdad de forma convincente, con palabras o actos.', en: 'Tell a convincing lie, or wear a disguise convincingly.' },
    examples: { es: 'Mentir a un guardia, disfrazarte, hacer trampas en un juego.', en: 'Lie to a guard, pass off a disguise, cheat at a game.' } },
  { id: 'historia', name: { es: 'Historia', en: 'History' }, ability: 'int',
    desc: { es: 'Recordar hechos históricos, reinos, guerras, leyendas y personajes del pasado.', en: 'Recall lore about historical events, people, nations, and cultures.' },
    examples: { es: 'Saber quién construyó unas ruinas o qué pasó en una batalla antigua.', en: 'Know who built some ruins or what happened in an ancient battle.' } },
  { id: 'perspicacia', name: { es: 'Perspicacia', en: 'Insight' }, ability: 'wis',
    desc: { es: 'Discernir las verdaderas intenciones o el estado de ánimo de una criatura.', en: 'Discern a person’s mood and intentions.' },
    examples: { es: 'Detectar una mentira, anticipar el siguiente movimiento de alguien.', en: 'Notice a lie, predict someone’s next move.' }, senses: ['sight', 'hearing'] },
  { id: 'intimidacion', name: { es: 'Intimidación', en: 'Intimidation' }, ability: 'cha',
    desc: { es: 'Influir en otros mediante amenazas, hostilidad o violencia implícita.', en: 'Awe or threaten someone into doing what you want.' },
    examples: { es: 'Sacar información a un prisionero, disuadir a unos matones.', en: 'Get information out of a prisoner, scare off some thugs.' } },
  { id: 'investigacion', name: { es: 'Investigación', en: 'Investigation' }, ability: 'int',
    desc: { es: 'Buscar pistas y deducir a partir de ellas.', en: 'Find obscure information in books, or deduce how something works.' },
    examples: { es: 'Encontrar un compartimento secreto, deducir el arma de un asesinato.', en: 'Find a hidden compartment, deduce what weapon was used in a murder.' }, senses: ['sight'] },
  { id: 'medicina', name: { es: 'Medicina', en: 'Medicine' }, ability: 'wis',
    desc: { es: 'Diagnosticar dolencias, estabilizar a moribundos y determinar causas de muerte.', en: 'Diagnose an illness, or determine what killed the recently slain.' },
    examples: { es: 'Estabilizar a un aliado a 0 PG (prueba CD 10).', en: 'Stabilize an ally at 0 HP (DC 10 check).' } },
  { id: 'naturaleza', name: { es: 'Naturaleza', en: 'Nature' }, ability: 'int',
    desc: { es: 'Recordar saber sobre terreno, plantas, animales, clima y ciclos naturales.', en: 'Recall lore about terrain, plants, animals, and weather.' },
    examples: { es: 'Identificar una planta venenosa, prever una tormenta.', en: 'Identify a poisonous plant, predict a storm.' } },
  { id: 'percepcion', name: { es: 'Percepción', en: 'Perception' }, ability: 'wis',
    desc: { es: 'Darte cuenta de lo que te rodea usando tus sentidos.', en: 'Using a combination of senses, notice something that’s easy to miss.' },
    examples: { es: 'Oír una conversación tras una puerta, ver una emboscada.', en: 'Hear a conversation through a door, spot an ambush.' }, senses: ['sight', 'hearing'] },
  { id: 'interpretacion', name: { es: 'Interpretación', en: 'Performance' }, ability: 'cha',
    desc: { es: 'Entretener a un público con música, danza, actuación o narración.', en: 'Act, tell a story, perform music, or dance.' },
    examples: { es: 'Tocar en una taberna, distraer a los guardias con un número.', en: 'Play in a tavern, distract the guards with a show.' } },
  { id: 'persuasion', name: { es: 'Persuasión', en: 'Persuasion' }, ability: 'cha',
    desc: { es: 'Influir en otros con tacto, buenos modales o buena fe.', en: 'Honestly and graciously convince someone of something.' },
    examples: { es: 'Negociar un precio, convencer al rey de que te escuche.', en: 'Haggle over a price, convince the king to hear you out.' } },
  { id: 'religion', name: { es: 'Religión', en: 'Religion' }, ability: 'int',
    desc: { es: 'Recordar saber sobre dioses, ritos, oraciones, jerarquías religiosas y no muertos.', en: 'Recall lore about gods, religious rituals, and holy symbols.' },
    examples: { es: 'Reconocer el símbolo de un culto, saber cómo destruir a un no muerto.', en: 'Recognize a cult’s symbol, know how to destroy an undead.' } },
  { id: 'juego_manos', name: { es: 'Juego de manos', en: 'Sleight of Hand' }, ability: 'dex',
    desc: { es: 'Prestidigitación, robar carteras y manipulaciones manuales discretas.', en: 'Pick a pocket, conceal a handheld object, or perform legerdemain.' },
    examples: { es: 'Plantar algo en el bolsillo de otro, esconder un objeto en la manga.', en: 'Plant something on someone, hide an object up your sleeve.' }, senses: ['sight'] },
  { id: 'sigilo', name: { es: 'Sigilo', en: 'Stealth' }, ability: 'dex',
    desc: { es: 'Ocultarte y moverte sin ser detectado. La acción Esconderse usa Sigilo (CD 15).', en: 'Escape notice by moving quietly and hiding behind things. The Hide action uses Stealth (DC 15).' },
    examples: { es: 'Pasar junto a unos guardias, esconderte tras una columna.', en: 'Sneak past guards, hide behind a pillar.' } },
  { id: 'supervivencia', name: { es: 'Supervivencia', en: 'Survival' }, ability: 'wis',
    desc: { es: 'Rastrear, cazar, orientarte y evitar peligros naturales.', en: 'Follow tracks, forage, find a trail, or avoid natural hazards.' },
    examples: { es: 'Seguir huellas, encontrar refugio, no perderte en un bosque.', en: 'Follow tracks, find shelter, avoid getting lost in a forest.' }, senses: ['sight'] },
];

export const skillName = (id: string) => L(SKILLS.find((s) => s.id === id)?.name ?? id);

export interface ConditionInfo {
  id: ConditionId;
  name: Tr;
  effects: Tr[];
  /** Resumen mecánico para recordatorios rápidos en combate */
  short: Tr;
}

export const CONDITIONS: ConditionInfo[] = [
  { id: 'agarrado', name: { es: 'Agarrado', en: 'Grappled' },
    short: { es: 'Velocidad 0; desventaja al atacar a otros que no sean quien te agarra.', en: 'Speed 0; disadvantage on attacks against anyone other than the grappler.' },
    effects: [
      { es: 'Tu Velocidad es 0 y no puede aumentar.', en: 'Your Speed is 0 and can’t increase.' },
      { es: 'Tienes desventaja en tiradas de ataque contra cualquier objetivo que no sea quien te agarra.', en: 'You have Disadvantage on attack rolls against any target other than the grappler.' },
      { es: 'Quien te agarra puede arrastrarte (le cuesta 1 pie extra por pie movido, salvo que seas Diminuto o dos tamaños menor).', en: 'The grappler can drag or carry you when it moves, but every foot of movement costs it 1 extra foot unless you are Tiny or two or more sizes smaller.' },
      { es: 'Para escapar: acción, prueba de FUE (Atletismo) o DES (Acrobacias) contra la CD de salvación del agarre.', en: 'To escape: action, Strength (Athletics) or Dexterity (Acrobatics) check against the grapple’s escape DC.' },
    ] },
  { id: 'apresado', name: { es: 'Apresado', en: 'Restrained' },
    short: { es: 'Velocidad 0; ataques contra ti con ventaja; tus ataques con desventaja; desventaja en salvaciones de DES.', en: 'Speed 0; attacks against you have advantage; your attacks have disadvantage; disadvantage on DEX saves.' },
    effects: [
      { es: 'Tu Velocidad es 0 y no puede aumentar.', en: 'Your Speed is 0 and can’t increase.' },
      { es: 'Las tiradas de ataque contra ti tienen ventaja y las tuyas tienen desventaja.', en: 'Attack rolls against you have Advantage, and your attack rolls have Disadvantage.' },
      { es: 'Tienes desventaja en las tiradas de salvación de Destreza.', en: 'You have Disadvantage on Dexterity saving throws.' },
    ] },
  { id: 'asustado', name: { es: 'Asustado', en: 'Frightened' },
    short: { es: 'Desventaja en pruebas y ataques mientras veas la fuente; no puedes acercarte a ella.', en: 'Disadvantage on checks and attacks while the source is in sight; can’t move closer to it.' },
    effects: [
      { es: 'Desventaja en pruebas de característica y tiradas de ataque mientras la fuente del miedo esté a la vista.', en: 'You have Disadvantage on ability checks and attack rolls while the source of fear is within line of sight.' },
      { es: 'No puedes acercarte voluntariamente a la fuente del miedo.', en: 'You can’t willingly move closer to the source of fear.' },
    ] },
  { id: 'aturdido', name: { es: 'Aturdido', en: 'Stunned' },
    short: { es: 'Incapacitado; fallas salvaciones de FUE y DES; ataques contra ti con ventaja.', en: 'Incapacitated; fail STR and DEX saves; attacks against you have advantage.' },
    effects: [
      { es: 'Tienes la condición Incapacitado.', en: 'You have the Incapacitated condition.' },
      { es: 'Fallas automáticamente las salvaciones de Fuerza y Destreza.', en: 'You automatically fail Strength and Dexterity saving throws.' },
      { es: 'Las tiradas de ataque contra ti tienen ventaja.', en: 'Attack rolls against you have Advantage.' },
    ] },
  { id: 'cegado', name: { es: 'Cegado', en: 'Blinded' },
    short: { es: 'No ves; fallas pruebas que requieran vista; ataques contra ti con ventaja y los tuyos con desventaja.', en: 'Can’t see; fail checks requiring sight; attacks against you have advantage, yours have disadvantage.' },
    effects: [
      { es: 'No puedes ver y fallas automáticamente cualquier prueba que requiera la vista.', en: 'You can’t see and automatically fail any ability check that requires sight.' },
      { es: 'Las tiradas de ataque contra ti tienen ventaja y las tuyas tienen desventaja.', en: 'Attack rolls against you have Advantage, and your attack rolls have Disadvantage.' },
    ] },
  { id: 'derribado', name: { es: 'Derribado', en: 'Prone' },
    short: { es: 'Solo puedes arrastrarte o gastar la mitad de tu velocidad en levantarte; desventaja al atacar; ataques a 5 pies con ventaja, a distancia con desventaja.', en: 'Crawl or spend half your Speed to stand; disadvantage on your attacks; attacks within 5 ft have advantage, others disadvantage.' },
    effects: [
      { es: 'Solo puedes moverte arrastrándote, o gastar una cantidad de movimiento igual a la mitad de tu Velocidad para levantarte (y terminar la condición).', en: 'Your only movement options are to crawl or to spend movement equal to half your Speed to right yourself and end the condition.' },
      { es: 'Tus tiradas de ataque tienen desventaja.', en: 'You have Disadvantage on attack rolls.' },
      { es: 'Los ataques contra ti tienen ventaja si el atacante está a 5 pies o menos; si no, desventaja.', en: 'An attack roll against you has Advantage if the attacker is within 5 feet of you. Otherwise, it has Disadvantage.' },
    ] },
  { id: 'ensordecido', name: { es: 'Ensordecido', en: 'Deafened' },
    short: { es: 'No oyes; fallas pruebas que requieran oído.', en: 'Can’t hear; fail checks requiring hearing.' },
    effects: [{ es: 'No puedes oír y fallas automáticamente cualquier prueba que requiera el oído.', en: 'You can’t hear and automatically fail any ability check that requires hearing.' }] },
  { id: 'envenenado', name: { es: 'Envenenado', en: 'Poisoned' },
    short: { es: 'Desventaja en tiradas de ataque y pruebas de característica.', en: 'Disadvantage on attack rolls and ability checks.' },
    effects: [{ es: 'Tienes desventaja en tiradas de ataque y pruebas de característica.', en: 'You have Disadvantage on attack rolls and ability checks.' }] },
  { id: 'hechizado', name: { es: 'Hechizado', en: 'Charmed' },
    short: { es: 'No puedes atacar a quien te hechizó; tiene ventaja en pruebas sociales contigo.', en: 'Can’t attack the charmer; it has advantage on social checks with you.' },
    effects: [
      { es: 'No puedes atacar a quien te hechizó ni elegirlo como objetivo de capacidades o efectos mágicos dañinos.', en: 'You can’t attack the charmer or target the charmer with damaging abilities or magical effects.' },
      { es: 'Quien te hechizó tiene ventaja en las pruebas de característica para interactuar socialmente contigo.', en: 'The charmer has Advantage on any ability check to interact with you socially.' },
    ] },
  { id: 'incapacitado', name: { es: 'Incapacitado', en: 'Incapacitated' },
    short: { es: 'Sin acciones, acciones adicionales ni reacciones; pierdes la concentración; no puedes hablar.', en: 'No actions, bonus actions or reactions; concentration breaks; can’t speak.' },
    effects: [
      { es: 'No puedes realizar ninguna acción, acción adicional ni reacción.', en: 'You can’t take any action, Bonus Action, or Reaction.' },
      { es: 'Tu Concentración se rompe.', en: 'Your Concentration is broken.' },
      { es: 'No puedes hablar.', en: 'You can’t speak.' },
      { es: 'Si estás Incapacitado al tirar iniciativa, tienes desventaja.', en: 'If you’re Incapacitated when you roll Initiative, you have Disadvantage on the roll.' },
    ] },
  { id: 'inconsciente', name: { es: 'Inconsciente', en: 'Unconscious' },
    short: { es: 'Incapacitado y Derribado; sueltas lo que llevas; fallas salvaciones de FUE/DES; ataques contra ti con ventaja y críticos a 5 pies.', en: 'Incapacitated and Prone; drop what you hold; fail STR/DEX saves; attacks against you have advantage and crit within 5 ft.' },
    effects: [
      { es: 'Tienes las condiciones Incapacitado y Derribado, y sueltas lo que lleves en las manos. Al terminar esta condición, sigues Derribado.', en: 'You have the Incapacitated and Prone conditions, and you drop whatever you’re holding. When this condition ends, you remain Prone.' },
      { es: 'Tu Velocidad es 0 y no puede aumentar.', en: 'Your Speed is 0 and can’t increase.' },
      { es: 'Las tiradas de ataque contra ti tienen ventaja.', en: 'Attack rolls against you have Advantage.' },
      { es: 'Fallas automáticamente las salvaciones de Fuerza y Destreza.', en: 'You automatically fail Strength and Dexterity saving throws.' },
      { es: 'Cualquier impacto contra ti es crítico si el atacante está a 5 pies o menos.', en: 'Any attack roll that hits you is a Critical Hit if the attacker is within 5 feet of you.' },
      { es: 'No eres consciente de lo que te rodea.', en: 'You’re unaware of your surroundings.' },
    ] },
  { id: 'invisible', name: { es: 'Invisible', en: 'Invisible' },
    short: { es: 'Ventaja en iniciativa; ataques contra ti con desventaja y los tuyos con ventaja (si no te ven).', en: 'Advantage on initiative; attacks against you have disadvantage and yours advantage (unless they can see you).' },
    effects: [
      { es: 'Sorpresa: si eres invisible al tirar iniciativa, tienes ventaja.', en: 'Surprise: if you’re Invisible when you roll Initiative, you have Advantage on the roll.' },
      { es: 'Oculto: no te afectan efectos que requieran que su origen te vea, salvo que pueda verte.', en: 'Concealed: you aren’t affected by any effect that requires its target to be seen unless the effect’s creator can somehow see you.' },
      { es: 'Las tiradas de ataque contra ti tienen desventaja y las tuyas tienen ventaja (salvo que la otra criatura pueda verte).', en: 'Attack rolls against you have Disadvantage, and your attack rolls have Advantage. If a creature can somehow see you, you don’t gain this benefit against that creature.' },
    ] },
  { id: 'paralizado', name: { es: 'Paralizado', en: 'Paralyzed' },
    short: { es: 'Incapacitado; Velocidad 0; fallas salvaciones de FUE/DES; ataques contra ti con ventaja y críticos a 5 pies.', en: 'Incapacitated; Speed 0; fail STR/DEX saves; attacks against you have advantage and crit within 5 ft.' },
    effects: [
      { es: 'Tienes la condición Incapacitado.', en: 'You have the Incapacitated condition.' },
      { es: 'Tu Velocidad es 0 y no puede aumentar.', en: 'Your Speed is 0 and can’t increase.' },
      { es: 'Fallas automáticamente las salvaciones de Fuerza y Destreza.', en: 'You automatically fail Strength and Dexterity saving throws.' },
      { es: 'Las tiradas de ataque contra ti tienen ventaja.', en: 'Attack rolls against you have Advantage.' },
      { es: 'Cualquier impacto contra ti es crítico si el atacante está a 5 pies o menos.', en: 'Any attack roll that hits you is a Critical Hit if the attacker is within 5 feet of you.' },
    ] },
  { id: 'petrificado', name: { es: 'Petrificado', en: 'Petrified' },
    short: { es: 'Convertido en piedra: incapacitado, velocidad 0, resistencia a todo el daño, inmune a veneno.', en: 'Turned to stone: incapacitated, Speed 0, resistance to all damage, immune to poison.' },
    effects: [
      { es: 'Te transformas, junto con lo que llevas, en una sustancia sólida e inanimada. Tu peso se multiplica por diez y dejas de envejecer.', en: 'You and any nonmagical objects you are wearing and carrying are transformed into a solid inanimate substance. Your weight increases by a factor of ten, and you cease aging.' },
      { es: 'Tienes la condición Incapacitado y tu Velocidad es 0.', en: 'You have the Incapacitated condition and your Speed is 0.' },
      { es: 'Las tiradas de ataque contra ti tienen ventaja.', en: 'Attack rolls against you have Advantage.' },
      { es: 'Fallas automáticamente las salvaciones de Fuerza y Destreza.', en: 'You automatically fail Strength and Dexterity saving throws.' },
      { es: 'Tienes resistencia a todo el daño.', en: 'You have Resistance to all damage.' },
      { es: 'Eres inmune a la condición Envenenado.', en: 'You have Immunity to the Poisoned condition.' },
    ] },
];

export const conditionName = (id: ConditionId) => L(CONDITIONS.find((x) => x.id === id)!.name);

export const EXHAUSTION_INFO: Tr[] = [
  { es: 'Cada nivel de agotamiento resta 2 × nivel a todas tus pruebas d20 (ataques, pruebas de característica y salvaciones).', en: 'Each level of Exhaustion subtracts 2 × level from all your D20 Tests (attacks, ability checks and saving throws).' },
  { es: 'Tu Velocidad se reduce en 5 pies × nivel.', en: 'Your Speed is reduced by 5 feet × level.' },
  { es: 'Con 6 niveles, mueres.', en: 'At level 6, you die.' },
  { es: 'Un descanso largo elimina 1 nivel de agotamiento.', en: 'Finishing a Long Rest removes 1 Exhaustion level.' },
];

export const DAMAGE_TYPES: { id: DamageType; name: Tr; words: string[] }[] = [
  { id: 'acido', name: { es: 'Ácido', en: 'Acid' }, words: ['acido', 'ácido', 'acid'] },
  { id: 'contundente', name: { es: 'Contundente', en: 'Bludgeoning' }, words: ['contundente', 'maza', 'martillo', 'garrote', 'puñetazo', 'puño', 'caida', 'caída', 'roca', 'piedra', 'bludgeoning', 'club', 'mace', 'hammer', 'punch', 'fist', 'fall', 'rock'] },
  { id: 'frio', name: { es: 'Frío', en: 'Cold' }, words: ['frio', 'frío', 'hielo', 'escarcha', 'cold', 'ice', 'frost'] },
  { id: 'fuego', name: { es: 'Fuego', en: 'Fire' }, words: ['fuego', 'llamas', 'quemadura', 'fire', 'flames', 'burn'] },
  { id: 'fuerza', name: { es: 'Fuerza', en: 'Force' }, words: ['fuerza', 'proyectil mágico', 'proyectil magico', 'force', 'magic missile'] },
  { id: 'relampago', name: { es: 'Relámpago', en: 'Lightning' }, words: ['relampago', 'relámpago', 'rayo', 'eléctrico', 'electrico', 'electricidad', 'lightning', 'electric', 'shock'] },
  { id: 'necrotico', name: { es: 'Necrótico', en: 'Necrotic' }, words: ['necrotico', 'necrótico', 'necrotic'] },
  { id: 'perforante', name: { es: 'Perforante', en: 'Piercing' }, words: ['perforante', 'flecha', 'virote', 'lanza', 'daga', 'mordisco', 'mordedura', 'estoque', 'jabalina', 'piercing', 'arrow', 'bolt', 'spear', 'dagger', 'bite', 'rapier', 'javelin'] },
  { id: 'veneno', name: { es: 'Veneno', en: 'Poison' }, words: ['veneno', 'venenoso', 'poison'] },
  { id: 'psiquico', name: { es: 'Psíquico', en: 'Psychic' }, words: ['psiquico', 'psíquico', 'psychic'] },
  { id: 'radiante', name: { es: 'Radiante', en: 'Radiant' }, words: ['radiante', 'radiant'] },
  { id: 'cortante', name: { es: 'Cortante', en: 'Slashing' }, words: ['cortante', 'espada', 'hacha', 'garra', 'garras', 'cimitarra', 'tajo', 'cuchillada', 'slashing', 'sword', 'axe', 'claw', 'claws', 'scimitar'] },
  { id: 'trueno', name: { es: 'Trueno', en: 'Thunder' }, words: ['trueno', 'sónico', 'sonico', 'thunder'] },
];

export const damageTypeName = (d: DamageType) => L(DAMAGE_TYPES.find((x) => x.id === d)!.name);

export type ActionCost = 'action' | 'bonus' | 'reaction' | 'movement' | 'free';
export const COST_NAMES: Record<ActionCost, Tr> = {
  action: { es: 'acción', en: 'action' },
  bonus: { es: 'acción adicional', en: 'bonus action' },
  reaction: { es: 'reacción', en: 'reaction' },
  movement: { es: 'movimiento', en: 'movement' },
  free: { es: 'gratis', en: 'free' },
};

export interface ActionInfo {
  id: string;
  name: Tr;
  cost: ActionCost;
  text: Tr;
}

export const ACTIONS: ActionInfo[] = [
  { id: 'atacar', name: { es: 'Atacar', en: 'Attack' }, cost: 'action', text: { es: 'Realiza un ataque con un arma o un ataque sin armas. Con el rasgo Ataque extra haces más ataques con la misma acción. Puedes equipar o desequipar un arma como parte de cada ataque.', en: 'Make an attack with a weapon or an Unarmed Strike. With Extra Attack you make more attacks with the same action. You can equip or unequip one weapon as part of each attack.' } },
  { id: 'correr', name: { es: 'Correr', en: 'Dash' }, cost: 'action', text: { es: 'Ganas movimiento adicional igual a tu Velocidad (tras aplicar modificadores) durante este turno.', en: 'For the rest of the turn, you gain extra movement equal to your Speed, after applying any modifiers.' } },
  { id: 'destrabarse', name: { es: 'Destrabarse', en: 'Disengage' }, cost: 'action', text: { es: 'Tu movimiento no provoca ataques de oportunidad durante el resto del turno.', en: 'Your movement doesn’t provoke Opportunity Attacks for the rest of the turn.' } },
  { id: 'esquivar', name: { es: 'Esquivar', en: 'Dodge' }, cost: 'action', text: { es: 'Hasta el inicio de tu siguiente turno, los ataques contra ti tienen desventaja (si ves al atacante) y tienes ventaja en salvaciones de DES. Lo pierdes si quedas Incapacitado o tu Velocidad es 0.', en: 'Until the start of your next turn, attack rolls against you have Disadvantage if you can see the attacker, and you make Dexterity saving throws with Advantage. You lose this benefit if you have the Incapacitated condition or your Speed is 0.' } },
  { id: 'ayudar', name: { es: 'Ayudar', en: 'Help' }, cost: 'action', text: { es: 'Ayudas a un aliado en una prueba (tiene ventaja en la siguiente prueba con esa habilidad/herramienta) o distraes a un enemigo a 5 pies (el siguiente ataque de un aliado contra él tiene ventaja).', en: 'Assist an ally’s ability check (they have Advantage on their next check with that skill or tool) or distract an enemy within 5 feet (the next attack roll by one of your allies against it has Advantage).' } },
  { id: 'esconderse', name: { es: 'Esconderse', en: 'Hide' }, cost: 'action', text: { es: 'Prueba de DES (Sigilo) CD 15 estando fuera de la vista. Si tienes éxito ganas la condición Invisible y tu total es la CD para encontrarte. Termina si haces ruido, atacas, lanzas un conjuro con componente verbal o te encuentran.', en: 'Make a DC 15 Dexterity (Stealth) check while out of sight. On a success, you have the Invisible condition and your total is the DC to find you. It ends if you make noise, attack, cast a spell with a Verbal component, or are found.' } },
  { id: 'influir', name: { es: 'Influir', en: 'Influence' }, cost: 'action', text: { es: 'Intentas convencer a un monstruo con Engaño, Intimidación, Interpretación, Persuasión o Trato con animales. El DM decide la actitud y la CD (normalmente 15 o la INT del monstruo).', en: 'Urge a monster to do something with Deception, Intimidation, Performance, Persuasion or Animal Handling. The DM determines its attitude and the DC (usually 15 or the monster’s Intelligence score).' } },
  { id: 'magia', name: { es: 'Magia', en: 'Magic' }, cost: 'action', text: { es: 'Lanzas un conjuro con tiempo de lanzamiento de una acción, usas un objeto mágico o un rasgo mágico.', en: 'Cast a spell that has a casting time of an action, use a magic item, or use a magical feature.' } },
  { id: 'preparar', name: { es: 'Preparar', en: 'Ready' }, cost: 'action', text: { es: 'Eliges un desencadenante y una acción (o moverte). Cuando ocurre, puedes usar tu reacción para realizarla. Preparar un conjuro requiere Concentración.', en: 'Choose a trigger and an action (or moving). When the trigger occurs, you can use your Reaction to do it. Readying a spell requires Concentration.' } },
  { id: 'buscar', name: { es: 'Buscar', en: 'Search' }, cost: 'action', text: { es: 'Prueba de Sabiduría (Perspicacia, Medicina, Percepción o Supervivencia) para notar algo que no es obvio.', en: 'Make a Wisdom (Insight, Medicine, Perception or Survival) check to discern something that isn’t obvious.' } },
  { id: 'estudiar', name: { es: 'Estudiar', en: 'Study' }, cost: 'action', text: { es: 'Prueba de Inteligencia (Arcanos, Historia, Investigación, Naturaleza o Religión) para recordar o deducir algo.', en: 'Make an Intelligence (Arcana, History, Investigation, Nature or Religion) check to recall or deduce something.' } },
  { id: 'utilizar', name: { es: 'Utilizar', en: 'Utilize' }, cost: 'action', text: { es: 'Usas un objeto no mágico.', en: 'Use a nonmagical object.' } },
  { id: 'ataque_oportunidad', name: { es: 'Ataque de oportunidad', en: 'Opportunity Attack' }, cost: 'reaction', text: { es: 'Cuando una criatura que puedes ver sale de tu alcance, puedes hacerle un ataque cuerpo a cuerpo.', en: 'When a creature you can see leaves your reach, you can make one melee attack against it.' } },
  { id: 'interactuar', name: { es: 'Interacción con objeto', en: 'Object interaction' }, cost: 'free', text: { es: 'Una vez por turno puedes interactuar gratis con un objeto (abrir una puerta, sacar algo de la mochila) durante tu movimiento o acción.', en: 'Once per turn you can interact with one object for free (open a door, draw an item) during your move or action.' } },
  { id: 'pocion', name: { es: 'Beber/dar poción', en: 'Drink/administer potion' }, cost: 'bonus', text: { es: 'En las reglas 2024, beber una poción o administrarla a otra criatura es una acción adicional.', en: 'In the 2024 rules, drinking a potion or administering it to another creature is a Bonus Action.' } },
  { id: 'levantarse', name: { es: 'Levantarse', en: 'Stand up' }, cost: 'movement', text: { es: 'Si estás Derribado, gastas la mitad de tu Velocidad para levantarte.', en: 'If you’re Prone, spend half your Speed to stand up.' } },
];

export interface RuleTopic {
  id: string;
  name: Tr;
  text: Tr[];
}

export const RULES: RuleTopic[] = [
  { id: 'ventaja', name: { es: 'Ventaja y desventaja', en: 'Advantage and Disadvantage' }, text: [
    { es: 'Ventaja: tiras dos d20 y usas el mayor. Desventaja: tiras dos y usas el menor.', en: 'Advantage: roll two d20s and use the higher. Disadvantage: roll two and use the lower.' },
    { es: 'Si tienes ventaja y desventaja a la vez, se anulan y tiras un solo d20, sin importar cuántas fuentes haya de cada una.', en: 'If you have both, they cancel out and you roll one d20, no matter how many sources of each.' },
  ] },
  { id: 'critico', name: { es: 'Golpe crítico', en: 'Critical Hit' }, text: [
    { es: 'Un 20 natural en una tirada de ataque siempre impacta y es crítico: tiras los dados de daño del ataque dos veces y sumas los modificadores una vez.', en: 'A natural 20 on an attack roll always hits and is a Critical Hit: roll the attack’s damage dice twice and add modifiers once.' },
    { es: 'Un 1 natural en una tirada de ataque siempre falla.', en: 'A natural 1 on an attack roll always misses.' },
  ] },
  { id: 'dano', name: { es: 'Orden para aplicar daño', en: 'Applying damage' }, text: [
    { es: '1) Se aplican primero los bonificadores/penalizadores planos al daño.', en: '1) Apply flat bonuses and penalties first.' },
    { es: '2) Resistencia: el daño se reduce a la mitad (redondeando hacia abajo). Varias resistencias al mismo tipo cuentan como una.', en: '2) Resistance: damage is halved (round down). Multiple instances of Resistance count as one.' },
    { es: '3) Vulnerabilidad: el daño se duplica.', en: '3) Vulnerability: damage is doubled.' },
    { es: 'Inmunidad: no recibes daño de ese tipo.', en: 'Immunity: you take no damage of that type.' },
    { es: 'Los PG temporales absorben el daño primero; el resto se resta de tus PG.', en: 'Temporary Hit Points absorb damage first; the rest comes off your Hit Points.' },
  ] },
  { id: 'pg_temporales', name: { es: 'Puntos de golpe temporales', en: 'Temporary Hit Points' }, text: [
    { es: 'Son un colchón que absorbe daño antes que tus PG reales. No se suman entre sí: si recibes nuevos, eliges quedarte con los que tienes o con los nuevos.', en: 'A buffer against damage. They don’t stack: if you gain new ones, you decide whether to keep the ones you have or take the new ones.' },
    { es: 'La curación no los restaura. Desaparecen tras un descanso largo salvo que el efecto indique otra duración.', en: 'Healing can’t restore them. They last until you finish a Long Rest unless a feature says otherwise.' },
  ] },
  { id: 'cero_pg', name: { es: 'Caer a 0 PG y muerte instantánea', en: 'Dropping to 0 HP and instant death' }, text: [
    { es: 'Si el daño te deja a 0 PG y el daño sobrante es igual o mayor que tus PG máximos, mueres instantáneamente.', en: 'If damage reduces you to 0 HP and the remaining damage equals or exceeds your Hit Point maximum, you die.' },
    { es: 'Si no, quedas Inconsciente y empiezas a hacer salvaciones contra la muerte.', en: 'Otherwise you fall Unconscious and start making Death Saving Throws.' },
    { es: 'Si recibes daño estando a 0 PG sufres un fallo de salvación contra la muerte (dos si el golpe es crítico). Si ese daño es igual o mayor que tus PG máximos, mueres.', en: 'Taking damage at 0 HP causes a Death Saving Throw failure (two on a Critical Hit). If that damage equals or exceeds your Hit Point maximum, you die.' },
    { es: 'Cualquier curación te devuelve la consciencia y reinicia las salvaciones contra la muerte.', en: 'Any healing restores consciousness and resets your Death Saving Throws.' },
  ] },
  { id: 'salvaciones_muerte', name: { es: 'Salvaciones contra la muerte', en: 'Death Saving Throws' }, text: [
    { es: 'Al inicio de cada uno de tus turnos a 0 PG, tira un d20 sin modificadores: 10 o más es un éxito; 9 o menos, un fallo.', en: 'At the start of each of your turns at 0 HP, roll a d20 with no modifiers: 10 or higher succeeds, 9 or lower fails.' },
    { es: 'Tres éxitos: quedas Estable. Tres fallos: mueres.', en: 'Three successes: you become Stable. Three failures: you die.' },
    { es: 'Un 1 natural cuenta como dos fallos. Un 20 natural te devuelve 1 PG.', en: 'A natural 1 counts as two failures. A natural 20 restores 1 Hit Point.' },
    { es: 'Estabilizar a alguien: acción Utilizar con un kit de sanador, o prueba de Sabiduría (Medicina) CD 10.', en: 'Stabilizing someone: Utilize a Healer’s Kit, or a DC 10 Wisdom (Medicine) check.' },
  ] },
  { id: 'concentracion', name: { es: 'Concentración', en: 'Concentration' }, text: [
    { es: 'Solo puedes concentrarte en un conjuro a la vez. Lanzar otro con concentración termina el anterior.', en: 'You can concentrate on only one spell at a time. Casting another Concentration spell ends the first.' },
    { es: 'Si recibes daño, haz una salvación de Constitución con CD igual a 10 o la mitad del daño (lo que sea mayor), con un máximo de CD 30.', en: 'When you take damage, make a Constitution saving throw: DC 10 or half the damage taken (whichever is higher), up to DC 30.' },
    { es: 'La pierdes también si quedas Incapacitado o mueres.', en: 'It also ends if you have the Incapacitated condition or die.' },
  ] },
  { id: 'descansos', name: { es: 'Descansos', en: 'Rests' }, text: [
    { es: 'Descanso corto (1 hora): puedes gastar Dados de Golpe; por cada uno tiras el dado y sumas tu mod. de CON para recuperar PG.', en: 'Short Rest (1 hour): you can spend Hit Point Dice; for each, roll it and add your CON modifier to regain HP.' },
    { es: 'Descanso largo (8 horas): recuperas todos los PG y todos los Dados de Golpe gastados, recuperas espacios de conjuro y reduces tu Agotamiento en 1.', en: 'Long Rest (8 hours): regain all HP and all spent Hit Point Dice, regain spell slots, and reduce Exhaustion by 1.' },
  ] },
  { id: 'cobertura', name: { es: 'Cobertura', en: 'Cover' }, text: [
    { es: 'Media cobertura: +2 a CA y salvaciones de DES.', en: 'Half Cover: +2 to AC and Dexterity saving throws.' },
    { es: 'Tres cuartos de cobertura: +5 a CA y salvaciones de DES.', en: 'Three-Quarters Cover: +5 to AC and Dexterity saving throws.' },
    { es: 'Cobertura total: no puedes ser objetivo directo de ataques ni conjuros.', en: 'Total Cover: you can’t be targeted directly by attacks or spells.' },
  ] },
  { id: 'agarre', name: { es: 'Agarrar y empujar (ataque sin armas)', en: 'Grapple and Shove (Unarmed Strike)' }, text: [
    { es: 'Un ataque sin armas puede infligir daño (1 + mod. FUE contundente), agarrar o empujar.', en: 'An Unarmed Strike can deal damage (1 + STR mod bludgeoning), grapple or shove.' },
    { es: 'Agarrar o empujar: el objetivo hace una salvación de FUE o DES (a su elección) contra CD 8 + mod. FUE + bonificador de competencia.', en: 'Grapple or Shove: the target makes a STR or DEX save (its choice) against DC 8 + STR mod + Proficiency Bonus.' },
    { es: 'Empujar: lo alejas 5 pies o lo derribas.', en: 'Shove: push it 5 feet away or knock it Prone.' },
  ] },
  { id: 'iniciativa', name: { es: 'Iniciativa', en: 'Initiative' }, text: [
    { es: 'Prueba de Destreza al inicio del combate. Es una prueba d20, así que el agotamiento la penaliza.', en: 'A Dexterity check at the start of combat. It’s a D20 Test, so Exhaustion applies.' },
    { es: 'Invisible: ventaja. Incapacitado: desventaja. Sorprendido: desventaja.', en: 'Invisible: Advantage. Incapacitated: Disadvantage. Surprised: Disadvantage.' },
  ] },
  { id: 'arma_ligera', name: { es: 'Armas ligeras (dos armas)', en: 'Light weapons (two-weapon fighting)' }, text: [
    { es: 'Si atacas con un arma Ligera como parte de la acción Atacar, puedes hacer un ataque extra como acción adicional con otra arma Ligera distinta. No sumas tu modificador al daño de ese ataque extra salvo que sea negativo.', en: 'When you attack with a Light weapon as part of the Attack action, you can make an extra attack as a Bonus Action with a different Light weapon. You don’t add your ability modifier to its damage unless it’s negative.' },
  ] },
  { id: 'inspiracion', name: { es: 'Inspiración heroica', en: 'Heroic Inspiration' }, text: [
    { es: 'Si la tienes, puedes gastarla para volver a tirar cualquier dado inmediatamente después de tirarlo, y debes usar el nuevo resultado.', en: 'If you have it, you can expend it to reroll any die immediately after rolling it, and you must use the new roll.' },
  ] },
  { id: 'caida', name: { es: 'Caída', en: 'Falling' }, text: [
    { es: 'Recibes 1d6 de daño contundente por cada 10 pies de caída (máximo 20d6) y quedas Derribado.', en: 'You take 1d6 Bludgeoning damage per 10 feet fallen (max 20d6) and land Prone.' },
  ] },
];

export const MASTERIES: { id: string; name: Tr; text: Tr }[] = [
  { id: 'cleave', name: { es: 'Hender', en: 'Cleave' }, text: { es: 'Si impactas a una criatura, puedes hacer otro ataque con la misma arma contra otra criatura a 5 pies de la primera y a tu alcance. Si impacta, no sumas tu modificador al daño. Una vez por turno.', en: 'If you hit a creature, you can make another attack with the same weapon against a second creature within 5 feet of the first and within your reach. On a hit, don’t add your ability modifier to the damage. Once per turn.' } },
  { id: 'graze', name: { es: 'Rozar', en: 'Graze' }, text: { es: 'Si fallas el ataque, la criatura recibe daño igual al modificador de característica que usaste.', en: 'If your attack misses, the creature takes damage equal to the ability modifier you used.' } },
  { id: 'nick', name: { es: 'Mellar', en: 'Nick' }, text: { es: 'El ataque extra de la propiedad Ligera lo haces como parte de la acción Atacar en lugar de como acción adicional. Una vez por turno.', en: 'Make the extra attack of the Light property as part of the Attack action instead of as a Bonus Action. Once per turn.' } },
  { id: 'push', name: { es: 'Empujar', en: 'Push' }, text: { es: 'Si impactas, puedes empujar a la criatura hasta 10 pies alejándola de ti, si es Grande o menor.', en: 'If you hit, you can push the creature up to 10 feet straight away from you if it is Large or smaller.' } },
  { id: 'sap', name: { es: 'Debilitar', en: 'Sap' }, text: { es: 'Si impactas, la criatura tiene desventaja en su siguiente tirada de ataque antes del inicio de tu siguiente turno.', en: 'If you hit, the creature has Disadvantage on its next attack roll before the start of your next turn.' } },
  { id: 'slow', name: { es: 'Ralentizar', en: 'Slow' }, text: { es: 'Si impactas e infliges daño, su Velocidad se reduce 10 pies hasta el inicio de tu siguiente turno.', en: 'If you hit and deal damage, its Speed is reduced by 10 feet until the start of your next turn.' } },
  { id: 'topple', name: { es: 'Derribar', en: 'Topple' }, text: { es: 'Si impactas, la criatura hace una salvación de CON (CD 8 + mod. de ataque + competencia) o queda Derribada.', en: 'If you hit, the creature makes a CON save (DC 8 + attack ability mod + Proficiency Bonus) or has the Prone condition.' } },
  { id: 'vex', name: { es: 'Incordiar', en: 'Vex' }, text: { es: 'Si impactas e infliges daño, tienes ventaja en tu siguiente tirada de ataque contra esa criatura antes del final de tu siguiente turno.', en: 'If you hit and deal damage, you have Advantage on your next attack roll against that creature before the end of your next turn.' } },
];

/** Busca una maestría por id o por cualquiera de sus nombres (incluye datos guardados en versiones anteriores) */
export const findMastery = (m?: string) =>
  m ? MASTERIES.find((x) => x.id === m || m.toLowerCase().includes(x.name.es.toLowerCase()) || m.toLowerCase().includes(x.name.en.toLowerCase()) || m.toLowerCase().includes(`(${x.id})`)) : undefined;

// ---------- Clases ----------

export type CasterType = 'full' | 'half' | 'pact' | 'none';

export interface ResourceDef {
  key: string;
  max: number;
  recovers: 'short' | 'long';
}

export const RESOURCE_NAMES: Record<string, Tr> = {
  rage: { es: 'Furia', en: 'Rage' },
  bardic_inspiration: { es: 'Inspiración bárdica', en: 'Bardic Inspiration' },
  channel_divinity: { es: 'Canalizar divinidad', en: 'Channel Divinity' },
  wild_shape: { es: 'Forma salvaje', en: 'Wild Shape' },
  second_wind: { es: 'Tomar aliento', en: 'Second Wind' },
  action_surge: { es: 'Oleada de acción', en: 'Action Surge' },
  indomitable: { es: 'Indomable', en: 'Indomitable' },
  focus: { es: 'Puntos de concentración', en: 'Focus Points' },
  lay_on_hands: { es: 'Imposición de manos (PG)', en: 'Lay On Hands (HP)' },
  favored_enemy: { es: 'Marca del cazador gratis', en: 'Favored Enemy (free Hunter’s Mark)' },
  innate_sorcery: { es: 'Hechicería innata', en: 'Innate Sorcery' },
  sorcery_points: { es: 'Puntos de hechicería', en: 'Sorcery Points' },
  arcane_recovery: { es: 'Recuperación arcana', en: 'Arcane Recovery' },
  stone_giant: { es: 'Gigante de piedra', en: 'Stone’s Endurance' },
};

export const resourceName = (r: { key?: string; name: string }) => (r.key && RESOURCE_NAMES[r.key] ? L(RESOURCE_NAMES[r.key]) : r.name);

/** Recursos que en 2024 recuperan un uso tras un descanso corto aunque se recarguen del todo en el largo */
export const SHORT_REST_ONE_USE = ['rage', 'second_wind', 'channel_divinity', 'wild_shape'];

export interface ClassInfo {
  id: string;
  name: Tr;
  hitDie: number;
  saves: Ability[];
  caster: CasterType;
  spellAbility: Ability | null;
  resources: (level: number, mods: Record<Ability, number>) => ResourceDef[];
  features: (level: number) => { name: Tr; text: Tr }[];
}

const byLevel = (level: number, table: [number, number][]) => {
  let v = 0;
  for (const [l, n] of table) if (level >= l) v = n;
  return v;
};

const f = (es: string, en: string, tes: string, ten: string) => ({ name: { es, en }, text: { es: tes, en: ten } });

export const CLASSES: ClassInfo[] = [
  { id: 'barbaro', name: { es: 'Bárbaro', en: 'Barbarian' }, hitDie: 12, saves: ['str', 'con'], caster: 'none', spellAbility: null,
    resources: (l) => [{ key: 'rage', max: byLevel(l, [[1, 2], [3, 3], [6, 4], [12, 5], [17, 6]]), recovers: 'long' }],
    features: (l) => {
      const dmg = l >= 16 ? 4 : l >= 9 ? 3 : 2;
      return [
        f('Furia', 'Rage', `Acción adicional. Resistencia a daño contundente, cortante y perforante; +${dmg} al daño con ataques de FUE; ventaja en pruebas y salvaciones de FUE; no puedes lanzar conjuros ni concentrarte. Dura hasta el final de tu siguiente turno y se prolonga si atacas, fuerzas una salvación o usas una acción adicional para mantenerla (máx. 10 min). Recuperas 1 uso en descanso corto.`,
          `Bonus Action. Resistance to Bludgeoning, Piercing and Slashing damage; +${dmg} damage with STR attacks; Advantage on STR checks and saves; you can’t cast spells or concentrate. Lasts until the end of your next turn and is extended if you attack, force a save or take a Bonus Action to extend it (max 10 min). Regain 1 use on a Short Rest.`),
        f('Defensa sin armadura', 'Unarmored Defense', 'Sin armadura: CA = 10 + mod. DES + mod. CON (puedes usar escudo).', 'Without armor: AC = 10 + DEX mod + CON mod (a Shield is allowed).'),
        f('Maestría con armas', 'Weapon Mastery', 'Puedes usar las propiedades de maestría de algunas armas.', 'You can use the mastery properties of some weapons.'),
        ...(l >= 2 ? [
          f('Ataque temerario', 'Reckless Attack', 'Al hacer tu primer ataque del turno puedes darte ventaja en ataques de FUE hasta tu siguiente turno, pero los ataques contra ti tienen ventaja.', 'When you make your first attack on your turn, you can give yourself Advantage on STR attacks until your next turn, but attacks against you have Advantage.'),
          f('Sentido del peligro', 'Danger Sense', 'Ventaja en salvaciones de DES salvo que estés Incapacitado.', 'Advantage on DEX saves unless you are Incapacitated.'),
        ] : []),
        ...(l >= 5 ? [
          f('Ataque extra', 'Extra Attack', 'Atacas dos veces con la acción Atacar.', 'You attack twice when you take the Attack action.'),
          f('Movimiento rápido', 'Fast Movement', '+10 pies de Velocidad sin armadura pesada.', '+10 feet Speed while not wearing Heavy armor.'),
        ] : []),
      ];
    } },
  { id: 'bardo', name: { es: 'Bardo', en: 'Bard' }, hitDie: 8, saves: ['dex', 'cha'], caster: 'full', spellAbility: 'cha',
    resources: (l, m) => [{ key: 'bardic_inspiration', max: Math.max(1, m.cha), recovers: l >= 5 ? 'short' : 'long' }],
    features: (l) => {
      const die = l >= 15 ? 12 : l >= 10 ? 10 : l >= 5 ? 8 : 6;
      return [
        f('Inspiración bárdica', 'Bardic Inspiration', `Acción adicional: una criatura a 60 pies gana un dado d${die} que puede sumar a una prueba d20 que falle en la siguiente hora.`, `Bonus Action: a creature within 60 feet gains a d${die} it can add to a failed D20 Test within the next hour.`),
        ...(l >= 2 ? [
          f('Experto', 'Expertise', 'Pericia en dos habilidades.', 'Expertise in two skills.'),
          f('Aprendiz de todo', 'Jack of All Trades', 'Sumas la mitad de tu bonificador de competencia a pruebas sin competencia.', 'Add half your Proficiency Bonus to ability checks you aren’t proficient in.'),
        ] : []),
      ];
    } },
  { id: 'clerigo', name: { es: 'Clérigo', en: 'Cleric' }, hitDie: 8, saves: ['wis', 'cha'], caster: 'full', spellAbility: 'wis',
    resources: (l) => (l >= 2 ? [{ key: 'channel_divinity', max: byLevel(l, [[2, 2], [6, 3], [18, 4]]), recovers: 'long' as const }] : []),
    features: (l) => [
      f('Orden divina', 'Divine Order', 'Protector (armadura pesada y armas marciales) o Taumaturgo (truco extra y bonus a Arcanos/Religión).', 'Protector (Heavy armor and Martial weapons) or Thaumaturge (extra cantrip and bonus to Arcana/Religion).'),
      ...(l >= 2 ? [f('Canalizar divinidad', 'Channel Divinity', 'Chispa divina (curar o dañar 1d8 + mod. SAB) o Expulsar no muertos. Recuperas 1 uso en descanso corto.', 'Divine Spark (heal or harm 1d8 + WIS mod) or Turn Undead. Regain 1 use on a Short Rest.')] : []),
    ] },
  { id: 'druida', name: { es: 'Druida', en: 'Druid' }, hitDie: 8, saves: ['int', 'wis'], caster: 'full', spellAbility: 'wis',
    resources: (l) => (l >= 2 ? [{ key: 'wild_shape', max: byLevel(l, [[2, 2], [6, 3], [17, 4]]), recovers: 'long' as const }] : []),
    features: (l) => [
      f('Druídico', 'Druidic', 'Conoces el idioma secreto de los druidas. Siempre tienes preparado Hablar con los animales.', 'You know the secret language of Druids. You always have Speak with Animals prepared.'),
      ...(l >= 2 ? [f('Forma salvaje', 'Wild Shape', 'Acción adicional: te transformas en una bestia conocida. Ganas PG temporales iguales a tu nivel de druida. Recuperas 1 uso en descanso corto.', 'Bonus Action: shape-shift into a known Beast form. Gain Temporary HP equal to your Druid level. Regain 1 use on a Short Rest.')] : []),
    ] },
  { id: 'guerrero', name: { es: 'Guerrero', en: 'Fighter' }, hitDie: 10, saves: ['str', 'con'], caster: 'none', spellAbility: null,
    resources: (l) => [
      { key: 'second_wind', max: byLevel(l, [[1, 2], [4, 3], [10, 4]]), recovers: 'long' },
      ...(l >= 2 ? [{ key: 'action_surge', max: l >= 17 ? 2 : 1, recovers: 'short' as const }] : []),
      ...(l >= 9 ? [{ key: 'indomitable', max: byLevel(l, [[9, 1], [13, 2], [17, 3]]), recovers: 'long' as const }] : []),
    ],
    features: (l) => [
      f('Tomar aliento', 'Second Wind', `Acción adicional: recuperas 1d10 + ${l} PG. Recuperas un uso en descanso corto.`, `Bonus Action: regain 1d10 + ${l} HP. Regain one use on a Short Rest.`),
      f('Estilo de combate', 'Fighting Style', 'Ganas una dote de Estilo de combate (p. ej. Defensa: +1 CA con armadura).', 'You gain a Fighting Style feat (e.g. Defense: +1 AC while wearing armor).'),
      f('Maestría con armas', 'Weapon Mastery', 'Puedes usar las propiedades de maestría de varias armas.', 'You can use the mastery properties of several weapons.'),
      ...(l >= 2 ? [
        f('Oleada de acción', 'Action Surge', 'En tu turno ganas una acción adicional (no la acción Magia).', 'On your turn, you can take one additional action (except the Magic action).'),
        f('Mente táctica', 'Tactical Mind', 'Si fallas una prueba de característica, puedes gastar un uso de Tomar aliento para sumar 1d10.', 'When you fail an ability check, you can expend a use of Second Wind to add 1d10.'),
      ] : []),
      ...(l >= 5 ? [f('Ataque extra', 'Extra Attack', 'Atacas dos veces con la acción Atacar.', 'You attack twice when you take the Attack action.')] : []),
    ] },
  { id: 'monje', name: { es: 'Monje', en: 'Monk' }, hitDie: 8, saves: ['str', 'dex'], caster: 'none', spellAbility: null,
    resources: (l) => (l >= 2 ? [{ key: 'focus', max: l, recovers: 'short' as const }] : []),
    features: (l) => {
      const die = l >= 17 ? 12 : l >= 11 ? 10 : l >= 5 ? 8 : 6;
      return [
        f('Artes marciales', 'Martial Arts', `Dado de artes marciales d${die}. Ataque sin armas como acción adicional; puedes usar DES.`, `Martial Arts die d${die}. Unarmed Strike as a Bonus Action; you can use DEX.`),
        f('Defensa sin armadura', 'Unarmored Defense', 'Sin armadura ni escudo: CA = 10 + mod. DES + mod. SAB.', 'Without armor or Shield: AC = 10 + DEX mod + WIS mod.'),
        ...(l >= 2 ? [f('Ráfaga de golpes / Defensa paciente / Paso del viento', 'Flurry of Blows / Patient Defense / Step of the Wind', 'Gasta 1 punto de concentración para dos ataques sin armas, Destrabarse+Esquivar o Destrabarse+Correr como acción adicional.', 'Spend 1 Focus Point for two Unarmed Strikes, Disengage+Dodge, or Disengage+Dash as a Bonus Action.')] : []),
      ];
    } },
  { id: 'paladin', name: { es: 'Paladín', en: 'Paladin' }, hitDie: 10, saves: ['wis', 'cha'], caster: 'half', spellAbility: 'cha',
    resources: (l) => [
      { key: 'lay_on_hands', max: 5 * l, recovers: 'long' },
      ...(l >= 3 ? [{ key: 'channel_divinity', max: byLevel(l, [[3, 2], [11, 3]]), recovers: 'long' as const }] : []),
    ],
    features: (l) => [
      f('Imposición de manos', 'Lay On Hands', 'Acción adicional: tocas a una criatura y le restauras PG de tu reserva, o gastas 5 para quitarle Envenenado.', 'Bonus Action: touch a creature and restore HP from your pool, or spend 5 to remove the Poisoned condition.'),
      ...(l >= 2 ? [f('Golpe divino', 'Divine Smite', 'Al impactar con un ataque cuerpo a cuerpo gastas un espacio de conjuro para infligir 2d8 radiante extra (+1d8 por nivel por encima de 1; +1d8 contra infernales y no muertos).', 'When you hit with a melee attack, expend a spell slot to deal an extra 2d8 Radiant damage (+1d8 per slot level above 1; +1d8 vs Fiends and Undead).')] : []),
      ...(l >= 5 ? [f('Ataque extra', 'Extra Attack', 'Atacas dos veces con la acción Atacar.', 'You attack twice when you take the Attack action.')] : []),
      ...(l >= 6 ? [f('Aura de protección', 'Aura of Protection', 'Tú y aliados a 10 pies sumáis tu mod. CAR (mín. +1) a las salvaciones.', 'You and allies within 10 feet add your CHA mod (min +1) to saving throws.')] : []),
    ] },
  { id: 'explorador', name: { es: 'Explorador', en: 'Ranger' }, hitDie: 10, saves: ['str', 'dex'], caster: 'half', spellAbility: 'wis',
    resources: (l) => [{ key: 'favored_enemy', max: byLevel(l, [[1, 2], [5, 3], [9, 4], [13, 5], [17, 6]]), recovers: 'long' }],
    features: (l) => [
      f('Enemigo predilecto', 'Favored Enemy', 'Siempre tienes preparado Marca del cazador y puedes lanzarlo sin gastar espacio varias veces por descanso largo.', 'You always have Hunter’s Mark prepared and can cast it without a spell slot a number of times per Long Rest.'),
      ...(l >= 5 ? [f('Ataque extra', 'Extra Attack', 'Atacas dos veces con la acción Atacar.', 'You attack twice when you take the Attack action.')] : []),
    ] },
  { id: 'picaro', name: { es: 'Pícaro', en: 'Rogue' }, hitDie: 8, saves: ['dex', 'int'], caster: 'none', spellAbility: null,
    resources: () => [],
    features: (l) => [
      f('Ataque furtivo', 'Sneak Attack', `Una vez por turno, +${Math.ceil(l / 2)}d6 de daño a un ataque con arma sutil o a distancia si tienes ventaja, o si un aliado está a 5 pies del objetivo y no tienes desventaja.`, `Once per turn, +${Math.ceil(l / 2)}d6 damage to a Finesse or Ranged weapon attack if you have Advantage, or if an ally is within 5 feet of the target and you don’t have Disadvantage.`),
      f('Pericia', 'Expertise', 'Pericia en dos habilidades.', 'Expertise in two skills.'),
      ...(l >= 2 ? [f('Acción astuta', 'Cunning Action', 'Acción adicional: Correr, Destrabarse o Esconderse.', 'Bonus Action: Dash, Disengage, or Hide.')] : []),
      ...(l >= 5 ? [f('Esquiva asombrosa', 'Uncanny Dodge', 'Reacción: cuando un atacante que ves te impacta, reduces el daño a la mitad.', 'Reaction: when an attacker you can see hits you, halve the attack’s damage.')] : []),
      ...(l >= 7 ? [f('Evasión', 'Evasion', 'En salvaciones de DES para mitad de daño: éxito = 0, fallo = mitad.', 'On DEX saves for half damage: success = no damage, failure = half.')] : []),
    ] },
  { id: 'hechicero', name: { es: 'Hechicero', en: 'Sorcerer' }, hitDie: 6, saves: ['con', 'cha'], caster: 'full', spellAbility: 'cha',
    resources: (l) => [
      { key: 'innate_sorcery', max: 2, recovers: 'long' },
      ...(l >= 2 ? [{ key: 'sorcery_points', max: l, recovers: 'long' as const }] : []),
    ],
    features: (l) => [
      f('Hechicería innata', 'Innate Sorcery', 'Acción adicional, 1 min: CD de conjuros +1 y ventaja en ataques de conjuro de hechicero.', 'Bonus Action, 1 minute: +1 spell save DC and Advantage on Sorcerer spell attacks.'),
      ...(l >= 2 ? [f('Metamagia', 'Metamagic', 'Gasta puntos de hechicería para modificar conjuros.', 'Spend Sorcery Points to modify spells.')] : []),
    ] },
  { id: 'brujo', name: { es: 'Brujo', en: 'Warlock' }, hitDie: 8, saves: ['wis', 'cha'], caster: 'pact', spellAbility: 'cha',
    resources: () => [],
    features: () => [
      f('Magia del pacto', 'Pact Magic', 'Tus espacios de conjuro son siempre del nivel máximo que puedes lanzar y se recuperan en descanso corto o largo.', 'Your spell slots are always of your highest available level and you regain them on a Short or Long Rest.'),
      f('Invocaciones sobrenaturales', 'Eldritch Invocations', 'Elige invocaciones (p. ej. Explosión agonizante: + mod. CAR al daño de un truco).', 'Choose invocations (e.g. Agonizing Blast: add CHA mod to a cantrip’s damage).'),
    ] },
  { id: 'mago', name: { es: 'Mago', en: 'Wizard' }, hitDie: 6, saves: ['int', 'wis'], caster: 'full', spellAbility: 'int',
    resources: () => [{ key: 'arcane_recovery', max: 1, recovers: 'long' }],
    features: (l) => [
      f('Libro de conjuros', 'Spellbook', 'Preparas conjuros de tu libro tras un descanso largo.', 'You prepare spells from your spellbook after a Long Rest.'),
      f('Recuperación arcana', 'Arcane Recovery', `Tras un descanso corto recuperas espacios gastados de nivel combinado hasta ${Math.ceil(l / 2)} (ninguno de nivel 6+).`, `After a Short Rest, recover expended slots with a combined level up to ${Math.ceil(l / 2)} (none of level 6+).`),
      ...(l >= 2 ? [f('Erudito', 'Scholar', 'Pericia en una habilidad de INT con la que tengas competencia.', 'Expertise in one INT skill you are proficient in.')] : []),
    ] },
];

/** Busca la clase por id o por su nombre en cualquier idioma */
export const classById = (id: string) => {
  const k = id.trim().toLowerCase();
  return CLASSES.find((c) => c.id === k || c.name.es.toLowerCase() === k || c.name.en.toLowerCase() === k);
};

export const SPECIES: Tr[] = [
  { es: 'Aasimar', en: 'Aasimar' }, { es: 'Dracónido', en: 'Dragonborn' }, { es: 'Elfo', en: 'Elf' }, { es: 'Enano', en: 'Dwarf' },
  { es: 'Gnomo', en: 'Gnome' }, { es: 'Goliat', en: 'Goliath' }, { es: 'Humano', en: 'Human' }, { es: 'Mediano', en: 'Halfling' },
  { es: 'Orco', en: 'Orc' }, { es: 'Tiefling', en: 'Tiefling' },
];

const FULL_CASTER_SLOTS: number[][] = [
  [],
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

export function slotsFor(caster: CasterType, level: number): number[] {
  if (caster === 'full') return FULL_CASTER_SLOTS[level];
  // En 2024 los semilanzadores tienen espacios desde nivel 1: equivale a la mitad (redondeando arriba)
  if (caster === 'half') return FULL_CASTER_SLOTS[Math.ceil(level / 2)];
  return [];
}

export function pactSlotsFor(level: number): { level: number; max: number } {
  const max = level >= 17 ? 4 : level >= 11 ? 3 : level >= 2 ? 2 : 1;
  const slotLevel = Math.min(5, Math.ceil(level / 2));
  return { level: slotLevel, max };
}

// ---------- Efectos predefinidos (beneficios / perjuicios) ----------

/** Etiquetas de ventaja/desventaja de efectos: 'save:dex' = salvaciones de DES, 'check:str' = pruebas de FUE */
export const advLabel = (key: string) => {
  const [kind, ab] = key.split(':') as ['save' | 'check', Ability];
  if (!ab) return key;
  return kind === 'save' ? L({ es: `Salvaciones de ${abilityShort(ab)}`, en: `${abilityShort(ab)} saves` }) : L({ es: `Pruebas de ${abilityShort(ab)}`, en: `${abilityShort(ab)} checks` });
};

export interface EffectPreset {
  id: string;
  name: Tr;
  kind: 'buff' | 'debuff';
  rounds: number | null;
  concentration: boolean;
  mods: EffectMods;
  notes: Tr;
  aliases: string[];
}

export const EFFECT_PRESETS: EffectPreset[] = [
  { id: 'bendicion', name: { es: 'Bendición', en: 'Bless' }, kind: 'buff', rounds: 10, concentration: true, mods: { bonus: { attack: '+1d4', save: '+1d4' } }, notes: { es: 'Suma 1d4 a tiradas de ataque y salvaciones. 1 minuto.', en: 'Add 1d4 to attack rolls and saving throws. 1 minute.' }, aliases: ['bendicion', 'bendición', 'bless', 'blessed'] },
  { id: 'perdicion', name: { es: 'Perdición', en: 'Bane' }, kind: 'debuff', rounds: 10, concentration: false, mods: { bonus: { attack: '-1d4', save: '-1d4' } }, notes: { es: 'Resta 1d4 a tiradas de ataque y salvaciones. 1 minuto.', en: 'Subtract 1d4 from attack rolls and saving throws. 1 minute.' }, aliases: ['perdicion', 'perdición', 'bane'] },
  { id: 'escudo_fe', name: { es: 'Escudo de la fe', en: 'Shield of Faith' }, kind: 'buff', rounds: 100, concentration: true, mods: { ac: 2 }, notes: { es: '+2 a la CA. 10 minutos.', en: '+2 AC. 10 minutes.' }, aliases: ['escudo de la fe', 'shield of faith'] },
  { id: 'escudo', name: { es: 'Escudo (conjuro)', en: 'Shield (spell)' }, kind: 'buff', rounds: 1, concentration: false, mods: { ac: 5 }, notes: { es: 'Reacción: +5 a la CA hasta el inicio de tu siguiente turno (también contra el ataque que lo provocó). Inmune a Proyectil mágico.', en: 'Reaction: +5 AC until the start of your next turn, including against the triggering attack. Immune to Magic Missile.' }, aliases: ['conjuro escudo', 'escudo', 'shield'] },
  { id: 'celeridad', name: { es: 'Celeridad', en: 'Haste' }, kind: 'buff', rounds: 10, concentration: true, mods: { ac: 2, speedMult: 2, advantage: ['save:dex'] }, notes: { es: '+2 CA, ventaja en salvaciones de DES, velocidad doble y una acción extra limitada. Al terminar, no puedes moverte ni actuar hasta después de tu siguiente turno.', en: '+2 AC, Advantage on DEX saves, doubled Speed and an extra limited action. When it ends, you can’t move or take actions until after your next turn.' }, aliases: ['celeridad', 'haste', 'hasted', 'acelerar'] },
  { id: 'lentitud', name: { es: 'Lentitud', en: 'Slow' }, kind: 'debuff', rounds: 10, concentration: false, mods: { ac: -2, speedMult: 0.5, bonus: { save: '-2' } }, notes: { es: '−2 a CA y salvaciones de DES, velocidad a la mitad, sin reacciones, solo acción o acción adicional.', en: '−2 AC and DEX saves, half Speed, no reactions, only an action or a Bonus Action.' }, aliases: ['lentitud', 'ralentizado', 'slowed', 'slow spell'] },
  { id: 'furia', name: { es: 'Furia', en: 'Rage' }, kind: 'buff', rounds: 100, concentration: false, mods: { resist: ['contundente', 'cortante', 'perforante'], bonus: { damage: '+2' }, advantage: ['check:str', 'save:str'] }, notes: { es: 'Resistencia a daño contundente, cortante y perforante. Bonificador al daño con FUE. No puedes lanzar conjuros ni concentrarte.', en: 'Resistance to Bludgeoning, Piercing and Slashing damage. Bonus to STR damage. You can’t cast spells or concentrate.' }, aliases: ['furia', 'entro en furia', 'me enfurezco', 'rage', 'raging'] },
  { id: 'esquivar', name: { es: 'Esquivando', en: 'Dodging' }, kind: 'buff', rounds: 1, concentration: false, mods: { advantage: ['save:dex'] }, notes: { es: 'Ataques contra ti con desventaja hasta el inicio de tu siguiente turno.', en: 'Attacks against you have Disadvantage until the start of your next turn.' }, aliases: ['esquivar', 'esquivo', 'dodge', 'dodging'] },
  { id: 'ayuda', name: { es: 'Ayuda (conjuro)', en: 'Aid' }, kind: 'buff', rounds: null, concentration: false, mods: { maxHp: 5 }, notes: { es: '+5 PG máximos y actuales durante 8 horas (+5 por nivel de espacio por encima de 2).', en: '+5 maximum and current HP for 8 hours (+5 per slot level above 2).' }, aliases: ['conjuro ayuda', 'aid'] },
  { id: 'armadura_mago', name: { es: 'Armadura de mago', en: 'Mage Armor' }, kind: 'buff', rounds: null, concentration: false, mods: { acBase: 13 }, notes: { es: 'CA base 13 + mod. DES si no llevas armadura. 8 horas.', en: 'Base AC 13 + DEX mod while unarmored. 8 hours.' }, aliases: ['armadura de mago', 'mage armor'] },
  { id: 'heroismo', name: { es: 'Heroísmo', en: 'Heroism' }, kind: 'buff', rounds: 10, concentration: true, mods: {}, notes: { es: 'Inmune a Asustado; al inicio de cada turno ganas PG temporales iguales al mod. de lanzamiento.', en: 'Immune to Frightened; at the start of each turn gain Temporary HP equal to the caster’s spellcasting modifier.' }, aliases: ['heroismo', 'heroísmo', 'heroism'] },
  { id: 'proteccion_mal', name: { es: 'Protección contra el bien y el mal', en: 'Protection from Evil and Good' }, kind: 'buff', rounds: 100, concentration: true, mods: {}, notes: { es: 'Aberraciones, celestiales, elementales, feéricos, infernales y no muertos tienen desventaja al atacarte; no pueden hechizarte, asustarte ni poseerte.', en: 'Aberrations, Celestials, Elementals, Fey, Fiends and Undead have Disadvantage on attacks against you and can’t charm, frighten or possess you.' }, aliases: ['proteccion contra el mal', 'protección contra el mal', 'proteccion contra el bien y el mal', 'protection from evil and good', 'protection from evil'] },
  { id: 'piel_roble', name: { es: 'Piel robliza', en: 'Barkskin' }, kind: 'buff', rounds: 600, concentration: true, mods: {}, notes: { es: 'Tu CA no puede ser inferior a 17.', en: 'Your AC can’t be less than 17.' }, aliases: ['piel robliza', 'piel de roble', 'barkskin'] },
  { id: 'agrandar', name: { es: 'Agrandar', en: 'Enlarge' }, kind: 'buff', rounds: 10, concentration: true, mods: { bonus: { damage: '+1d4' }, advantage: ['check:str', 'save:str'] }, notes: { es: 'Tamaño mayor, ventaja en FUE y +1d4 al daño con armas.', en: 'Larger size, Advantage on STR checks and saves, +1d4 weapon damage.' }, aliases: ['agrandar', 'enlarge', 'enlarged'] },
  { id: 'reducir', name: { es: 'Reducir', en: 'Reduce' }, kind: 'debuff', rounds: 10, concentration: false, mods: { bonus: { damage: '-1d4' }, disadvantage: ['check:str', 'save:str'] }, notes: { es: 'Tamaño menor, desventaja en FUE y −1d4 al daño con armas.', en: 'Smaller size, Disadvantage on STR checks and saves, −1d4 weapon damage.' }, aliases: ['reducir', 'encoger', 'reduce', 'reduced', 'shrunk'] },
  { id: 'marca_cazador', name: { es: 'Marca del cazador', en: 'Hunter’s Mark' }, kind: 'buff', rounds: 600, concentration: true, mods: {}, notes: { es: '+1d6 de daño de fuerza a tus impactos contra la criatura marcada; ventaja en Percepción/Supervivencia para encontrarla.', en: '+1d6 Force damage on your hits against the marked creature; Advantage on Perception/Survival to find it.' }, aliases: ['marca del cazador', 'marca de cazador', "hunter's mark", 'hunters mark'] },
  { id: 'maleficio', name: { es: 'Maleficio', en: 'Hex' }, kind: 'buff', rounds: 600, concentration: true, mods: {}, notes: { es: '+1d6 de daño necrótico a tus impactos contra el objetivo; desventaja para él en pruebas de la característica elegida.', en: '+1d6 Necrotic damage on your hits against the target; it has Disadvantage on checks with the chosen ability.' }, aliases: ['maleficio', 'hex'] },
  { id: 'inspiracion_bardica', name: { es: 'Inspiración bárdica (recibida)', en: 'Bardic Inspiration (received)' }, kind: 'buff', rounds: 100, concentration: false, mods: {}, notes: { es: 'Puedes sumar el dado de inspiración a una prueba d20 que falles.', en: 'You can add the Bardic Inspiration die to a D20 Test you fail.' }, aliases: ['inspiracion bardica', 'inspiración bárdica', 'bardic inspiration'] },
];

/** Nombre de un efecto activo en el idioma actual */
export const effectName = (e: { name: string; presetId?: string }) => {
  const p = e.presetId ? EFFECT_PRESETS.find((x) => x.id === e.presetId) : undefined;
  return p ? L(p.name) : e.name;
};
export const effectNotes = (e: { notes?: string; presetId?: string }) => {
  const p = e.presetId ? EFFECT_PRESETS.find((x) => x.id === e.presetId) : undefined;
  return p ? L(p.notes) : (e.notes ?? '');
};

/** Comprueba si un nombre (en cualquier idioma) se refiere a ese efecto */
export const effectMatches = (e: { name: string; presetId?: string }, name: string) => {
  const n = name.trim().toLowerCase();
  if (e.name.toLowerCase() === n) return true;
  const p = e.presetId ? EFFECT_PRESETS.find((x) => x.id === e.presetId) : undefined;
  return !!p && (p.name.es.toLowerCase() === n || p.name.en.toLowerCase() === n);
};

export const SIZES: Tr[] = [
  { es: 'Diminuto', en: 'Tiny' }, { es: 'Pequeño', en: 'Small' }, { es: 'Mediano', en: 'Medium' },
  { es: 'Grande', en: 'Large' }, { es: 'Enorme', en: 'Huge' }, { es: 'Gargantuesco', en: 'Gargantuan' },
];

export const DEFAULT_FOLDERS: { key: string; name: Tr; icon: string }[] = [
  { key: 'names', name: { es: 'Nombres', en: 'Names' }, icon: '👤' },
  { key: 'places', name: { es: 'Lugares', en: 'Places' }, icon: '🗺️' },
  { key: 'quests', name: { es: 'Misiones', en: 'Quests' }, icon: '📌' },
  { key: 'items', name: { es: 'Objetos', en: 'Items' }, icon: '💎' },
  { key: 'chronicles', name: { es: 'Crónicas', en: 'Chronicles' }, icon: '📖' },
];
