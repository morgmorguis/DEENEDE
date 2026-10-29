// Datos de reglas basados en el System Reference Document 5.2 (reglas de D&D 2024),
// publicado por Wizards of the Coast bajo licencia CC-BY-4.0. Textos resumidos y
// traducidos/parafraseados al español.
import type { Ability, ConditionId, DamageType, EffectMods } from '../types';

export const ABILITIES: { id: Ability; name: string; short: string }[] = [
  { id: 'str', name: 'Fuerza', short: 'FUE' },
  { id: 'dex', name: 'Destreza', short: 'DES' },
  { id: 'con', name: 'Constitución', short: 'CON' },
  { id: 'int', name: 'Inteligencia', short: 'INT' },
  { id: 'wis', name: 'Sabiduría', short: 'SAB' },
  { id: 'cha', name: 'Carisma', short: 'CAR' },
];

export const abilityName = (a: Ability) => ABILITIES.find((x) => x.id === a)!.name;
export const abilityShort = (a: Ability) => ABILITIES.find((x) => x.id === a)!.short;

export interface SkillInfo {
  id: string;
  name: string;
  ability: Ability;
  desc: string;
  examples: string;
  /** Sentidos de los que suele depender (para avisar de condiciones como Cegado) */
  senses?: ('sight' | 'hearing')[];
}

export const SKILLS: SkillInfo[] = [
  { id: 'acrobacias', name: 'Acrobacias', ability: 'dex', desc: 'Mantener el equilibrio, hacer piruetas y escapar de situaciones complicadas con agilidad.', examples: 'Cruzar una cornisa helada, rodar para salir de un agarre (si el DM lo permite), mantenerte de pie en un barco que se balancea.' },
  { id: 'trato_animales', name: 'Trato con animales', ability: 'wis', desc: 'Calmar, entrenar o intuir las intenciones de un animal.', examples: 'Tranquilizar a un caballo asustado, saber si un lobo va a atacar.' },
  { id: 'arcanos', name: 'Arcanos', ability: 'int', desc: 'Recordar saber sobre conjuros, objetos mágicos, símbolos arcanos, planos de existencia y criaturas mágicas.', examples: 'Identificar un conjuro que ves lanzar, reconocer un círculo de invocación.' },
  { id: 'atletismo', name: 'Atletismo', ability: 'str', desc: 'Escalar, saltar, nadar y proezas de fuerza física.', examples: 'Trepar un muro, nadar contra corriente, saltar un foso largo.' },
  { id: 'engano', name: 'Engaño', ability: 'cha', desc: 'Ocultar la verdad de forma convincente, con palabras o actos.', examples: 'Mentir a un guardia, disfrazarte, hacer trampas en un juego.', senses: [] },
  { id: 'historia', name: 'Historia', ability: 'int', desc: 'Recordar hechos históricos, reinos, guerras, leyendas y personajes del pasado.', examples: 'Saber quién construyó unas ruinas o qué pasó en una batalla antigua.' },
  { id: 'perspicacia', name: 'Perspicacia', ability: 'wis', desc: 'Discernir las verdaderas intenciones o el estado de ánimo de una criatura.', examples: 'Detectar una mentira, anticipar el siguiente movimiento de alguien.', senses: ['sight', 'hearing'] },
  { id: 'intimidacion', name: 'Intimidación', ability: 'cha', desc: 'Influir en otros mediante amenazas, hostilidad o violencia implícita.', examples: 'Sacar información a un prisionero, disuadir a unos matones.' },
  { id: 'investigacion', name: 'Investigación', ability: 'int', desc: 'Buscar pistas y deducir a partir de ellas.', examples: 'Encontrar un compartimento secreto, deducir el arma de un asesinato, hallar el punto débil de una estructura.', senses: ['sight'] },
  { id: 'medicina', name: 'Medicina', ability: 'wis', desc: 'Diagnosticar dolencias, estabilizar a moribundos y determinar causas de muerte.', examples: 'Estabilizar a un aliado a 0 PG (acción Utilizar con kit de sanador o prueba CD 10).' },
  { id: 'naturaleza', name: 'Naturaleza', ability: 'int', desc: 'Recordar saber sobre terreno, plantas, animales, clima y ciclos naturales.', examples: 'Identificar una planta venenosa, prever una tormenta.' },
  { id: 'percepcion', name: 'Percepción', ability: 'wis', desc: 'Darte cuenta de lo que te rodea usando tus sentidos.', examples: 'Oír una conversación tras una puerta, ver una emboscada, detectar a una criatura escondida.', senses: ['sight', 'hearing'] },
  { id: 'interpretacion', name: 'Interpretación', ability: 'cha', desc: 'Entretener a un público con música, danza, actuación o narración.', examples: 'Tocar en una taberna, distraer a los guardias con un número.' },
  { id: 'persuasion', name: 'Persuasión', ability: 'cha', desc: 'Influir en otros con tacto, buenos modales o buena fe.', examples: 'Negociar un precio, convencer al rey de que te escuche.' },
  { id: 'religion', name: 'Religión', ability: 'int', desc: 'Recordar saber sobre dioses, ritos, oraciones, jerarquías religiosas y no muertos.', examples: 'Reconocer el símbolo de un culto, saber cómo destruir a un no muerto.' },
  { id: 'juego_manos', name: 'Juego de manos', ability: 'dex', desc: 'Prestidigitación, robar carteras y manipulaciones manuales discretas.', examples: 'Plantar algo en el bolsillo de otro, esconder un objeto en la manga.', senses: ['sight'] },
  { id: 'sigilo', name: 'Sigilo', ability: 'dex', desc: 'Ocultarte y moverte sin ser detectado. La acción Esconderse usa Sigilo (CD 15).', examples: 'Pasar junto a unos guardias, esconderte tras una columna.' },
  { id: 'supervivencia', name: 'Supervivencia', ability: 'wis', desc: 'Rastrear, cazar, orientarte y evitar peligros naturales.', examples: 'Seguir huellas, encontrar refugio, no perderte en un bosque.', senses: ['sight'] },
];

export interface ConditionInfo {
  id: ConditionId;
  name: string;
  effects: string[];
  /** Resumen mecánico para recordatorios rápidos en combate */
  short: string;
}

export const CONDITIONS: ConditionInfo[] = [
  { id: 'agarrado', name: 'Agarrado', short: 'Velocidad 0; desventaja al atacar a otros que no sean quien te agarra.', effects: [
    'Tu Velocidad es 0 y no puede aumentar.',
    'Tienes desventaja en tiradas de ataque contra cualquier objetivo que no sea quien te agarra.',
    'Quien te agarra puede arrastrarte (le cuesta 1 pie extra por pie movido, salvo que seas Diminuto o dos tamaños menor).',
    'Para escapar: acción, prueba de FUE (Atletismo) o DES (Acrobacias) contra la CD de salvación del agarre.',
  ] },
  { id: 'apresado', name: 'Apresado', short: 'Velocidad 0; ataques contra ti con ventaja; tus ataques con desventaja; desventaja en salvaciones de DES.', effects: [
    'Tu Velocidad es 0 y no puede aumentar.',
    'Las tiradas de ataque contra ti tienen ventaja y las tuyas tienen desventaja.',
    'Tienes desventaja en las tiradas de salvación de Destreza.',
  ] },
  { id: 'asustado', name: 'Asustado', short: 'Desventaja en pruebas y ataques mientras veas la fuente; no puedes acercarte a ella.', effects: [
    'Desventaja en pruebas de característica y tiradas de ataque mientras la fuente del miedo esté a la vista.',
    'No puedes acercarte voluntariamente a la fuente del miedo.',
  ] },
  { id: 'aturdido', name: 'Aturdido', short: 'Incapacitado; fallas salvaciones de FUE y DES; ataques contra ti con ventaja.', effects: [
    'Tienes la condición Incapacitado.',
    'Fallas automáticamente las salvaciones de Fuerza y Destreza.',
    'Las tiradas de ataque contra ti tienen ventaja.',
  ] },
  { id: 'cegado', name: 'Cegado', short: 'No ves; fallas pruebas que requieran vista; ataques contra ti con ventaja y los tuyos con desventaja.', effects: [
    'No puedes ver y fallas automáticamente cualquier prueba que requiera la vista.',
    'Las tiradas de ataque contra ti tienen ventaja y las tuyas tienen desventaja.',
  ] },
  { id: 'derribado', name: 'Derribado', short: 'Solo puedes arrastrarte o gastar la mitad de tu velocidad en levantarte; desventaja al atacar; ataques a 5 pies con ventaja, a distancia con desventaja.', effects: [
    'Solo puedes moverte arrastrándote, o gastar una cantidad de movimiento igual a la mitad de tu Velocidad para levantarte (y terminar la condición).',
    'Tus tiradas de ataque tienen desventaja.',
    'Los ataques contra ti tienen ventaja si el atacante está a 5 pies o menos; si no, desventaja.',
  ] },
  { id: 'ensordecido', name: 'Ensordecido', short: 'No oyes; fallas pruebas que requieran oído.', effects: [
    'No puedes oír y fallas automáticamente cualquier prueba que requiera el oído.',
  ] },
  { id: 'envenenado', name: 'Envenenado', short: 'Desventaja en tiradas de ataque y pruebas de característica.', effects: [
    'Tienes desventaja en tiradas de ataque y pruebas de característica.',
  ] },
  { id: 'hechizado', name: 'Hechizado', short: 'No puedes atacar a quien te hechizó; tiene ventaja en pruebas sociales contigo.', effects: [
    'No puedes atacar a quien te hechizó ni elegirlo como objetivo de capacidades o efectos mágicos dañinos.',
    'Quien te hechizó tiene ventaja en las pruebas de característica para interactuar socialmente contigo.',
  ] },
  { id: 'incapacitado', name: 'Incapacitado', short: 'Sin acciones, acciones adicionales ni reacciones; pierdes la concentración; no puedes hablar.', effects: [
    'No puedes realizar ninguna acción, acción adicional ni reacción.',
    'Tu Concentración se rompe.',
    'No puedes hablar.',
    'Si estás Incapacitado al tirar iniciativa, tienes desventaja.',
  ] },
  { id: 'inconsciente', name: 'Inconsciente', short: 'Incapacitado y Derribado; sueltas lo que llevas; fallas salvaciones de FUE/DES; ataques contra ti con ventaja y críticos a 5 pies.', effects: [
    'Tienes las condiciones Incapacitado y Derribado, y sueltas lo que lleves en las manos. Al terminar esta condición, sigues Derribado.',
    'Tu Velocidad es 0 y no puede aumentar.',
    'Las tiradas de ataque contra ti tienen ventaja.',
    'Fallas automáticamente las salvaciones de Fuerza y Destreza.',
    'Cualquier impacto contra ti es crítico si el atacante está a 5 pies o menos.',
    'No eres consciente de lo que te rodea.',
  ] },
  { id: 'invisible', name: 'Invisible', short: 'Ventaja en iniciativa; ataques contra ti con desventaja y los tuyos con ventaja (si no te ven).', effects: [
    'Sorpresa: si eres invisible al tirar iniciativa, tienes ventaja.',
    'Oculto: no te afectan efectos que requieran que su origen te vea, salvo que pueda verte. Lo que lleves puesto también está oculto.',
    'Las tiradas de ataque contra ti tienen desventaja y las tuyas tienen ventaja (salvo que la otra criatura pueda verte).',
  ] },
  { id: 'paralizado', name: 'Paralizado', short: 'Incapacitado; Velocidad 0; fallas salvaciones de FUE/DES; ataques contra ti con ventaja y críticos a 5 pies.', effects: [
    'Tienes la condición Incapacitado.',
    'Tu Velocidad es 0 y no puede aumentar.',
    'Fallas automáticamente las salvaciones de Fuerza y Destreza.',
    'Las tiradas de ataque contra ti tienen ventaja.',
    'Cualquier impacto contra ti es crítico si el atacante está a 5 pies o menos.',
  ] },
  { id: 'petrificado', name: 'Petrificado', short: 'Convertido en piedra: incapacitado, velocidad 0, resistencia a todo el daño, inmune a veneno.', effects: [
    'Te transformas, junto con lo que llevas, en una sustancia sólida e inanimada. Tu peso se multiplica por diez y dejas de envejecer.',
    'Tienes la condición Incapacitado y tu Velocidad es 0.',
    'Las tiradas de ataque contra ti tienen ventaja.',
    'Fallas automáticamente las salvaciones de Fuerza y Destreza.',
    'Tienes resistencia a todo el daño.',
    'Eres inmune a la condición Envenenado.',
  ] },
];

export const EXHAUSTION_INFO = [
  'Cada nivel de agotamiento resta 2 × nivel a todas tus pruebas d20 (ataques, pruebas de característica y salvaciones).',
  'Tu Velocidad se reduce en 5 pies × nivel.',
  'Con 6 niveles, mueres.',
  'Un descanso largo elimina 1 nivel de agotamiento.',
];

export const DAMAGE_TYPES: { id: DamageType; name: string; words: string[] }[] = [
  { id: 'acido', name: 'Ácido', words: ['acido', 'ácido'] },
  { id: 'contundente', name: 'Contundente', words: ['contundente', 'maza', 'martillo', 'garrote', 'puñetazo', 'puño', 'caida', 'caída', 'roca', 'piedra'] },
  { id: 'frio', name: 'Frío', words: ['frio', 'frío', 'hielo', 'escarcha'] },
  { id: 'fuego', name: 'Fuego', words: ['fuego', 'llamas', 'quemadura', 'ígneo', 'igneo', 'bola de fuego', 'fuego'] },
  { id: 'fuerza', name: 'Fuerza', words: ['fuerza', 'proyectil mágico', 'proyectil magico'] },
  { id: 'relampago', name: 'Relámpago', words: ['relampago', 'relámpago', 'rayo', 'eléctrico', 'electrico', 'electricidad'] },
  { id: 'necrotico', name: 'Necrótico', words: ['necrotico', 'necrótico'] },
  { id: 'perforante', name: 'Perforante', words: ['perforante', 'flecha', 'virote', 'lanza', 'daga', 'mordisco', 'mordedura', 'estoque', 'jabalina'] },
  { id: 'veneno', name: 'Veneno', words: ['veneno', 'venenoso'] },
  { id: 'psiquico', name: 'Psíquico', words: ['psiquico', 'psíquico'] },
  { id: 'radiante', name: 'Radiante', words: ['radiante'] },
  { id: 'cortante', name: 'Cortante', words: ['cortante', 'espada', 'hacha', 'garra', 'garras', 'cimitarra', 'tajo', 'cuchillada'] },
  { id: 'trueno', name: 'Trueno', words: ['trueno', 'sónico', 'sonico'] },
];

export const damageTypeName = (d: DamageType) => DAMAGE_TYPES.find((x) => x.id === d)!.name;

export interface ActionInfo {
  id: string;
  name: string;
  cost: 'acción' | 'acción adicional' | 'reacción' | 'movimiento' | 'gratis';
  text: string;
}

export const ACTIONS: ActionInfo[] = [
  { id: 'atacar', name: 'Atacar', cost: 'acción', text: 'Realiza un ataque con un arma o un ataque sin armas. Con el rasgo Ataque extra haces más ataques con la misma acción. Puedes equipar o desequipar un arma como parte de cada ataque.' },
  { id: 'correr', name: 'Correr (Dash)', cost: 'acción', text: 'Ganas movimiento adicional igual a tu Velocidad (tras aplicar modificadores) durante este turno.' },
  { id: 'destrabarse', name: 'Destrabarse (Disengage)', cost: 'acción', text: 'Tu movimiento no provoca ataques de oportunidad durante el resto del turno.' },
  { id: 'esquivar', name: 'Esquivar (Dodge)', cost: 'acción', text: 'Hasta el inicio de tu siguiente turno, los ataques contra ti tienen desventaja (si ves al atacante) y tienes ventaja en salvaciones de DES. Lo pierdes si quedas Incapacitado o tu Velocidad es 0.' },
  { id: 'ayudar', name: 'Ayudar', cost: 'acción', text: 'Ayudas a un aliado en una prueba (tiene ventaja en la siguiente prueba con esa habilidad/herramienta) o distraes a un enemigo a 5 pies (el siguiente ataque de un aliado contra él tiene ventaja).' },
  { id: 'esconderse', name: 'Esconderse', cost: 'acción', text: 'Prueba de DES (Sigilo) CD 15 estando fuera de la vista (con cobertura total o tras algo que te oculte). Si tienes éxito ganas la condición Invisible; la anota tu total como la CD para encontrarte. Termina si haces ruido, atacas, lanzas un conjuro con componente verbal o te encuentran.' },
  { id: 'influir', name: 'Influir', cost: 'acción', text: 'Intentas convencer a un monstruo de algo con Engaño, Intimidación, Interpretación, Persuasión o Trato con animales. El DM decide la actitud y la CD (normalmente 15 o la INT del monstruo).' },
  { id: 'magia', name: 'Magia', cost: 'acción', text: 'Lanzas un conjuro con tiempo de lanzamiento de una acción, usas un objeto mágico o un rasgo mágico.' },
  { id: 'preparar', name: 'Preparar', cost: 'acción', text: 'Eliges un desencadenante y una acción (o moverte). Cuando ocurre, puedes usar tu reacción para realizarla. Preparar un conjuro requiere Concentración hasta que se usa.' },
  { id: 'buscar', name: 'Buscar', cost: 'acción', text: 'Prueba de Sabiduría (Perspicacia, Medicina, Percepción o Supervivencia) para notar algo que no es obvio.' },
  { id: 'estudiar', name: 'Estudiar', cost: 'acción', text: 'Prueba de Inteligencia (Arcanos, Historia, Investigación, Naturaleza o Religión) para recordar o deducir algo.' },
  { id: 'utilizar', name: 'Utilizar', cost: 'acción', text: 'Usas un objeto no mágico (beber una poción de curación también puede hacerse así; consulta a tu DM: en 2024 beber una poción es acción adicional).' },
  { id: 'ataque_oportunidad', name: 'Ataque de oportunidad', cost: 'reacción', text: 'Cuando una criatura que puedes ver sale de tu alcance usando su acción, acción adicional, reacción o movimiento, puedes hacerle un ataque cuerpo a cuerpo.' },
  { id: 'interactuar', name: 'Interacción con objeto', cost: 'gratis', text: 'Una vez por turno puedes interactuar gratis con un objeto (abrir una puerta, sacar algo de la mochila) durante tu movimiento o acción.' },
  { id: 'pocion', name: 'Beber/dar poción', cost: 'acción adicional', text: 'En las reglas 2024, beber una poción o administrarla a otra criatura es una acción adicional.' },
  { id: 'levantarse', name: 'Levantarse', cost: 'movimiento', text: 'Si estás Derribado, gastas la mitad de tu Velocidad para levantarte.' },
];

export interface RuleTopic {
  id: string;
  name: string;
  text: string[];
}

export const RULES: RuleTopic[] = [
  { id: 'ventaja', name: 'Ventaja y desventaja', text: [
    'Ventaja: tiras dos d20 y usas el mayor. Desventaja: tiras dos y usas el menor.',
    'Si tienes ventaja y desventaja a la vez, se anulan y tiras un solo d20, sin importar cuántas fuentes haya de cada una.',
  ] },
  { id: 'critico', name: 'Golpe crítico', text: [
    'Un 20 natural en una tirada de ataque siempre impacta y es crítico: tiras los dados de daño del ataque dos veces y sumas los modificadores una vez.',
    'Un 1 natural en una tirada de ataque siempre falla.',
  ] },
  { id: 'dano', name: 'Orden para aplicar daño', text: [
    '1) Se aplican primero los bonificadores/penalizadores planos al daño.',
    '2) Resistencia: el daño se reduce a la mitad (redondeando hacia abajo). Varias resistencias al mismo tipo cuentan como una.',
    '3) Vulnerabilidad: el daño se duplica.',
    'Inmunidad: no recibes daño de ese tipo.',
    'Los PG temporales absorben el daño primero; el resto se resta de tus PG.',
  ] },
  { id: 'pg_temporales', name: 'Puntos de golpe temporales', text: [
    'Son un colchón que absorbe daño antes que tus PG reales. No se suman entre sí: si recibes nuevos, eliges quedarte con los que tienes o con los nuevos.',
    'La curación no los restaura. Desaparecen tras un descanso largo salvo que el efecto indique otra duración.',
  ] },
  { id: 'cero_pg', name: 'Caer a 0 PG y muerte instantánea', text: [
    'Si el daño te deja a 0 PG y el daño sobrante es igual o mayor que tus PG máximos, mueres instantáneamente.',
    'Si no, quedas Inconsciente y empiezas a hacer salvaciones contra la muerte.',
    'Si recibes daño estando a 0 PG sufres un fallo de salvación contra la muerte (dos si el golpe es crítico). Si ese daño es igual o mayor que tus PG máximos, mueres.',
    'Cualquier curación te devuelve la consciencia y reinicia las salvaciones contra la muerte.',
  ] },
  { id: 'salvaciones_muerte', name: 'Salvaciones contra la muerte', text: [
    'Al inicio de cada uno de tus turnos a 0 PG, tira un d20 sin modificadores: 10 o más es un éxito; 9 o menos, un fallo.',
    'Tres éxitos: quedas Estable (inconsciente pero sin tirar más). Tres fallos: mueres.',
    'Un 1 natural cuenta como dos fallos. Un 20 natural te devuelve 1 PG.',
    'Estabilizar a alguien: acción Utilizar con un kit de sanador, o prueba de Sabiduría (Medicina) CD 10.',
  ] },
  { id: 'concentracion', name: 'Concentración', text: [
    'Solo puedes concentrarte en un conjuro a la vez. Lanzar otro con concentración termina el anterior.',
    'Si recibes daño, haz una salvación de Constitución con CD igual a 10 o la mitad del daño (lo que sea mayor), con un máximo de CD 30. Si fallas, pierdes la concentración.',
    'La pierdes también si quedas Incapacitado o mueres.',
  ] },
  { id: 'descansos', name: 'Descansos', text: [
    'Descanso corto (1 hora): puedes gastar Dados de Golpe; por cada uno tiras el dado y sumas tu mod. de CON para recuperar PG. Algunas capacidades se recuperan.',
    'Descanso largo (8 horas): recuperas todos los PG y todos los Dados de Golpe gastados, recuperas espacios de conjuro y reduces tu Agotamiento en 1. Solo uno cada 24 horas.',
  ] },
  { id: 'cobertura', name: 'Cobertura', text: [
    'Media cobertura: +2 a CA y salvaciones de DES.',
    'Tres cuartos de cobertura: +5 a CA y salvaciones de DES.',
    'Cobertura total: no puedes ser objetivo directo de ataques ni conjuros.',
  ] },
  { id: 'agarre', name: 'Agarrar y empujar (ataque sin armas)', text: [
    'Un ataque sin armas puede infligir daño (1 + mod. FUE contundente), agarrar o empujar.',
    'Agarrar o empujar: el objetivo (máximo un tamaño mayor que tú, a tu alcance) hace una salvación de FUE o DES (a su elección) contra CD 8 + mod. FUE + bonificador de competencia.',
    'Empujar: lo alejas 5 pies o lo derribas.',
  ] },
  { id: 'iniciativa', name: 'Iniciativa', text: [
    'Prueba de Destreza al inicio del combate. Es una prueba d20, así que el agotamiento la penaliza.',
    'Invisible: ventaja. Incapacitado: desventaja.',
  ] },
  { id: 'sorpresa', name: 'Sorpresa', text: [
    'En 2024, si te sorprenden tienes desventaja en tu tirada de iniciativa (ya no pierdes el primer turno).',
  ] },
  { id: 'arma_ligera', name: 'Armas ligeras (dos armas)', text: [
    'Si atacas con un arma Ligera como parte de la acción Atacar, puedes hacer un ataque extra como acción adicional con otra arma Ligera distinta. No sumas tu modificador al daño de ese ataque extra salvo que sea negativo.',
  ] },
  { id: 'inspiracion', name: 'Inspiración heroica', text: [
    'Si la tienes, puedes gastarla para volver a tirar cualquier dado inmediatamente después de tirarlo, y debes usar el nuevo resultado.',
    'Los humanos la obtienen al terminar un descanso largo. El DM también puede concederla.',
  ] },
  { id: 'caida', name: 'Caída', text: [
    'Recibes 1d6 de daño contundente por cada 10 pies de caída (máximo 20d6) y quedas Derribado salvo que evites todo el daño.',
  ] },
  { id: 'asfixia', name: 'Contener la respiración', text: [
    'Puedes contener la respiración un número de minutos igual a 1 + mod. CON (mínimo 30 s). Después, al final de tu turno ganas 1 nivel de Agotamiento por turno sin respirar.',
  ] },
];

export const MASTERIES: { id: string; name: string; text: string }[] = [
  { id: 'cleave', name: 'Hender (Cleave)', text: 'Si impactas a una criatura, puedes hacer otro ataque con la misma arma contra otra criatura a 5 pies de la primera y a tu alcance. Si impacta, no sumas tu modificador al daño (salvo que sea negativo). Una vez por turno.' },
  { id: 'graze', name: 'Rozar (Graze)', text: 'Si fallas el ataque, la criatura recibe daño igual al modificador de característica que usaste para el ataque (del mismo tipo que el arma).' },
  { id: 'nick', name: 'Mellar (Nick)', text: 'El ataque extra de la propiedad Ligera lo haces como parte de la acción Atacar en lugar de como acción adicional. Una vez por turno.' },
  { id: 'push', name: 'Empujar (Push)', text: 'Si impactas, puedes empujar a la criatura hasta 10 pies en línea recta alejándola de ti, si es Grande o menor.' },
  { id: 'sap', name: 'Debilitar (Sap)', text: 'Si impactas, la criatura tiene desventaja en su siguiente tirada de ataque antes del inicio de tu siguiente turno.' },
  { id: 'slow', name: 'Ralentizar (Slow)', text: 'Si impactas e infliges daño, su Velocidad se reduce 10 pies hasta el inicio de tu siguiente turno (no se acumula).' },
  { id: 'topple', name: 'Derribar (Topple)', text: 'Si impactas, la criatura hace una salvación de CON (CD 8 + mod. de ataque + competencia) o queda Derribada.' },
  { id: 'vex', name: 'Incordiar (Vex)', text: 'Si impactas e infliges daño, tienes ventaja en tu siguiente tirada de ataque contra esa criatura antes del final de tu siguiente turno.' },
];

// ---------- Clases ----------

export type CasterType = 'full' | 'half' | 'pact' | 'none';

export interface ClassInfo {
  id: string;
  name: string;
  hitDie: number;
  saves: Ability[];
  caster: CasterType;
  spellAbility: Ability | null;
  resources: (level: number, mods: Record<Ability, number>) => { name: string; max: number; recovers: 'short' | 'long' }[];
  features: (level: number) => { name: string; text: string }[];
}

const byLevel = (level: number, table: [number, number][]) => {
  let v = 0;
  for (const [l, n] of table) if (level >= l) v = n;
  return v;
};

export const CLASSES: ClassInfo[] = [
  { id: 'barbaro', name: 'Bárbaro', hitDie: 12, saves: ['str', 'con'], caster: 'none', spellAbility: null,
    resources: (l) => [{ name: 'Furia', max: byLevel(l, [[1, 2], [3, 3], [6, 4], [12, 5], [17, 6]]), recovers: 'long' }],
    features: (l) => [
      { name: 'Furia', text: `Acción adicional. Resistencia a daño contundente, cortante y perforante; +${l >= 16 ? 4 : l >= 9 ? 3 : 2} al daño con ataques de FUE; ventaja en pruebas y salvaciones de FUE; no puedes lanzar conjuros ni concentrarte. Dura hasta el final de tu siguiente turno y se prolonga si atacas, fuerzas una salvación o usas una acción adicional para mantenerla (máx. 10 min). Recuperas 1 uso en descanso corto.` },
      { name: 'Defensa sin armadura', text: 'Sin armadura: CA = 10 + mod. DES + mod. CON (puedes usar escudo).' },
      { name: 'Maestría con armas', text: 'Puedes usar las propiedades de maestría de algunas armas.' },
      ...(l >= 2 ? [{ name: 'Ataque temerario', text: 'Al hacer tu primer ataque del turno puedes darte ventaja en ataques de FUE hasta tu siguiente turno, pero los ataques contra ti tienen ventaja.' }, { name: 'Sentido del peligro', text: 'Ventaja en salvaciones de DES salvo que estés Incapacitado.' }] : []),
      ...(l >= 5 ? [{ name: 'Ataque extra', text: 'Atacas dos veces con la acción Atacar.' }, { name: 'Movimiento rápido', text: '+10 pies de Velocidad sin armadura pesada.' }] : []),
    ] },
  { id: 'bardo', name: 'Bardo', hitDie: 8, saves: ['dex', 'cha'], caster: 'full', spellAbility: 'cha',
    resources: (l, m) => [{ name: 'Inspiración bárdica', max: Math.max(1, m.cha), recovers: l >= 5 ? 'short' : 'long' }],
    features: (l) => [
      { name: 'Inspiración bárdica', text: `Acción adicional: una criatura a 60 pies gana un dado d${l >= 15 ? 12 : l >= 10 ? 10 : l >= 5 ? 8 : 6} que puede sumar a una prueba d20 que falle en la siguiente hora.` },
      ...(l >= 2 ? [{ name: 'Experto', text: 'Pericia en dos habilidades.' }, { name: 'Aprendiz de todo', text: 'Sumas la mitad de tu bonificador de competencia a pruebas sin competencia.' }] : []),
    ] },
  { id: 'clerigo', name: 'Clérigo', hitDie: 8, saves: ['wis', 'cha'], caster: 'full', spellAbility: 'wis',
    resources: (l) => (l >= 2 ? [{ name: 'Canalizar divinidad', max: byLevel(l, [[2, 2], [6, 3], [18, 4]]), recovers: 'long' as const }] : []),
    features: (l) => [
      { name: 'Orden divina', text: 'Protector (armadura pesada y armas marciales) o Taumaturgo (truco extra y bonus a Arcanos/Religión).' },
      ...(l >= 2 ? [{ name: 'Canalizar divinidad', text: 'Chispa divina (curar o dañar 1d8 + mod. SAB) o Expulsar no muertos. Recuperas 1 uso en descanso corto.' }] : []),
    ] },
  { id: 'druida', name: 'Druida', hitDie: 8, saves: ['int', 'wis'], caster: 'full', spellAbility: 'wis',
    resources: (l) => (l >= 2 ? [{ name: 'Forma salvaje', max: byLevel(l, [[2, 2], [6, 3], [17, 4]]), recovers: 'long' as const }] : []),
    features: (l) => [
      { name: 'Druídico', text: 'Conoces el idioma secreto de los druidas. Siempre tienes preparado Hablar con los animales.' },
      ...(l >= 2 ? [{ name: 'Forma salvaje', text: 'Acción adicional: te transformas en una bestia conocida. Ganas PG temporales iguales a tu nivel de druida. Recuperas 1 uso en descanso corto.' }] : []),
    ] },
  { id: 'guerrero', name: 'Guerrero', hitDie: 10, saves: ['str', 'con'], caster: 'none', spellAbility: null,
    resources: (l) => [
      { name: 'Tomar aliento', max: byLevel(l, [[1, 2], [4, 3], [10, 4]]), recovers: 'long' },
      ...(l >= 2 ? [{ name: 'Oleada de acción', max: l >= 17 ? 2 : 1, recovers: 'short' as const }] : []),
      ...(l >= 9 ? [{ name: 'Indomable', max: byLevel(l, [[9, 1], [13, 2], [17, 3]]), recovers: 'long' as const }] : []),
    ],
    features: (l) => [
      { name: 'Tomar aliento (Second Wind)', text: `Acción adicional: recuperas 1d10 + ${l} PG. Recuperas un uso en descanso corto.` },
      { name: 'Estilo de combate', text: 'Ganas una dote de Estilo de combate (p. ej. Defensa: +1 CA con armadura).' },
      { name: 'Maestría con armas', text: 'Puedes usar las propiedades de maestría de varias armas.' },
      ...(l >= 2 ? [{ name: 'Oleada de acción', text: 'En tu turno ganas una acción adicional (no la acción Magia).' }, { name: 'Mente táctica', text: 'Si fallas una prueba de característica, puedes gastar un uso de Tomar aliento para sumar 1d10.' }] : []),
      ...(l >= 5 ? [{ name: 'Ataque extra', text: 'Atacas dos veces con la acción Atacar.' }, { name: 'Cambio táctico', text: 'Al usar Tomar aliento puedes moverte la mitad de tu velocidad sin provocar ataques de oportunidad.' }] : []),
    ] },
  { id: 'monje', name: 'Monje', hitDie: 8, saves: ['str', 'dex'], caster: 'none', spellAbility: null,
    resources: (l) => (l >= 2 ? [{ name: 'Puntos de concentración', max: l, recovers: 'short' as const }] : []),
    features: (l) => [
      { name: 'Artes marciales', text: `Dado de artes marciales d${l >= 17 ? 12 : l >= 11 ? 10 : l >= 5 ? 8 : 6}. Ataque sin armas como acción adicional; puedes usar DES.` },
      { name: 'Defensa sin armadura', text: 'Sin armadura ni escudo: CA = 10 + mod. DES + mod. SAB.' },
      ...(l >= 2 ? [{ name: 'Ráfaga de golpes / Defensa paciente / Paso del viento', text: 'Gasta 1 punto de concentración para dos ataques sin armas, Destrabarse+Esquivar o Destrabarse+Correr como acción adicional.' }] : []),
    ] },
  { id: 'paladin', name: 'Paladín', hitDie: 10, saves: ['wis', 'cha'], caster: 'half', spellAbility: 'cha',
    resources: (l) => [
      { name: 'Imposición de manos (PG)', max: 5 * l, recovers: 'long' },
      ...(l >= 3 ? [{ name: 'Canalizar divinidad', max: byLevel(l, [[3, 2], [11, 3]]), recovers: 'long' as const }] : []),
    ],
    features: (l) => [
      { name: 'Imposición de manos', text: 'Acción adicional: tocas a una criatura y le restauras PG de tu reserva, o gastas 5 para quitarle Envenenado.' },
      ...(l >= 2 ? [{ name: 'Golpe divino', text: 'Siempre preparado: al impactar con un ataque cuerpo a cuerpo gastas un espacio de conjuro para infligir 2d8 radiante extra (+1d8 por nivel por encima de 1; +1d8 contra infernales y no muertos).' }] : []),
      ...(l >= 5 ? [{ name: 'Ataque extra', text: 'Atacas dos veces con la acción Atacar.' }] : []),
      ...(l >= 6 ? [{ name: 'Aura de protección', text: 'Tú y aliados a 10 pies sumáis tu mod. CAR (mín. +1) a las salvaciones.' }] : []),
    ] },
  { id: 'explorador', name: 'Explorador', hitDie: 10, saves: ['str', 'dex'], caster: 'half', spellAbility: 'wis',
    resources: (l) => [{ name: 'Marca del cazador gratis', max: byLevel(l, [[1, 2], [5, 3], [9, 4], [13, 5], [17, 6]]), recovers: 'long' }],
    features: (l) => [
      { name: 'Enemigo predilecto', text: 'Siempre tienes preparado Marca del cazador y puedes lanzarlo sin gastar espacio varias veces por descanso largo.' },
      ...(l >= 5 ? [{ name: 'Ataque extra', text: 'Atacas dos veces con la acción Atacar.' }] : []),
    ] },
  { id: 'picaro', name: 'Pícaro', hitDie: 8, saves: ['dex', 'int'], caster: 'none', spellAbility: null,
    resources: () => [],
    features: (l) => [
      { name: 'Ataque furtivo', text: `Una vez por turno, +${Math.ceil(l / 2)}d6 de daño a un ataque con arma sutil o a distancia si tienes ventaja, o si un aliado está a 5 pies del objetivo y no tienes desventaja.` },
      { name: 'Pericia', text: 'Pericia en dos habilidades.' },
      ...(l >= 2 ? [{ name: 'Acción astuta', text: 'Acción adicional: Correr, Destrabarse o Esconderse.' }] : []),
      ...(l >= 5 ? [{ name: 'Esquiva asombrosa', text: 'Reacción: cuando un atacante que ves te impacta, reduces el daño a la mitad.' }] : []),
      ...(l >= 7 ? [{ name: 'Evasión', text: 'En salvaciones de DES para mitad de daño: éxito = 0, fallo = mitad.' }] : []),
    ] },
  { id: 'hechicero', name: 'Hechicero', hitDie: 6, saves: ['con', 'cha'], caster: 'full', spellAbility: 'cha',
    resources: (l) => [
      { name: 'Hechicería innata', max: 2, recovers: 'long' },
      ...(l >= 2 ? [{ name: 'Puntos de hechicería', max: l, recovers: 'long' as const }] : []),
    ],
    features: (l) => [
      { name: 'Hechicería innata', text: 'Acción adicional, 1 min: CD de conjuros +1 y ventaja en ataques de conjuro de hechicero.' },
      ...(l >= 2 ? [{ name: 'Metamagia', text: 'Gasta puntos de hechicería para modificar conjuros.' }] : []),
    ] },
  { id: 'brujo', name: 'Brujo', hitDie: 8, saves: ['wis', 'cha'], caster: 'pact', spellAbility: 'cha',
    resources: () => [],
    features: () => [
      { name: 'Magia del pacto', text: 'Tus espacios de conjuro son siempre del nivel máximo que puedes lanzar y se recuperan en descanso corto o largo.' },
      { name: 'Invocaciones sobrenaturales', text: 'Elige invocaciones (p. ej. Explosión agonizante: + mod. CAR al daño de un truco).' },
    ] },
  { id: 'mago', name: 'Mago', hitDie: 6, saves: ['int', 'wis'], caster: 'full', spellAbility: 'int',
    resources: () => [{ name: 'Recuperación arcana', max: 1, recovers: 'long' }],
    features: (l) => [
      { name: 'Libro de conjuros', text: 'Preparas conjuros de tu libro tras un descanso largo.' },
      { name: 'Recuperación arcana', text: `Tras un descanso corto recuperas espacios gastados de nivel combinado hasta ${Math.ceil(l / 2)} (ninguno de nivel 6+).` },
      ...(l >= 2 ? [{ name: 'Erudito', text: 'Pericia en una habilidad de INT con la que tengas competencia.' }] : []),
    ] },
];

export const classById = (id: string) => CLASSES.find((c) => c.id === id || c.name.toLowerCase() === id.toLowerCase());

export const SPECIES = ['Aasimar', 'Dracónido', 'Elfo', 'Enano', 'Gnomo', 'Goliat', 'Humano', 'Mediano', 'Orco', 'Tiefling'];

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

export interface EffectPreset {
  id: string;
  name: string;
  kind: 'buff' | 'debuff';
  rounds: number | null;
  concentration: boolean;
  mods: EffectMods;
  notes: string;
  aliases: string[];
}

export const EFFECT_PRESETS: EffectPreset[] = [
  { id: 'bendicion', name: 'Bendición', kind: 'buff', rounds: 10, concentration: true, mods: { bonus: { attack: '+1d4', save: '+1d4' } }, notes: 'Suma 1d4 a tiradas de ataque y salvaciones. 1 minuto.', aliases: ['bendicion', 'bendición', 'bless'] },
  { id: 'perdicion', name: 'Perdición', kind: 'debuff', rounds: 10, concentration: false, mods: { bonus: { attack: '-1d4', save: '-1d4' } }, notes: 'Resta 1d4 a tiradas de ataque y salvaciones. 1 minuto.', aliases: ['perdicion', 'perdición', 'bane'] },
  { id: 'escudo_fe', name: 'Escudo de la fe', kind: 'buff', rounds: 100, concentration: true, mods: { ac: 2 }, notes: '+2 a la CA. 10 minutos.', aliases: ['escudo de la fe', 'shield of faith'] },
  { id: 'escudo', name: 'Escudo (conjuro)', kind: 'buff', rounds: 1, concentration: false, mods: { ac: 5 }, notes: 'Reacción: +5 a la CA hasta el inicio de tu siguiente turno (también contra el ataque que lo provocó). Inmune a Proyectil mágico.', aliases: ['conjuro escudo', 'escudo', 'shield'] },
  { id: 'celeridad', name: 'Celeridad', kind: 'buff', rounds: 10, concentration: true, mods: { ac: 2, speedMult: 2, advantage: ['Salvaciones de DES'] }, notes: '+2 CA, ventaja en salvaciones de DES, velocidad doble y una acción extra limitada (Atacar un solo ataque, Correr, Destrabarse, Esconderse o Utilizar). Al terminar, no puedes moverte ni actuar hasta después de tu siguiente turno.', aliases: ['celeridad', 'haste', 'acelerar'] },
  { id: 'lentitud', name: 'Lentitud', kind: 'debuff', rounds: 10, concentration: false, mods: { ac: -2, speedMult: 0.5, bonus: { save: '-2' } }, notes: '−2 a CA y salvaciones de DES, velocidad a la mitad, sin reacciones, solo acción o acción adicional, no ataques múltiples.', aliases: ['lentitud', 'slow', 'ralentizado'] },
  { id: 'furia', name: 'Furia', kind: 'buff', rounds: 100, concentration: false, mods: { resist: ['contundente', 'cortante', 'perforante'], bonus: { damage: '+2' }, advantage: ['Pruebas y salvaciones de FUE'] }, notes: 'Resistencia a daño contundente, cortante y perforante. Bonificador al daño con FUE. No puedes lanzar conjuros ni concentrarte. Se mantiene si atacas, fuerzas una salvación o usas acción adicional cada turno.', aliases: ['furia', 'rage', 'entro en furia', 'me enfurezco'] },
  { id: 'esquivar', name: 'Esquivando', kind: 'buff', rounds: 1, concentration: false, mods: { advantage: ['Salvaciones de DES'] }, notes: 'Ataques contra ti con desventaja hasta el inicio de tu siguiente turno.', aliases: ['esquivar', 'esquivo', 'dodge'] },
  { id: 'ayuda', name: 'Ayuda (conjuro)', kind: 'buff', rounds: null, concentration: false, mods: { maxHp: 5 }, notes: '+5 PG máximos y actuales durante 8 horas (+5 por nivel de espacio por encima de 2).', aliases: ['conjuro ayuda', 'aid'] },
  { id: 'armadura_mago', name: 'Armadura de mago', kind: 'buff', rounds: null, concentration: false, mods: { acBase: 13 }, notes: 'CA base 13 + mod. DES si no llevas armadura. 8 horas.', aliases: ['armadura de mago', 'mage armor'] },
  { id: 'heroismo', name: 'Heroísmo', kind: 'buff', rounds: 10, concentration: true, mods: {}, notes: 'Inmune a Asustado; al inicio de cada turno ganas PG temporales iguales al mod. de lanzamiento.', aliases: ['heroismo', 'heroísmo', 'heroism'] },
  { id: 'proteccion_mal', name: 'Protección contra el bien y el mal', kind: 'buff', rounds: 100, concentration: true, mods: {}, notes: 'Aberraciones, celestiales, elementales, feéricos, infernales y no muertos tienen desventaja al atacarte; no pueden hechizarte, asustarte ni poseerte.', aliases: ['proteccion contra el mal', 'protección contra el mal', 'proteccion contra el bien y el mal'] },
  { id: 'piel_roble', name: 'Piel robliza', kind: 'buff', rounds: 600, concentration: true, mods: {}, notes: 'Tu CA no puede ser inferior a 17.', aliases: ['piel robliza', 'piel de roble', 'barkskin'] },
  { id: 'agrandar', name: 'Agrandar', kind: 'buff', rounds: 10, concentration: true, mods: { bonus: { damage: '+1d4' }, advantage: ['Pruebas y salvaciones de FUE'] }, notes: 'Tamaño mayor, ventaja en FUE y +1d4 al daño con armas.', aliases: ['agrandar', 'enlarge'] },
  { id: 'reducir', name: 'Reducir', kind: 'debuff', rounds: 10, concentration: false, mods: { bonus: { damage: '-1d4' }, disadvantage: ['Pruebas y salvaciones de FUE'] }, notes: 'Tamaño menor, desventaja en FUE y −1d4 al daño con armas.', aliases: ['reducir', 'reduce', 'encoger'] },
  { id: 'marca_cazador', name: 'Marca del cazador', kind: 'buff', rounds: 600, concentration: true, mods: {}, notes: '+1d6 de daño de fuerza a tus impactos contra la criatura marcada; ventaja en Percepción/Supervivencia para encontrarla.', aliases: ['marca del cazador', "hunter's mark", 'marca de cazador'] },
  { id: 'maleficio', name: 'Maleficio', kind: 'buff', rounds: 600, concentration: true, mods: {}, notes: '+1d6 de daño necrótico a tus impactos contra el objetivo; desventaja para él en pruebas de la característica elegida.', aliases: ['maleficio', 'hex'] },
  { id: 'bendicion_luz', name: 'Inspiración bárdica (recibida)', kind: 'buff', rounds: 100, concentration: false, mods: {}, notes: 'Puedes sumar el dado de inspiración a una prueba d20 que falles.', aliases: ['inspiracion bardica', 'inspiración bárdica'] },
];
