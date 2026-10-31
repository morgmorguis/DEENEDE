// Progresión de clases de D&D 2024 (niveles 1-20): rasgos que se ganan, elecciones que hay que hacer y
// opciones disponibles explicadas. Resumido y parafraseado; nombres de subclases y dotes según el
// Player's Handbook 2024 y el SRD 5.2 (CC-BY-4.0).
import type { Ability, Recharge } from '../types';
import { CLASSES } from './srd';
import type { Tr } from '../i18n';

export interface Gain { name: Tr; text: Tr; subclass?: boolean }
export interface Option { id: string; name: Tr; text: Tr; minLevel?: number; abilities?: Ability[]; saveProf?: boolean }
export type Choice =
  | { kind: 'subclass' }
  | { kind: 'asi' }
  | { kind: 'boon' }
  | { kind: 'fightingStyle' }
  | { kind: 'expertise'; count: number; intOnly?: boolean }
  | { kind: 'metamagic'; count: number }
  | { kind: 'invocation'; count: number }
  | { kind: 'option'; id: string; title: Tr; options: Option[] };
export interface LevelEntry { features: Gain[]; choices: Choice[] }

const r = (es: string, en: string): Tr => ({ es, en });
const g = (es: string, en: string, tes: string, ten: string): Gain => ({ name: r(es, en), text: r(tes, ten) });
const o = (id: string, es: string, en: string, tes: string, ten: string, extra: Partial<Option> = {}): Option => ({ id, name: r(es, en), text: r(tes, ten), ...extra });
const SUB: Gain = { name: r('Rasgo de subclase', 'Subclass feature'), text: r('Tu subclase te da un rasgo nuevo a este nivel: consulta su descripción en el manual y añádela a tus rasgos.', 'Your subclass grants a new feature at this level: check its description in the rulebook and add it to your features.'), subclass: true };
const ASI: Choice = { kind: 'asi' };
const BOON: Choice = { kind: 'boon' };
const SUBCLASS: Choice = { kind: 'subclass' };

type Table = Record<number, [Gain[], Choice[]?]>;
const build = (t: Table): Record<number, LevelEntry> =>
  Object.fromEntries(Object.entries(t).map(([l, [features, choices]]) => [Number(l), { features, choices: choices ?? [] }]));

// ---------- Subclases ----------

export const SUBCLASSES: Record<string, Option[]> = {
  barbaro: [
    o('berserker', 'Senda del Berserker', 'Path of the Berserker', 'Furia desatada: daño extra con Frenesí al usar Ataque temerario y, más adelante, inmunidad a ser asustado o hechizado mientras estás en Furia.', 'Unbridled fury: extra Frenzy damage when you use Reckless Attack and, later, immunity to being Charmed or Frightened while raging.'),
    o('wild_heart', 'Senda del Corazón Salvaje', 'Path of the Wild Heart', 'Conexión con los animales: eliges un espíritu animal (oso, águila, lobo…) que te da beneficios en Furia, como resistencia a casi todo o moverte más.', 'Bond with beasts: choose an animal spirit (bear, eagle, wolf…) granting benefits while raging, like resistance to almost everything or extra mobility.'),
    o('world_tree', 'Senda del Árbol del Mundo', 'Path of the World Tree', 'Vitalidad del árbol cósmico: das PG temporales a aliados al enfurecerte y luego teletransportas y apresas a criaturas cercanas.', 'Vitality of the cosmic tree: grant Temporary HP to allies when you rage and later teleport and restrain nearby creatures.'),
    o('zealot', 'Senda del Fanático', 'Path of the Zealot', 'Furia divina: daño radiante o necrótico extra en el primer impacto de cada turno y te cuesta mucho morir.', 'Divine fury: extra Radiant or Necrotic damage on your first hit each turn, and you are very hard to kill.'),
  ],
  bardo: [
    o('dance', 'Colegio de la Danza', 'College of Dance', 'Combates sin armadura con movimientos de danza: tu dado de inspiración sustituye al daño desarmado y mejoras CA e iniciativa.', 'Fight unarmored with dance: your Bardic Inspiration die powers your unarmed strikes and boosts your AC and initiative.'),
    o('glamour', 'Colegio del Glamour', 'College of Glamour', 'Magia feérica: das PG temporales y movimiento a aliados al inspirarles y puedes hechizar a quien te rodea.', 'Fey magic: grant Temporary HP and movement when you inspire allies, and charm those around you.'),
    o('lore', 'Colegio del Conocimiento', 'College of Lore', 'Sabiduría y secretos: más habilidades, Palabras cortantes para restar tu dado a tiradas enemigas y conjuros de otras clases.', 'Knowledge and secrets: extra skills, Cutting Words to subtract your die from enemy rolls, and spells from other classes.'),
    o('valor', 'Colegio del Valor', 'College of Valor', 'Bardo guerrero: armaduras medias, escudos y armas marciales; tu inspiración mejora daño y CA, y luego Ataque extra.', 'Warrior bard: medium armor, shields and martial weapons; your inspiration boosts damage and AC, later Extra Attack.'),
  ],
  clerigo: [
    o('life', 'Dominio de la Vida', 'Life Domain', 'El mejor sanador: tus curaciones curan más y siempre tienes preparados conjuros de curación.', 'The best healer: your healing spells heal more and you always have healing spells prepared.'),
    o('light', 'Dominio de la Luz', 'Light Domain', 'Fuego y luz: deslumbras a quien te ataca con Destello protector y tus conjuros de fuego/radiante golpean fuerte.', 'Fire and light: impose Disadvantage with Warding Flare and your fire/radiant spells hit hard.'),
    o('trickery', 'Dominio del Engaño', 'Trickery Domain', 'Engaño e ilusión: bendices el sigilo de un aliado y creas un doble ilusorio desde el que lanzar conjuros.', 'Deception and illusion: bless an ally’s stealth and create an illusory duplicate to cast spells from.'),
    o('war', 'Dominio de la Guerra', 'War Domain', 'Clérigo de primera línea: ataques extra como acción adicional, bonificadores a tus golpes y armas marciales.', 'Front-line cleric: extra attacks as a Bonus Action, bonuses to your hits and martial weapons.'),
  ],
  druida: [
    o('land', 'Círculo de la Tierra', 'Circle of the Land', 'Conjuros ligados a un terreno (árido, polar, templado o tropical) y recuperas espacios de conjuro con un descanso corto.', 'Spells tied to a land type (arid, polar, temperate or tropical) and you recover spell slots on a Short Rest.'),
    o('moon', 'Círculo de la Luna', 'Circle of the Moon', 'Maestro de la Forma salvaje: bestias más fuertes, más PG temporales y CA mejorada al transformarte.', 'Wild Shape master: stronger beasts, more Temporary HP and better AC when you transform.'),
    o('sea', 'Círculo del Mar', 'Circle of the Sea', 'Furia del océano: un aura de agua que daña con frío y empuja a los enemigos; luego nadar y volar.', 'Wrath of the sea: an aura of water that deals cold damage and pushes enemies; later swim and fly.'),
    o('stars', 'Círculo de las Estrellas', 'Circle of the Stars', 'Forma estrellada: arquero, cáliz (curación) o dragón (concentración), con guía de las estrellas.', 'Starry form: archer, chalice (healing) or dragon (concentration), guided by the stars.'),
  ],
  guerrero: [
    o('battle_master', 'Maestro de batalla', 'Battle Master', 'Táctico: dados de superioridad para maniobras (derribar, desarmar, ordenar ataques, esquivar…).', 'Tactician: superiority dice for maneuvers (trip, disarm, commanding strike, evasive footwork…).'),
    o('champion', 'Campeón', 'Champion', 'Sencillo y potente: crítico con 19-20 (luego 18-20), Inspiración heroica y regeneración.', 'Simple and powerful: critical hits on 19-20 (later 18-20), Heroic Inspiration and regeneration.'),
    o('eldritch_knight', 'Caballero arcano', 'Eldritch Knight', 'Guerrero mago: conjuros de mago (sobre todo de abjuración y evocación) y vínculo con tus armas.', 'Warrior mage: wizard spells (mostly abjuration and evocation) and a bond with your weapons.'),
    o('psi_warrior', 'Guerrero psiónico', 'Psi Warrior', 'Poder mental: dados psiónicos para escudos de fuerza, golpes telequinéticos y moverte o mover objetos.', 'Mind power: psionic dice for force shields, telekinetic strikes and moving yourself or objects.'),
  ],
  monje: [
    o('mercy', 'Guerrero de la Misericordia', 'Warrior of Mercy', 'Sanador y verdugo: curas o dañas con tus golpes y luego quitas condiciones.', 'Healer and executioner: heal or harm with your strikes and later remove conditions.'),
    o('shadow', 'Guerrero de la Sombra', 'Warrior of Shadow', 'Sigilo y oscuridad: lanzas Oscuridad, ves a través de ella y te teletransportas entre sombras.', 'Stealth and darkness: cast Darkness, see through it and teleport between shadows.'),
    o('elements', 'Guerrero de los Elementos', 'Warrior of the Elements', 'Golpes elementales: alcance mayor y daño elemental con tus ataques sin armas, y ráfagas de elementos.', 'Elemental strikes: extra reach and elemental damage on unarmed strikes, and bursts of elements.'),
    o('open_hand', 'Guerrero de la Mano Abierta', 'Warrior of the Open Hand', 'Maestro de artes marciales: tu Ráfaga de golpes derriba, empuja o impide reacciones; luego te curas.', 'Martial arts master: your Flurry of Blows topples, pushes or denies reactions; later you heal yourself.'),
  ],
  paladin: [
    o('devotion', 'Juramento de Devoción', 'Oath of Devotion', 'El paladín clásico: Arma sagrada (CAR al ataque y luz) y aura contra el hechizamiento.', 'The classic paladin: Sacred Weapon (CHA to attacks and light) and an aura against being Charmed.'),
    o('glory', 'Juramento de Gloria', 'Oath of Glory', 'Héroe atlético: inspiras a aliados con PG temporales, te mueves más y potencias tus proezas físicas.', 'Athletic hero: inspire allies with Temporary HP, move faster and boost your physical feats.'),
    o('ancients', 'Juramento de los Antiguos', 'Oath of the Ancients', 'Protector de la naturaleza: atrapas enemigos con lianas y tu aura da resistencia al daño de conjuros.', 'Nature’s guardian: ensnare foes with vines and your aura grants resistance to spell damage.'),
    o('vengeance', 'Juramento de Venganza', 'Oath of Vengeance', 'Cazador implacable: Voto de enemistad (ventaja contra un objetivo) y persecución.', 'Relentless hunter: Vow of Enmity (Advantage against one target) and pursuit.'),
  ],
  explorador: [
    o('beast_master', 'Señor de las bestias', 'Beast Master', 'Un compañero animal primigenio (tierra, mar o cielo) que lucha a tu lado.', 'A primal beast companion (land, sea or sky) that fights by your side.'),
    o('fey_wanderer', 'Errante feérico', 'Fey Wanderer', 'Magia feérica: daño psíquico extra, más carisma y resistencia a encantamientos.', 'Fey magic: extra psychic damage, a charismatic edge and resistance to charm.'),
    o('gloom_stalker', 'Acechador en la penumbra', 'Gloom Stalker', 'Emboscador en la oscuridad: atacas primero, eres invisible a la visión en la oscuridad y daño extra en el primer turno.', 'Ambusher in the dark: strike first, invisible to darkvision and extra damage on your first turn.'),
    o('hunter', 'Cazador', 'Hunter', 'Especialista en cazar: daño extra contra criaturas heridas o ataques a varios enemigos, y defensas tácticas.', 'Hunting specialist: extra damage against wounded creatures or attacks against several foes, plus tactical defenses.'),
  ],
  picaro: [
    o('arcane_trickster', 'Embaucador arcano', 'Arcane Trickster', 'Pícaro mago: conjuros de mago (ilusión y encantamiento) y una Mano de mago invisible para robar.', 'Rogue mage: wizard spells (illusion and enchantment) and an invisible Mage Hand for stealing.'),
    o('assassin', 'Asesino', 'Assassin', 'Golpe letal: ventaja contra quien aún no ha actuado y daño extra con Ataque furtivo al sorprender.', 'Deadly strike: Advantage against creatures that haven’t acted yet and extra Sneak Attack damage on surprise.'),
    o('soulknife', 'Cuchillo del alma', 'Soulknife', 'Cuchillas psíquicas que creas de la nada y telepatía con tus aliados.', 'Psychic blades conjured from nothing and telepathy with your allies.'),
    o('thief', 'Ladrón', 'Thief', 'Manos rápidas: usas objetos y la acción Utilizar como acción adicional, trepas mejor y usas objetos mágicos.', 'Fast hands: use objects and the Utilize action as a Bonus Action, climb better and use magic items.'),
  ],
  hechicero: [
    o('aberrant', 'Hechicería aberrante', 'Aberrant Sorcery', 'Poder de otro mundo: telepatía y conjuros psiónicos que puedes lanzar con puntos de hechicería.', 'Otherworldly power: telepathy and psionic spells you can cast with Sorcery Points.'),
    o('clockwork', 'Hechicería mecánica', 'Clockwork Sorcery', 'Orden cósmico: anulas ventajas y desventajas y proteges a aliados de daño.', 'Cosmic order: cancel Advantage and Disadvantage and shield allies from damage.'),
    o('draconic', 'Hechicería dracónica', 'Draconic Sorcery', 'Sangre de dragón: más PG, CA natural, daño elemental extra y, más tarde, alas.', 'Dragon blood: more HP, natural AC, extra elemental damage and, later, wings.'),
    o('wild_magic', 'Hechicería salvaje', 'Wild Magic Sorcery', 'Magia caótica: oleadas de magia salvaje aleatorias y control de la suerte.', 'Chaotic magic: random wild magic surges and control over luck.'),
  ],
  brujo: [
    o('archfey', 'Patrón Archihada', 'Archfey Patron', 'Pacto feérico: te teletransportas con Paso brumoso gratis y asustas o hechizas a quien te rodea.', 'Fey pact: teleport with free Misty Steps and charm or frighten those around you.'),
    o('celestial', 'Patrón Celestial', 'Celestial Patron', 'Pacto con la luz: reserva de dados para curar y daño radiante o de fuego extra.', 'Pact with light: a pool of dice for healing and extra radiant or fire damage.'),
    o('fiend', 'Patrón Infernal', 'Fiend Patron', 'Pacto infernal: PG temporales al derrotar enemigos y resistencias a tu elección.', 'Infernal pact: Temporary HP when you defeat foes and resistances of your choice.'),
    o('great_old_one', 'Patrón Primigenio', 'Great Old One Patron', 'Pacto con lo incognoscible: telepatía, conjuros psíquicos y protección mental.', 'Pact with the unknowable: telepathy, psychic spells and mental protection.'),
  ],
  mago: [
    o('abjurer', 'Abjurador', 'Abjurer', 'Escudos mágicos: una Égida arcana que absorbe daño y contraconjuros mejorados.', 'Magic wards: an Arcane Ward that absorbs damage and improved counterspelling.'),
    o('diviner', 'Adivino', 'Diviner', 'Ver el futuro: Presagio te da dos d20 para sustituir tiradas tuyas o ajenas.', 'Seeing the future: Portent gives you two d20 rolls to replace your own or others’ rolls.'),
    o('evoker', 'Evocador', 'Evoker', 'Destrucción controlada: proteges a aliados de tus explosiones y sumas INT al daño.', 'Controlled destruction: protect allies from your blasts and add INT to damage.'),
    o('illusionist', 'Ilusionista', 'Illusionist', 'Engaño mágico: ilusiones mejoradas, criaturas ilusorias y desvío de ataques.', 'Magical deceit: improved illusions, illusory creatures and deflecting attacks.'),
  ],
};

// ---------- Dotes, estilos y otras opciones ----------

const PHYS: Ability[] = ['str', 'dex'];
const MENTAL: Ability[] = ['int', 'wis', 'cha'];
export const FEATS: Option[] = [
  o('actor', 'Actor', 'Actor', '+1 CAR. Ventaja en Engaño e Interpretación para hacerte pasar por otro e imitas voces.', '+1 CHA. Advantage on Deception and Performance to pass as someone else, and you can mimic voices.', { abilities: ['cha'] }),
  o('athlete', 'Atleta', 'Athlete', '+1 FUE o DES. Velocidad de trepar, te levantas con 5 pies y saltas con carrerilla corta.', '+1 STR or DEX. Climb Speed, stand up with 5 ft of movement and running jumps with a short run-up.', { abilities: PHYS }),
  o('charger', 'Embestidor', 'Charger', '+1 FUE o DES. Al Correr y atacar: +1d8 de daño o empujar 10 pies.', '+1 STR or DEX. When you Dash and attack: +1d8 damage or push 10 ft.', { abilities: PHYS }),
  o('crossbow_expert', 'Experto en ballestas', 'Crossbow Expert', '+1 DES. Ignoras Recarga, no tienes desventaja a distancia con enemigos al lado y sumas mod. al ataque de la mano torpe.', '+1 DEX. Ignore Loading, no Disadvantage for ranged attacks next to enemies and add your modifier to the off-hand attack.', { abilities: ['dex'] }),
  o('defensive_duelist', 'Duelista defensivo', 'Defensive Duelist', '+1 DES. Reacción con arma sutil: sumas tu bonificador de competencia a la CA contra un ataque cuerpo a cuerpo.', '+1 DEX. Reaction with a Finesse weapon: add your Proficiency Bonus to AC against a melee attack.', { abilities: ['dex'] }),
  o('dual_wielder', 'Combatiente con dos armas', 'Dual Wielder', '+1 FUE o DES. Ataque extra con la otra mano aunque no sea ligera y desenvainas dos armas a la vez.', '+1 STR or DEX. Extra off-hand attack even with non-Light weapons, and draw two weapons at once.', { abilities: PHYS }),
  o('durable', 'Resistente', 'Durable', '+1 CON. Ventaja en salvaciones contra la muerte y recuperas PG con un dado de golpe como acción adicional.', '+1 CON. Advantage on Death Saving Throws and spend a Hit Die as a Bonus Action to heal.', { abilities: ['con'] }),
  o('elemental_adept', 'Adepto elemental', 'Elemental Adept', '+1 INT, SAB o CAR. Tus conjuros ignoran la resistencia a un tipo de daño y los 1 cuentan como 2.', '+1 INT, WIS or CHA. Your spells ignore resistance to one damage type and 1s count as 2s.', { abilities: MENTAL }),
  o('fey_touched', 'Tocado por las hadas', 'Fey Touched', '+1 INT, SAB o CAR. Aprendes Paso brumoso y un conjuro de nivel 1 de adivinación o encantamiento; los lanzas gratis una vez al día.', '+1 INT, WIS or CHA. Learn Misty Step and a level 1 divination or enchantment spell; cast each free once per day.', { abilities: MENTAL }),
  o('grappler', 'Agarrador', 'Grappler', '+1 FUE o DES. Al impactar con un golpe sin armas puedes agarrar, ventaja contra quien agarras y lo arrastras sin coste extra.', '+1 STR or DEX. Grapple as part of an unarmed hit, Advantage against creatures you grapple and move them at no extra cost.', { abilities: PHYS }),
  o('great_weapon_master', 'Maestro de armas pesadas', 'Great Weapon Master', '+1 FUE. Daño extra igual a tu bonificador de competencia con armas pesadas y ataque adicional tras un crítico o derribar a alguien.', '+1 STR. Extra damage equal to your Proficiency Bonus with Heavy weapons and a Bonus Action attack after a crit or a kill.', { abilities: ['str'] }),
  o('heavy_armor_master', 'Maestro en armaduras pesadas', 'Heavy Armor Master', '+1 FUE o CON. Con armadura pesada reduces el daño contundente, cortante y perforante en tu bonificador de competencia.', '+1 STR or CON. In Heavy armor, reduce Bludgeoning, Piercing and Slashing damage by your Proficiency Bonus.', { abilities: ['str', 'con'] }),
  o('inspiring_leader', 'Líder inspirador', 'Inspiring Leader', '+1 SAB o CAR. Tras un descanso das PG temporales (nivel + mod.) a hasta 6 aliados.', '+1 WIS or CHA. After a rest, grant Temporary HP (level + modifier) to up to 6 allies.', { abilities: ['wis', 'cha'] }),
  o('keen_mind', 'Mente aguda', 'Keen Mind', '+1 INT. Competencia (o pericia) en una habilidad de INT y Estudiar como acción adicional.', '+1 INT. Proficiency (or Expertise) in an INT skill and Study as a Bonus Action.', { abilities: ['int'] }),
  o('mage_slayer', 'Cazamagos', 'Mage Slayer', '+1 FUE o DES. Rompes la concentración de quien dañas y una vez por descanso superas una salvación mental fallida.', '+1 STR or DEX. Break the concentration of creatures you damage and once per rest succeed on a failed mental save.', { abilities: PHYS }),
  o('observant', 'Observador', 'Observant', '+1 INT o SAB. Competencia o pericia en Percepción, Perspicacia o Investigación y Buscar como acción adicional.', '+1 INT or WIS. Proficiency or Expertise in Perception, Insight or Investigation and Search as a Bonus Action.', { abilities: ['int', 'wis'] }),
  o('polearm_master', 'Maestro de armas de asta', 'Polearm Master', '+1 FUE o DES. Ataque adicional con el extremo del arma de asta y ataque de oportunidad cuando entran en tu alcance.', '+1 STR or DEX. Bonus attack with the butt of a polearm and opportunity attacks when creatures enter your reach.', { abilities: PHYS }),
  o('resilient', 'Resiliente', 'Resilient', '+1 a la característica elegida y competencia en sus tiradas de salvación.', '+1 to the chosen ability and proficiency in its saving throws.', { abilities: ['str', 'dex', 'con', 'int', 'wis', 'cha'], saveProf: true }),
  o('ritual_caster', 'Lanzador de rituales', 'Ritual Caster', '+1 INT, SAB o CAR. Aprendes conjuros rituales de nivel 1 y lanzas rituales rápidamente una vez al día.', '+1 INT, WIS or CHA. Learn level 1 ritual spells and cast a ritual quickly once per day.', { abilities: MENTAL }),
  o('sentinel', 'Centinela', 'Sentinel', '+1 FUE o DES. Tus ataques de oportunidad dejan la Velocidad a 0 y atacas a quien golpea a un aliado.', '+1 STR or DEX. Your opportunity attacks reduce Speed to 0 and you can strike creatures that attack your allies.', { abilities: PHYS }),
  o('shadow_touched', 'Tocado por las sombras', 'Shadow Touched', '+1 INT, SAB o CAR. Aprendes Invisibilidad y un conjuro de nivel 1 de ilusión o nigromancia; los lanzas gratis una vez al día.', '+1 INT, WIS or CHA. Learn Invisibility and a level 1 illusion or necromancy spell; cast each free once per day.', { abilities: MENTAL }),
  o('sharpshooter', 'Tirador de primera', 'Sharpshooter', '+1 DES. Ignoras cobertura media y de tres cuartos, sin desventaja a larga distancia ni con enemigos al lado.', '+1 DEX. Ignore half and three-quarters cover, no Disadvantage at long range or with enemies adjacent.', { abilities: ['dex'] }),
  o('shield_master', 'Maestro con escudos', 'Shield Master', '+1 FUE. Golpe con escudo para empujar o derribar y sin daño en salvaciones de DES superadas.', '+1 STR. Shield bash to push or knock Prone, and no damage on successful DEX saves.', { abilities: ['str'] }),
  o('skill_expert', 'Experto en habilidades', 'Skill Expert', '+1 a cualquier característica. Competencia en una habilidad y pericia en otra.', '+1 to any ability. Proficiency in one skill and Expertise in another.', { abilities: ['str', 'dex', 'con', 'int', 'wis', 'cha'] }),
  o('speedy', 'Veloz', 'Speedy', '+1 DES o CON. +10 pies de Velocidad, Correr ignora terreno difícil y los ataques de oportunidad tienen desventaja.', '+1 DEX or CON. +10 ft Speed, Dash ignores difficult terrain and opportunity attacks have Disadvantage.', { abilities: ['dex', 'con'] }),
  o('spell_sniper', 'Francotirador de conjuros', 'Spell Sniper', '+1 INT, SAB o CAR. Tus ataques de conjuro ignoran cobertura, no tienen desventaja cuerpo a cuerpo y su alcance aumenta 60 pies.', '+1 INT, WIS or CHA. Your spell attacks ignore cover, have no melee Disadvantage and gain 60 ft of range.', { abilities: MENTAL }),
  o('war_caster', 'Lanzador de guerra', 'War Caster', '+1 INT, SAB o CAR. Ventaja para mantener la concentración, conjuros con las manos ocupadas y conjuros como ataque de oportunidad.', '+1 INT, WIS or CHA. Advantage to maintain Concentration, casting with full hands and spells as opportunity attacks.', { abilities: MENTAL }),
];

export const BOONS: Option[] = [
  o('combat_prowess', 'Don de la proeza en combate', 'Boon of Combat Prowess', '+1 a una característica (máx. 30). Una vez por turno conviertes un ataque fallado en impacto.', '+1 to an ability (max 30). Once per turn, turn a missed attack into a hit.', { abilities: ['str', 'dex', 'con', 'int', 'wis', 'cha'] }),
  o('dimensional_travel', 'Don del viaje dimensional', 'Boon of Dimensional Travel', '+1 a una característica (máx. 30). Tras atacar o usar Magia te teletransportas 30 pies.', '+1 to an ability (max 30). After you attack or take the Magic action, teleport 30 ft.', { abilities: ['str', 'dex', 'con', 'int', 'wis', 'cha'] }),
  o('fate', 'Don del destino', 'Boon of Fate', '+1 a una característica (máx. 30). Sumas o restas 2d4 a una prueba d20 cercana una vez por descanso.', '+1 to an ability (max 30). Add or subtract 2d4 from a nearby D20 Test once per rest.', { abilities: ['str', 'dex', 'con', 'int', 'wis', 'cha'] }),
  o('fortitude', 'Don de la fortaleza', 'Boon of Fortitude', '+1 a una característica (máx. 30). +40 PG máximos y curas más una vez por turno.', '+1 to an ability (max 30). +40 Hit Point maximum and extra healing once per turn.', { abilities: ['str', 'dex', 'con', 'int', 'wis', 'cha'] }),
  o('irresistible_offense', 'Don de la ofensiva irresistible', 'Boon of Irresistible Offense', '+1 FUE o DES (máx. 30). Tu daño ignora resistencias y un 20 natural añade daño igual a la puntuación.', '+1 STR or DEX (max 30). Your damage ignores resistance and a natural 20 adds damage equal to the score.', { abilities: PHYS }),
  o('recovery', 'Don de la recuperación', 'Boon of Recovery', '+1 a una característica (máx. 30). Evitas caer a 0 PG una vez por descanso y tienes una reserva de dados para curarte.', '+1 to an ability (max 30). Avoid dropping to 0 HP once per rest and gain a pool of dice to heal yourself.', { abilities: ['str', 'dex', 'con', 'int', 'wis', 'cha'] }),
  o('spell_recall', 'Don de la memoria de conjuros', 'Boon of Spell Recall', '+1 INT, SAB o CAR (máx. 30). Lanzas un conjuro de nivel 1-4 sin gastar espacio una vez por descanso.', '+1 INT, WIS or CHA (max 30). Cast a level 1-4 spell without a slot once per rest.', { abilities: MENTAL }),
  o('truesight', 'Don de la visión verdadera', 'Boon of Truesight', '+1 a una característica (máx. 30). Visión verdadera a 60 pies.', '+1 to an ability (max 30). Truesight 60 ft.', { abilities: ['str', 'dex', 'con', 'int', 'wis', 'cha'] }),
];

export const FIGHTING_STYLES: Option[] = [
  o('archery', 'Tiro con arco', 'Archery', '+2 a las tiradas de ataque con armas a distancia.', '+2 to attack rolls with ranged weapons.'),
  o('blind_fighting', 'Combate a ciegas', 'Blind Fighting', 'Vista ciega a 10 pies: ves lo invisible y en la oscuridad cerca de ti.', 'Blindsight 10 ft: see invisible creatures and in darkness near you.'),
  o('defense', 'Defensa', 'Defense', '+1 a la CA mientras llevas armadura.', '+1 AC while wearing armor.'),
  o('dueling', 'Duelo', 'Dueling', '+2 al daño con un arma cuerpo a cuerpo en una mano y nada en la otra (escudo permitido).', '+2 damage with a one-handed melee weapon and no other weapon (shield allowed).'),
  o('great_weapon', 'Combate con armas pesadas', 'Great Weapon Fighting', 'Con armas a dos manos o versátiles, los 1 y 2 de los dados de daño cuentan como 3.', 'With two-handed or versatile weapons, 1s and 2s on damage dice count as 3s.'),
  o('interception', 'Intercepción', 'Interception', 'Reacción: reduces 1d10 + bonificador de competencia el daño a un aliado a 5 pies.', 'Reaction: reduce damage to an ally within 5 ft by 1d10 + Proficiency Bonus.'),
  o('protection', 'Protección', 'Protection', 'Reacción con escudo: das desventaja a un ataque contra un aliado a 5 pies.', 'Reaction with a shield: impose Disadvantage on an attack against an ally within 5 ft.'),
  o('thrown_weapon', 'Combate con armas arrojadizas', 'Thrown Weapon Fighting', '+2 al daño con armas arrojadizas y las desenvainas al lanzarlas.', '+2 damage with thrown weapons and draw them as part of the attack.'),
  o('two_weapon', 'Combate con dos armas', 'Two-Weapon Fighting', 'Sumas tu modificador al daño del ataque con la otra mano.', 'Add your ability modifier to the damage of the off-hand attack.'),
  o('unarmed', 'Combate sin armas', 'Unarmed Fighting', 'Golpes sin armas de 1d6 (1d8 sin nada en las manos) y daño a quien agarras.', 'Unarmed strikes deal 1d6 (1d8 with empty hands) and damage creatures you grapple.'),
];

export const METAMAGIC: Option[] = [
  o('careful', 'Conjuro cuidadoso', 'Careful Spell', '1 punto: aliados elegidos superan automáticamente la salvación de tu conjuro y no reciben daño.', '1 point: chosen allies automatically succeed on your spell’s save and take no damage.'),
  o('distant', 'Conjuro distante', 'Distant Spell', '1 punto: duplicas el alcance (o toque pasa a 30 pies).', '1 point: double the range (or Touch becomes 30 ft).'),
  o('empowered', 'Conjuro potenciado', 'Empowered Spell', '1 punto: vuelves a tirar hasta tu mod. CAR en dados de daño.', '1 point: reroll up to your CHA modifier in damage dice.'),
  o('extended', 'Conjuro prolongado', 'Extended Spell', '1 punto: duplicas la duración y tienes ventaja para mantener la concentración.', '1 point: double the duration and gain Advantage to maintain Concentration.'),
  o('heightened', 'Conjuro intensificado', 'Heightened Spell', '2 puntos: un objetivo tiene desventaja en la salvación.', '2 points: one target has Disadvantage on the save.'),
  o('quickened', 'Conjuro acelerado', 'Quickened Spell', '2 puntos: lanzas un conjuro de una acción como acción adicional.', '2 points: cast an action spell as a Bonus Action.'),
  o('seeking', 'Conjuro rastreador', 'Seeking Spell', '1 punto: repites un ataque de conjuro fallado.', '1 point: reroll a missed spell attack.'),
  o('subtle', 'Conjuro sutil', 'Subtle Spell', '1 punto: sin componentes verbales, somáticos ni materiales sin coste.', '1 point: no Verbal, Somatic or costless Material components.'),
  o('transmuted', 'Conjuro transmutado', 'Transmuted Spell', '1 punto: cambias el tipo de daño elemental del conjuro.', '1 point: change the spell’s elemental damage type.'),
  o('twinned', 'Conjuro gemelo', 'Twinned Spell', '1 punto: subes un nivel el conjuro para afectar a un objetivo más.', '1 point: increase the spell’s level by one to affect an extra target.'),
];

export const INVOCATIONS: Option[] = [
  o('agonizing_blast', 'Explosión agonizante', 'Agonizing Blast', 'Sumas tu mod. CAR al daño de un truco de brujo (p. ej. Descarga sobrenatural).', 'Add your CHA modifier to the damage of a warlock cantrip (e.g. Eldritch Blast).', { minLevel: 2 }),
  o('armor_of_shadows', 'Armadura de sombras', 'Armor of Shadows', 'Lanzas Armadura de mago sobre ti sin gastar espacio.', 'Cast Mage Armor on yourself without a spell slot.'),
  o('devils_sight', 'Vista del diablo', 'Devil’s Sight', 'Ves con normalidad en oscuridad mágica y no mágica a 120 pies.', 'See normally in magical and nonmagical darkness within 120 ft.', { minLevel: 2 }),
  o('eldritch_mind', 'Mente sobrenatural', 'Eldritch Mind', 'Ventaja en salvaciones de CON para mantener la concentración.', 'Advantage on CON saves to maintain Concentration.'),
  o('eldritch_spear', 'Lanza sobrenatural', 'Eldritch Spear', 'Tu truco de daño alcanza mucho más lejos (30 pies × nivel de brujo).', 'Your damaging cantrip’s range increases greatly (30 ft × warlock level).', { minLevel: 2 }),
  o('fiendish_vigor', 'Vigor infernal', 'Fiendish Vigor', 'Lanzas Falsa vida sobre ti sin espacio y obtienes el máximo de PG temporales.', 'Cast False Life on yourself without a slot, getting the maximum Temporary HP.', { minLevel: 2 }),
  o('mask_of_many_faces', 'Máscara de muchos rostros', 'Mask of Many Faces', 'Lanzas Disfrazarse sin gastar espacio.', 'Cast Disguise Self without a spell slot.', { minLevel: 2 }),
  o('misty_visions', 'Visiones brumosas', 'Misty Visions', 'Lanzas Imagen silenciosa sin gastar espacio.', 'Cast Silent Image without a spell slot.', { minLevel: 2 }),
  o('pact_blade', 'Pacto del filo', 'Pact of the Blade', 'Invocas un arma de pacto, usas CAR para atacar con ella y puede hacer daño necrótico, psíquico o radiante.', 'Conjure a pact weapon, attack with CHA and deal necrotic, psychic or radiant damage.'),
  o('pact_chain', 'Pacto de la cadena', 'Pact of the Chain', 'Aprendes Encontrar familiar con formas especiales (diablillo, pseudodragón…).', 'Learn Find Familiar with special forms (imp, pseudodragon…).'),
  o('pact_tome', 'Pacto del tomo', 'Pact of the Tome', 'Un Libro de las sombras con 3 trucos y 2 rituales de cualquier clase.', 'A Book of Shadows with 3 cantrips and 2 rituals from any class.'),
  o('repelling_blast', 'Explosión repulsora', 'Repelling Blast', 'Tu truco de ataque empuja 10 pies al objetivo.', 'Your attack cantrip pushes the target 10 ft.', { minLevel: 2 }),
  o('otherworldly_leap', 'Salto de otro mundo', 'Otherworldly Leap', 'Lanzas Salto sobre ti sin gastar espacio.', 'Cast Jump on yourself without a spell slot.', { minLevel: 2 }),
  o('thirsting_blade', 'Filo sediento', 'Thirsting Blade', 'Atacas dos veces con tu arma de pacto (requiere Pacto del filo).', 'Attack twice with your pact weapon (requires Pact of the Blade).', { minLevel: 5 }),
  o('one_with_shadows', 'Uno con las sombras', 'One with Shadows', 'En luz tenue u oscuridad te vuelves invisible con Invisibilidad sin espacio.', 'In dim light or darkness, cast Invisibility on yourself without a slot.', { minLevel: 5 }),
  o('ascendant_step', 'Paso ascendente', 'Ascendant Step', 'Lanzas Levitar sobre ti sin gastar espacio.', 'Cast Levitate on yourself without a spell slot.', { minLevel: 5 }),
  o('gift_of_the_depths', 'Don de las profundidades', 'Gift of the Depths', 'Respiras bajo el agua, velocidad nadando y Respirar bajo el agua una vez al día.', 'Breathe underwater, gain a Swim Speed and cast Water Breathing once per day.', { minLevel: 5 }),
  o('devouring_blade', 'Filo devorador', 'Devouring Blade', 'Atacas tres veces con tu arma de pacto (requiere Filo sediento).', 'Attack three times with your pact weapon (requires Thirsting Blade).', { minLevel: 12 }),
];

const BLESSED_STRIKES: Choice = { kind: 'option', id: 'blessed_strikes', title: r('Golpes benditos', 'Blessed Strikes'), options: [
  o('divine_strike', 'Golpe divino', 'Divine Strike', 'Una vez por turno, +1d8 necrótico o radiante a un impacto con arma.', 'Once per turn, +1d8 Necrotic or Radiant damage on a weapon hit.'),
  o('potent_spellcasting', 'Lanzamiento potente', 'Potent Spellcasting', 'Sumas tu mod. SAB al daño de tus trucos de clérigo.', 'Add your WIS modifier to the damage of your cleric cantrips.'),
] };
const ELEMENTAL_FURY: Choice = { kind: 'option', id: 'elemental_fury', title: r('Furia elemental', 'Elemental Fury'), options: [
  o('potent_spellcasting', 'Lanzamiento potente', 'Potent Spellcasting', 'Sumas tu mod. SAB al daño de tus trucos de druida.', 'Add your WIS modifier to the damage of your druid cantrips.'),
  o('primal_strike', 'Golpe primigenio', 'Primal Strike', 'Una vez por turno, +1d8 de frío, fuego, relámpago o trueno a un impacto con arma o en forma de bestia.', 'Once per turn, +1d8 Cold, Fire, Lightning or Thunder damage on a weapon or beast-form hit.'),
] };

// ---------- Rasgos por nivel ----------

const EXTRA = g('Ataque extra', 'Extra Attack', 'Atacas dos veces con la acción Atacar.', 'You attack twice when you take the Attack action.');
const EVASION = g('Evasión', 'Evasion', 'En salvaciones de DES para mitad de daño: éxito = 0 daño, fallo = mitad.', 'On DEX saves for half damage: success = no damage, failure = half.');
const ASI_G = g('Mejora de característica', 'Ability Score Improvement', 'Eliges +2 a una característica, +1 a dos, o una dote.', 'Choose +2 to one ability, +1 to two, or a feat.');
const BOON_G = g('Don épico', 'Epic Boon', 'Eliges un don épico (o una dote) que sube una característica hasta 30.', 'Choose an Epic Boon (or a feat) that raises an ability up to 30.');
const SUBCLASS_G = g('Subclase', 'Subclass', 'Eliges tu subclase, que te da rasgos a lo largo de tu carrera.', 'Choose your subclass, which grants features over your career.');

const PROGRESSION: Record<string, Record<number, LevelEntry>> = {
  barbaro: build({
    2: [[g('Sentido del peligro', 'Danger Sense', 'Ventaja en salvaciones de DES salvo que estés Incapacitado.', 'Advantage on DEX saves unless Incapacitated.'), g('Ataque temerario', 'Reckless Attack', 'Ventaja en tus ataques de FUE este turno, pero los ataques contra ti también tienen ventaja.', 'Advantage on your STR attacks this turn, but attacks against you also have Advantage.')]],
    3: [[SUBCLASS_G, g('Conocimiento primigenio', 'Primal Knowledge', 'Una habilidad más de la lista de bárbaro; en Furia puedes usar FUE para algunas pruebas (Acrobacias, Sigilo, Percepción…).', 'One more Barbarian skill; while raging you can use STR for some checks (Acrobatics, Stealth, Perception…).')], [SUBCLASS]],
    4: [[ASI_G], [ASI]],
    5: [[EXTRA, g('Movimiento rápido', 'Fast Movement', '+10 pies de Velocidad sin armadura pesada.', '+10 ft Speed while not wearing Heavy armor.')]],
    6: [[SUB]],
    7: [[g('Instinto salvaje', 'Feral Instinct', 'Ventaja en las tiradas de iniciativa.', 'Advantage on Initiative rolls.'), g('Abalanzarse instintivo', 'Instinctive Pounce', 'Al entrar en Furia te mueves hasta la mitad de tu Velocidad.', 'When you enter your Rage, move up to half your Speed.')]],
    8: [[ASI_G], [ASI]],
    9: [[g('Golpe brutal', 'Brutal Strike', 'Al usar Ataque temerario renuncias a la ventaja en un ataque para +1d10 de daño y un efecto (empujar o frenar).', 'When you use Reckless Attack, forgo Advantage on one attack for +1d10 damage and an effect (push or hamstring).')]],
    10: [[SUB]],
    11: [[g('Furia implacable', 'Relentless Rage', 'Si caes a 0 PG en Furia, salvación de CON (CD 10, +5 cada vez) para quedarte con PG iguales al doble de tu nivel.', 'If you drop to 0 HP while raging, CON save (DC 10, +5 each time) to stay at HP equal to twice your level.')]],
    12: [[ASI_G], [ASI]],
    13: [[g('Golpe brutal mejorado', 'Improved Brutal Strike', 'Nuevos efectos de Golpe brutal (salvaciones con desventaja o ventaja para aliados).', 'New Brutal Strike effects (staggering or sundering blow).')]],
    14: [[SUB]],
    15: [[g('Furia persistente', 'Persistent Rage', 'Al tirar iniciativa recuperas usos de Furia; la Furia dura 10 min sin necesidad de mantenerla.', 'Regain Rage uses when you roll initiative; Rage lasts 10 minutes without needing to extend it.')]],
    16: [[ASI_G], [ASI]],
    17: [[g('Golpe brutal mejorado', 'Improved Brutal Strike', 'Golpe brutal hace +2d10 y puedes aplicar dos efectos.', 'Brutal Strike deals +2d10 and you can apply two effects.')]],
    18: [[g('Poder indomable', 'Indomitable Might', 'Si tu prueba de FUE es menor que tu puntuación de FUE, usas la puntuación.', 'If your STR check total is lower than your STR score, use the score instead.')]],
    19: [[BOON_G], [BOON]],
    20: [[g('Campeón primigenio', 'Primal Champion', '+4 a FUE y CON (máximo 25).', '+4 to STR and CON (maximum 25).')]],
  }),
  bardo: build({
    2: [[g('Experto', 'Expertise', 'Pericia en dos habilidades en las que seas competente.', 'Expertise in two skills you’re proficient in.'), g('Aprendiz de todo', 'Jack of All Trades', 'Sumas la mitad de tu bonificador de competencia a pruebas sin competencia.', 'Add half your Proficiency Bonus to checks you aren’t proficient in.')], [{ kind: 'expertise', count: 2 }]],
    3: [[SUBCLASS_G], [SUBCLASS]],
    4: [[ASI_G], [ASI]],
    5: [[g('Fuente de inspiración', 'Font of Inspiration', 'Recuperas Inspiración bárdica en descanso corto y puedes gastar un espacio para recuperar un uso.', 'Regain Bardic Inspiration on a Short Rest and spend a slot to regain a use.')]],
    6: [[SUB]],
    7: [[g('Contraencanto', 'Countercharm', 'Reacción: un aliado que falle una salvación contra Asustado o Hechizado la repite con ventaja.', 'Reaction: an ally who fails a save against Charmed or Frightened rerolls with Advantage.')]],
    8: [[ASI_G], [ASI]],
    9: [[g('Experto', 'Expertise', 'Pericia en dos habilidades más.', 'Expertise in two more skills.')], [{ kind: 'expertise', count: 2 }]],
    10: [[g('Secretos mágicos', 'Magical Secrets', 'Puedes preparar conjuros de las listas de bardo, clérigo, druida y mago.', 'You can prepare spells from the Bard, Cleric, Druid and Wizard lists.')]],
    12: [[ASI_G], [ASI]],
    14: [[SUB]],
    16: [[ASI_G], [ASI]],
    18: [[g('Inspiración superior', 'Superior Inspiration', 'Al tirar iniciativa recuperas usos de Inspiración bárdica hasta tener 2.', 'When you roll initiative, regain Bardic Inspiration uses until you have 2.')]],
    19: [[BOON_G], [BOON]],
    20: [[g('Palabras de creación', 'Words of Creation', 'Siempre tienes preparados Palabra de poder: matar y curar, y afectan a dos criaturas.', 'You always have Power Word Kill and Heal prepared, and they can target two creatures.')]],
  }),
  clerigo: build({
    2: [[g('Canalizar divinidad', 'Channel Divinity', 'Chispa divina (curar o dañar 1d8 + SAB) o Expulsar muertos vivientes.', 'Divine Spark (heal or harm 1d8 + WIS) or Turn Undead.')]],
    3: [[SUBCLASS_G], [SUBCLASS]],
    4: [[ASI_G], [ASI]],
    5: [[g('Abrasar muertos vivientes', 'Sear Undead', 'Al Expulsar muertos vivientes, les infliges daño radiante extra.', 'When you Turn Undead, deal extra Radiant damage to them.')]],
    6: [[SUB]],
    7: [[g('Golpes benditos', 'Blessed Strikes', 'Eliges Golpe divino o Lanzamiento potente.', 'Choose Divine Strike or Potent Spellcasting.')], [BLESSED_STRIKES]],
    8: [[ASI_G], [ASI]],
    10: [[g('Intervención divina', 'Divine Intervention', 'Una vez por descanso largo lanzas cualquier conjuro de clérigo de nivel 5 o menos sin espacio.', 'Once per Long Rest, cast any cleric spell of level 5 or lower without a slot.')]],
    12: [[ASI_G], [ASI]],
    14: [[g('Golpes benditos mejorados', 'Improved Blessed Strikes', 'Tu opción de Golpes benditos mejora (2d8 o PG temporales).', 'Your Blessed Strikes option improves (2d8 or Temporary HP).')]],
    16: [[ASI_G], [ASI]],
    17: [[SUB]],
    19: [[BOON_G], [BOON]],
    20: [[g('Intervención divina mayor', 'Greater Divine Intervention', 'Tu Intervención divina puede lanzar Deseo.', 'Your Divine Intervention can cast Wish.')]],
  }),
  druida: build({
    2: [[g('Forma salvaje', 'Wild Shape', 'Acción adicional: te transformas en una bestia conocida y ganas PG temporales.', 'Bonus Action: transform into a known beast and gain Temporary HP.'), g('Compañero salvaje', 'Wild Companion', 'Gastas un uso de Forma salvaje o un espacio para lanzar Encontrar familiar.', 'Expend a Wild Shape use or a slot to cast Find Familiar.')]],
    3: [[SUBCLASS_G], [SUBCLASS]],
    4: [[ASI_G], [ASI]],
    5: [[g('Resurgir salvaje', 'Wild Resurgence', 'Cambias un espacio por un uso de Forma salvaje o viceversa (una vez por descanso).', 'Trade a spell slot for a Wild Shape use or vice versa (once per rest).')]],
    6: [[SUB]],
    7: [[g('Furia elemental', 'Elemental Fury', 'Eliges Lanzamiento potente o Golpe primigenio.', 'Choose Potent Spellcasting or Primal Strike.')], [ELEMENTAL_FURY]],
    8: [[ASI_G], [ASI]],
    10: [[SUB]],
    12: [[ASI_G], [ASI]],
    14: [[SUB]],
    15: [[g('Furia elemental mejorada', 'Improved Elemental Fury', 'Tu opción de Furia elemental mejora.', 'Your Elemental Fury option improves.')]],
    16: [[ASI_G], [ASI]],
    18: [[g('Conjuros de bestia', 'Beast Spells', 'Puedes lanzar conjuros en Forma salvaje.', 'You can cast spells while in Wild Shape.')]],
    19: [[BOON_G], [BOON]],
    20: [[g('Archidruida', 'Archdruid', 'Recuperas Forma salvaje al tirar iniciativa y conviertes usos en espacios.', 'Regain Wild Shape when you roll initiative and convert uses into spell slots.')]],
  }),
  guerrero: build({
    2: [[g('Oleada de acción', 'Action Surge', 'Una vez por descanso ganas una acción extra en tu turno.', 'Once per rest, take one additional action on your turn.'), g('Mente táctica', 'Tactical Mind', 'Si fallas una prueba, gastas Tomar aliento para sumar 1d10.', 'If you fail a check, expend Second Wind to add 1d10.')]],
    3: [[SUBCLASS_G], [SUBCLASS]],
    4: [[ASI_G], [ASI]],
    5: [[EXTRA, g('Cambio táctico', 'Tactical Shift', 'Al usar Tomar aliento te mueves la mitad de tu Velocidad sin provocar ataques de oportunidad.', 'When you use Second Wind, move half your Speed without provoking opportunity attacks.')]],
    6: [[ASI_G], [ASI]],
    7: [[SUB]],
    8: [[ASI_G], [ASI]],
    9: [[g('Indomable', 'Indomitable', 'Repites una salvación fallada sumando tu nivel de guerrero.', 'Reroll a failed save, adding your Fighter level.'), g('Maestro táctico', 'Tactical Master', 'Al atacar puedes cambiar la maestría del arma por Empujar, Debilitar o Ralentizar.', 'When you attack, swap the weapon’s mastery for Push, Sap or Slow.')]],
    10: [[SUB]],
    11: [[g('Dos ataques extra', 'Two Extra Attacks', 'Atacas tres veces con la acción Atacar.', 'You attack three times when you take the Attack action.')]],
    12: [[ASI_G], [ASI]],
    13: [[g('Ataques estudiados', 'Studied Attacks', 'Si fallas un ataque, tienes ventaja en el siguiente contra esa criatura.', 'If you miss an attack, you have Advantage on your next attack against that creature.')]],
    14: [[ASI_G], [ASI]],
    15: [[SUB]],
    16: [[ASI_G], [ASI]],
    17: [[g('Oleada de acción (2 usos)', 'Action Surge (two uses)', 'Dos usos de Oleada de acción por descanso (uno por turno).', 'Two uses of Action Surge per rest (one per turn).')]],
    18: [[SUB]],
    19: [[BOON_G], [BOON]],
    20: [[g('Tres ataques extra', 'Three Extra Attacks', 'Atacas cuatro veces con la acción Atacar.', 'You attack four times when you take the Attack action.')]],
  }),
  monje: build({
    2: [[g('Concentración del monje', 'Monk’s Focus', 'Puntos de concentración: Ráfaga de golpes, Defensa paciente y Paso del viento.', 'Focus Points: Flurry of Blows, Patient Defense and Step of the Wind.'), g('Movimiento sin armadura', 'Unarmored Movement', '+10 pies de Velocidad sin armadura ni escudo (aumenta con el nivel).', '+10 ft Speed without armor or shield (increases with level).'), g('Metabolismo asombroso', 'Uncanny Metabolism', 'Al tirar iniciativa recuperas tus puntos de concentración y te curas.', 'When you roll initiative, regain your Focus Points and heal.')]],
    3: [[SUBCLASS_G, g('Desviar ataques', 'Deflect Attacks', 'Reacción: reduces el daño de un ataque y, si llega a 0, puedes redirigirlo.', 'Reaction: reduce an attack’s damage and, if it hits 0, redirect it.')], [SUBCLASS]],
    4: [[ASI_G, g('Caída lenta', 'Slow Fall', 'Reacción: reduces el daño por caída en 5 × tu nivel.', 'Reaction: reduce falling damage by 5 × your level.')], [ASI]],
    5: [[EXTRA, g('Golpe aturdidor', 'Stunning Strike', '1 punto: el objetivo hace una salvación de CON o queda Aturdido hasta tu siguiente turno.', '1 point: the target makes a CON save or is Stunned until your next turn.')]],
    6: [[SUB, g('Golpes potenciados', 'Empowered Strikes', 'Tus golpes sin armas pueden hacer daño de fuerza.', 'Your unarmed strikes can deal Force damage.')]],
    7: [[EVASION]],
    8: [[ASI_G], [ASI]],
    9: [[g('Movimiento acrobático', 'Acrobatic Movement', 'Caminas por paredes y sobre líquidos durante tu movimiento.', 'Move along walls and across liquids during your move.')]],
    10: [[g('Concentración intensificada', 'Heightened Focus', 'Ráfaga, Defensa paciente y Paso del viento mejoran.', 'Flurry, Patient Defense and Step of the Wind improve.'), g('Autorrestablecimiento', 'Self-Restoration', 'Al final de tu turno te quitas Hechizado, Asustado o Envenenado.', 'At the end of your turn, remove Charmed, Frightened or Poisoned.')]],
    11: [[SUB]],
    12: [[ASI_G], [ASI]],
    13: [[g('Desviar energía', 'Deflect Energy', 'Desviar ataques funciona con cualquier tipo de daño.', 'Deflect Attacks works against any damage type.')]],
    14: [[g('Superviviente disciplinado', 'Disciplined Survivor', 'Competencia en todas las salvaciones y repites salvaciones falladas con 1 punto.', 'Proficiency in all saves and reroll failed saves for 1 point.')]],
    15: [[g('Concentración perfecta', 'Perfect Focus', 'Al tirar iniciativa con 3 o menos puntos, recuperas hasta 4.', 'When you roll initiative with 3 or fewer points, regain up to 4.')]],
    16: [[ASI_G], [ASI]],
    17: [[SUB]],
    18: [[g('Defensa superior', 'Superior Defense', '3 puntos: resistencia a todo salvo fuerza durante 1 minuto.', '3 points: resistance to all damage except Force for 1 minute.')]],
    19: [[BOON_G], [BOON]],
    20: [[g('Cuerpo y mente', 'Body and Mind', '+4 a DES y SAB (máximo 25).', '+4 to DEX and WIS (maximum 25).')]],
  }),
  paladin: build({
    2: [[g('Estilo de combate', 'Fighting Style', 'Eliges una dote de estilo de combate.', 'Choose a Fighting Style feat.'), g('Castigo del paladín', 'Paladin’s Smite', 'Siempre tienes preparado Castigo divino y lo lanzas gratis una vez por descanso largo.', 'You always have Divine Smite prepared and cast it free once per Long Rest.')], [{ kind: 'fightingStyle' }]],
    3: [[SUBCLASS_G, g('Canalizar divinidad', 'Channel Divinity', 'Sentido divino y las opciones de tu juramento.', 'Divine Sense and your oath’s options.')], [SUBCLASS]],
    4: [[ASI_G], [ASI]],
    5: [[EXTRA, g('Montura fiel', 'Faithful Steed', 'Siempre tienes preparado Encontrar corcel y lo lanzas gratis una vez al día.', 'You always have Find Steed prepared and cast it free once per day.')]],
    6: [[g('Aura de protección', 'Aura of Protection', 'Tú y aliados a 10 pies sumáis tu mod. CAR a las salvaciones.', 'You and allies within 10 ft add your CHA mod to saving throws.')]],
    7: [[SUB]],
    8: [[ASI_G], [ASI]],
    9: [[g('Abjurar enemigos', 'Abjure Foes', 'Canalizar divinidad: asustas a varios enemigos.', 'Channel Divinity: frighten several enemies.')]],
    10: [[g('Aura de valor', 'Aura of Courage', 'Tú y aliados en tu aura sois inmunes a Asustado.', 'You and allies in your aura are immune to Frightened.')]],
    11: [[g('Golpes radiantes', 'Radiant Strikes', 'Tus impactos con armas cuerpo a cuerpo hacen +1d8 radiante.', 'Your melee weapon hits deal +1d8 Radiant damage.')]],
    12: [[ASI_G], [ASI]],
    14: [[g('Toque restaurador', 'Restoring Touch', 'Imposición de manos también quita condiciones (Cegado, Asustado, Paralizado…).', 'Lay On Hands also removes conditions (Blinded, Frightened, Paralyzed…).')]],
    15: [[SUB]],
    16: [[ASI_G], [ASI]],
    18: [[g('Expansión de aura', 'Aura Expansion', 'Tus auras alcanzan 30 pies.', 'Your auras reach 30 ft.')]],
    19: [[BOON_G], [BOON]],
    20: [[SUB]],
  }),
  explorador: build({
    2: [[g('Explorador hábil', 'Deft Explorer', 'Pericia en una habilidad y dos idiomas.', 'Expertise in one skill and two languages.'), g('Estilo de combate', 'Fighting Style', 'Eliges una dote de estilo de combate.', 'Choose a Fighting Style feat.')], [{ kind: 'expertise', count: 1 }, { kind: 'fightingStyle' }]],
    3: [[SUBCLASS_G], [SUBCLASS]],
    4: [[ASI_G], [ASI]],
    5: [[EXTRA]],
    6: [[g('Errante', 'Roving', '+10 pies de Velocidad y velocidad de trepar y nadar sin armadura pesada.', '+10 ft Speed and Climb/Swim Speed without Heavy armor.')]],
    7: [[SUB]],
    8: [[ASI_G], [ASI]],
    9: [[g('Pericia', 'Expertise', 'Pericia en dos habilidades más.', 'Expertise in two more skills.')], [{ kind: 'expertise', count: 2 }]],
    10: [[g('Incansable', 'Tireless', 'Ganas PG temporales como acción y reduces el agotamiento al descansar.', 'Gain Temporary HP as an action and reduce Exhaustion when you rest.')]],
    11: [[SUB]],
    12: [[ASI_G], [ASI]],
    13: [[g('Cazador implacable', 'Relentless Hunter', 'El daño no rompe tu concentración en Marca del cazador.', 'Damage can’t break your Concentration on Hunter’s Mark.')]],
    14: [[g('Velo de la naturaleza', 'Nature’s Veil', 'Acción adicional: te vuelves Invisible hasta el final de tu siguiente turno.', 'Bonus Action: become Invisible until the end of your next turn.')]],
    15: [[SUB]],
    16: [[ASI_G], [ASI]],
    17: [[g('Cazador preciso', 'Precise Hunter', 'Ventaja en ataques contra el objetivo de tu Marca del cazador.', 'Advantage on attacks against your Hunter’s Mark target.')]],
    18: [[g('Sentidos salvajes', 'Feral Senses', 'Vista ciega a 30 pies.', 'Blindsight 30 ft.')]],
    19: [[BOON_G], [BOON]],
    20: [[g('Asesino de enemigos', 'Foe Slayer', 'El dado de Marca del cazador es un d10.', 'Your Hunter’s Mark damage die is a d10.')]],
  }),
  picaro: build({
    2: [[g('Acción astuta', 'Cunning Action', 'Acción adicional: Correr, Destrabarse o Esconderse.', 'Bonus Action: Dash, Disengage or Hide.')]],
    3: [[SUBCLASS_G, g('Puntería firme', 'Steady Aim', 'Acción adicional: ventaja en tu siguiente ataque si no te mueves este turno.', 'Bonus Action: Advantage on your next attack if you don’t move this turn.')], [SUBCLASS]],
    4: [[ASI_G], [ASI]],
    5: [[g('Golpe astuto', 'Cunning Strike', 'Renuncias a dados de Ataque furtivo para envenenar, derribar o retirarte.', 'Forgo Sneak Attack dice to poison, trip or withdraw.'), g('Esquiva asombrosa', 'Uncanny Dodge', 'Reacción: reduces a la mitad el daño de un ataque que te impacta.', 'Reaction: halve the damage of an attack that hits you.')]],
    6: [[g('Pericia', 'Expertise', 'Pericia en dos habilidades más.', 'Expertise in two more skills.')], [{ kind: 'expertise', count: 2 }]],
    7: [[EVASION, g('Talento fiable', 'Reliable Talent', 'En pruebas con competencia, un 9 o menos en el d20 cuenta como 10.', 'On checks you’re proficient in, treat a d20 roll of 9 or lower as a 10.')]],
    8: [[ASI_G], [ASI]],
    9: [[SUB]],
    10: [[ASI_G], [ASI]],
    11: [[g('Golpe astuto mejorado', 'Improved Cunning Strike', 'Puedes aplicar dos efectos de Golpe astuto.', 'You can apply two Cunning Strike effects.')]],
    12: [[ASI_G], [ASI]],
    13: [[SUB]],
    14: [[g('Golpes taimados', 'Devious Strikes', 'Nuevos efectos de Golpe astuto: aturdir, dejar inconsciente u ofuscar.', 'New Cunning Strike effects: daze, knock out or obscure.')]],
    15: [[g('Mente escurridiza', 'Slippery Mind', 'Competencia en salvaciones de SAB y CAR.', 'Proficiency in WIS and CHA saves.')]],
    16: [[ASI_G], [ASI]],
    17: [[SUB]],
    18: [[g('Escurridizo', 'Elusive', 'Los ataques contra ti no pueden tener ventaja.', 'Attacks against you can’t have Advantage.')]],
    19: [[BOON_G], [BOON]],
    20: [[g('Golpe de suerte', 'Stroke of Luck', 'Una vez por descanso conviertes un fallo de d20 en un 20.', 'Once per rest, turn a failed D20 Test into a 20.')]],
  }),
  hechicero: build({
    2: [[g('Fuente de magia', 'Font of Magic', 'Puntos de hechicería que cambias por espacios de conjuro y viceversa.', 'Sorcery Points you can convert into spell slots and back.'), g('Metamagia', 'Metamagic', 'Eliges 2 opciones de metamagia para modificar tus conjuros.', 'Choose 2 Metamagic options to modify your spells.')], [{ kind: 'metamagic', count: 2 }]],
    3: [[SUBCLASS_G], [SUBCLASS]],
    4: [[ASI_G], [ASI]],
    5: [[g('Restablecimiento hechicero', 'Sorcerous Restoration', 'Tras un descanso corto recuperas puntos de hechicería (la mitad de tu nivel).', 'After a Short Rest, regain Sorcery Points (half your level).')]],
    6: [[SUB]],
    7: [[g('Hechicería encarnada', 'Sorcery Incarnate', 'Activas Hechicería innata con puntos y aplicas dos metamagias a un conjuro.', 'Activate Innate Sorcery with points and apply two Metamagics to one spell.')]],
    8: [[ASI_G], [ASI]],
    10: [[g('Metamagia', 'Metamagic', 'Dos opciones de metamagia más.', 'Two more Metamagic options.')], [{ kind: 'metamagic', count: 2 }]],
    12: [[ASI_G], [ASI]],
    14: [[SUB]],
    16: [[ASI_G], [ASI]],
    17: [[g('Metamagia', 'Metamagic', 'Dos opciones de metamagia más.', 'Two more Metamagic options.')], [{ kind: 'metamagic', count: 2 }]],
    18: [[SUB]],
    19: [[BOON_G], [BOON]],
    20: [[g('Apoteosis arcana', 'Arcane Apotheosis', 'Con Hechicería innata activa, una metamagia gratis por turno.', 'While Innate Sorcery is active, one free Metamagic per turn.')]],
  }),
  brujo: build({
    2: [[g('Astucia mágica', 'Magical Cunning', 'Un rito de 1 minuto recupera la mitad de tus espacios de pacto (una vez por descanso largo).', 'A 1-minute rite regains half your Pact slots (once per Long Rest).'), g('Invocaciones sobrenaturales', 'Eldritch Invocations', 'Dos invocaciones más (3 en total).', 'Two more invocations (3 total).')], [{ kind: 'invocation', count: 2 }]],
    3: [[SUBCLASS_G], [SUBCLASS]],
    4: [[ASI_G], [ASI]],
    5: [[g('Invocaciones sobrenaturales', 'Eldritch Invocations', 'Dos invocaciones más (5 en total).', 'Two more invocations (5 total).')], [{ kind: 'invocation', count: 2 }]],
    6: [[SUB]],
    7: [[g('Invocaciones sobrenaturales', 'Eldritch Invocations', 'Una invocación más (6 en total).', 'One more invocation (6 total).')], [{ kind: 'invocation', count: 1 }]],
    8: [[ASI_G], [ASI]],
    9: [[g('Contactar con el patrón', 'Contact Patron', 'Lanzas Contactar con otro plano para hablar con tu patrón sin fallar la salvación.', 'Cast Contact Other Plane to reach your patron, automatically succeeding on the save.'), g('Invocaciones sobrenaturales', 'Eldritch Invocations', 'Una invocación más (7 en total).', 'One more invocation (7 total).')], [{ kind: 'invocation', count: 1 }]],
    10: [[SUB]],
    11: [[g('Arcano místico (nivel 6)', 'Mystic Arcanum (level 6)', 'Un conjuro de nivel 6 que lanzas una vez por descanso largo sin espacio.', 'A level 6 spell you cast once per Long Rest without a slot.')]],
    12: [[ASI_G, g('Invocaciones sobrenaturales', 'Eldritch Invocations', 'Una invocación más (8 en total).', 'One more invocation (8 total).')], [ASI, { kind: 'invocation', count: 1 }]],
    13: [[g('Arcano místico (nivel 7)', 'Mystic Arcanum (level 7)', 'Un conjuro de nivel 7 una vez por descanso largo.', 'A level 7 spell once per Long Rest.')]],
    14: [[SUB]],
    15: [[g('Arcano místico (nivel 8)', 'Mystic Arcanum (level 8)', 'Un conjuro de nivel 8 una vez por descanso largo.', 'A level 8 spell once per Long Rest.'), g('Invocaciones sobrenaturales', 'Eldritch Invocations', 'Una invocación más (9 en total).', 'One more invocation (9 total).')], [{ kind: 'invocation', count: 1 }]],
    16: [[ASI_G], [ASI]],
    17: [[g('Arcano místico (nivel 9)', 'Mystic Arcanum (level 9)', 'Un conjuro de nivel 9 una vez por descanso largo.', 'A level 9 spell once per Long Rest.')]],
    18: [[g('Invocaciones sobrenaturales', 'Eldritch Invocations', 'Una invocación más (10 en total).', 'One more invocation (10 total).')], [{ kind: 'invocation', count: 1 }]],
    19: [[BOON_G], [BOON]],
    20: [[g('Maestro sobrenatural', 'Eldritch Master', 'Astucia mágica recupera todos tus espacios de pacto.', 'Magical Cunning regains all your Pact slots.')]],
  }),
  mago: build({
    2: [[g('Erudito', 'Scholar', 'Pericia en una habilidad de INT (Arcanos, Historia, Investigación, Naturaleza o Religión) en la que seas competente.', 'Expertise in one INT skill (Arcana, History, Investigation, Nature or Religion) you’re proficient in.')], [{ kind: 'expertise', count: 1, intOnly: true }]],
    3: [[SUBCLASS_G], [SUBCLASS]],
    4: [[ASI_G], [ASI]],
    5: [[g('Memorizar conjuro', 'Memorize Spell', 'Tras un descanso corto cambias un conjuro preparado por otro de tu libro.', 'After a Short Rest, swap one prepared spell for another from your spellbook.')]],
    6: [[SUB]],
    8: [[ASI_G], [ASI]],
    10: [[SUB]],
    12: [[ASI_G], [ASI]],
    14: [[SUB]],
    16: [[ASI_G], [ASI]],
    18: [[g('Dominio de conjuros', 'Spell Mastery', 'Un conjuro de nivel 1 y otro de nivel 2 que lanzas sin gastar espacio.', 'A level 1 and a level 2 spell you can cast without expending a slot.')]],
    19: [[BOON_G], [BOON]],
    20: [[g('Conjuros característicos', 'Signature Spells', 'Dos conjuros de nivel 3 siempre preparados que lanzas una vez sin espacio por descanso corto.', 'Two level 3 spells always prepared that you can cast once without a slot per Short Rest.')]],
  }),
};

export const levelEntry = (classId: string, level: number): LevelEntry => PROGRESSION[classId]?.[level] ?? { features: [], choices: [] };

// ---------- Conjuros por clase ----------

/** Cantidad de trucos y de conjuros preparados por nivel (índice = nivel − 1) */
const SPELLCOUNTS: Record<string, { cantrips: number[]; prepared: number[] }> = (() => {
  const c = (a: number, b: number, d: number) => Array.from({ length: 20 }, (_, i) => (i < 3 ? a : i < 9 ? b : d));
  const fullPrep = [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22];
  const halfPrep = [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15];
  return {
    bardo: { cantrips: c(2, 3, 4), prepared: fullPrep },
    clerigo: { cantrips: c(3, 4, 5), prepared: fullPrep },
    druida: { cantrips: c(2, 3, 4), prepared: fullPrep },
    paladin: { cantrips: c(0, 0, 0), prepared: halfPrep },
    explorador: { cantrips: c(0, 0, 0), prepared: halfPrep },
    hechicero: { cantrips: c(4, 5, 6), prepared: [2, 4, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22] },
    brujo: { cantrips: c(2, 3, 4), prepared: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15] },
    mago: { cantrips: c(3, 4, 5), prepared: [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 18, 19, 21, 22, 23, 24, 25] },
  };
})();

export const spellCounts = (classId: string, level: number) => {
  const t = SPELLCOUNTS[classId];
  return t ? { cantrips: t.cantrips[level - 1], prepared: t.prepared[level - 1] } : null;
};

// Letras: B bardo, C clérigo, D druida, P paladín, R explorador, S hechicero, K brujo, W mago
const LISTS: Record<string, string> = {
  'Fire Bolt': 'SW', 'Eldritch Blast': 'K', 'Sacred Flame': 'C', 'Ray of Frost': 'SW', 'Vicious Mockery': 'B', 'Shocking Grasp': 'SW',
  'Chill Touch': 'SKW', 'Acid Splash': 'SW', 'Poison Spray': 'DSKW', 'Mage Hand': 'BSKW', 'Prestidigitation': 'BSKW', 'Light': 'BCSW',
  'Guidance': 'CD', 'Thaumaturgy': 'C', 'Minor Illusion': 'BSKW', 'Message': 'BDSW', 'Mending': 'BCDSW', 'Spare the Dying': 'CD',
  'Druidcraft': 'D', 'Produce Flame': 'D', 'Shillelagh': 'D',
  'Magic Missile': 'SW', 'Shield': 'SW', 'Cure Wounds': 'BCDPR', 'Healing Word': 'BCD', 'Bless': 'CP', 'Bane': 'BCK', 'Guiding Bolt': 'C',
  'Thunderwave': 'BDSW', 'Burning Hands': 'SW', 'Sleep': 'BSW', 'Charm Person': 'BDSKW', 'Detect Magic': 'BCDPRSW', 'Mage Armor': 'SW',
  'Hunter’s Mark': 'R', 'Hex': 'K', 'Shield of Faith': 'CP', 'Faerie Fire': 'BD', 'Entangle': 'DR', 'Command': 'BCP', 'Sanctuary': 'C',
  'Heroism': 'BP', 'Feather Fall': 'BSW', 'Inflict Wounds': 'C',
  'Misty Step': 'SKW', 'Hold Person': 'BCDSKW', 'Invisibility': 'BSKW', 'Spiritual Weapon': 'C', 'Scorching Ray': 'SW', 'Shatter': 'BSKW',
  'Aid': 'BCDPR', 'Lesser Restoration': 'BCDPR', 'Mirror Image': 'BSKW', 'Web': 'SW', 'Darkness': 'SKW', 'Silence': 'BCR',
  'Pass without Trace': 'DR', 'Moonbeam': 'D', 'Barkskin': 'DR', 'Suggestion': 'BSKW',
  'Fireball': 'SW', 'Counterspell': 'SKW', 'Haste': 'SW', 'Fly': 'SKW', 'Revivify': 'CDPR', 'Spirit Guardians': 'C', 'Lightning Bolt': 'SW',
  'Dispel Magic': 'BCDPSKW', 'Hypnotic Pattern': 'BSKW', 'Polymorph': 'BDSW', 'Greater Invisibility': 'BSW', 'Dimension Door': 'BSKW',
  'Banishment': 'CPSKW', 'Cone of Cold': 'DSW', 'Hold Monster': 'BSKW',
  'Divine Smite': 'P', 'Find Familiar': 'W', 'Speak with Animals': 'BDR', 'Find Steed': 'P',
};
const LETTER: Record<string, string> = { bardo: 'B', clerigo: 'C', druida: 'D', paladin: 'P', explorador: 'R', hechicero: 'S', brujo: 'K', mago: 'W' };

/** ¿Está este conjuro (por su nombre en inglés) en la lista de la clase? */
export const inClassList = (spellEn: string, classId: string) => !!LETTER[classId] && (LISTS[spellEn] ?? '').includes(LETTER[classId]);

// ---------- Recarga de rasgos y conjuros que se obtienen sí o sí ----------

/** Cómo se recuperan los rasgos con usos limitados (por su nombre en inglés) */
const RECHARGE_EN: Record<string, Recharge> = {
  'Rage': 'long', 'Relentless Rage': 'short', 'Bardic Inspiration': 'long', 'Font of Inspiration': 'short', 'Channel Divinity': 'short',
  'Divine Intervention': 'long', 'Greater Divine Intervention': 'long', 'Wild Shape': 'short', 'Wild Companion': 'slot', 'Wild Resurgence': 'long',
  'Second Wind': 'short', 'Action Surge': 'short', 'Action Surge (two uses)': 'short', 'Indomitable': 'long', 'Monk’s Focus': 'short',
  'Uncanny Metabolism': 'long', 'Stunning Strike': 'short', 'Lay On Hands': 'long', 'Paladin’s Smite': 'long', 'Faithful Steed': 'long',
  'Abjure Foes': 'short', 'Favored Enemy': 'long', 'Tireless': 'long', 'Nature’s Veil': 'long', 'Stroke of Luck': 'short',
  'Innate Sorcery': 'long', 'Font of Magic': 'long', 'Sorcerous Restoration': 'long', 'Metamagic': 'long', 'Magical Cunning': 'long',
  'Contact Patron': 'long', 'Mystic Arcanum (level 6)': 'long', 'Mystic Arcanum (level 7)': 'long', 'Mystic Arcanum (level 8)': 'long',
  'Mystic Arcanum (level 9)': 'long', 'Arcane Recovery': 'long', 'Spell Mastery': 'atwill', 'Signature Spells': 'short',
  'Pact Magic': 'short', 'Eldritch Invocations': 'atwill', 'Deflect Attacks': 'atwill',
};

/** Conjuros que un rasgo te da siempre preparados (nombres en inglés) */
export const GAIN_SPELLS: Record<string, string[]> = {
  'Paladin’s Smite': ['Divine Smite'],
  'Faithful Steed': ['Find Steed'],
  'Pact of the Chain': ['Find Familiar'],
};

const norm = (n: string) => n.trim().toLowerCase().replace(/[’']/g, "'");
let rechargeIndex: Map<string, Recharge> | null = null;
/** Recarga de un rasgo por su nombre en español o inglés */
export function rechargeOf(name: string): Recharge | undefined {
  if (!rechargeIndex) {
    rechargeIndex = new Map();
    const add = (t: Tr) => { const rc = RECHARGE_EN[t.en]; if (rc) { rechargeIndex!.set(norm(t.en), rc); rechargeIndex!.set(norm(t.es), rc); } };
    for (const table of Object.values(PROGRESSION)) for (const e of Object.values(table)) e.features.forEach((f) => add(f.name));
    for (const c of CLASSES) c.features(20).forEach((f) => add(f.name));
  }
  return rechargeIndex.get(norm(name));
}

export const RECHARGE_LABEL: Record<Recharge, Tr> = {
  short: r('⛺ Descanso corto', '⛺ Short rest'),
  long: r('🌙 Descanso largo', '🌙 Long rest'),
  slot: r('✨ Espacio de conjuro', '✨ Spell slot'),
  atwill: r('♾️ A voluntad', '♾️ At will'),
};

// ---------- Competencias de cada clase ----------

export const ARMOR_NAMES = {
  light: { es: 'armadura ligera', en: 'Light armor' }, medium: { es: 'armadura intermedia', en: 'Medium armor' },
  heavy: { es: 'armadura pesada', en: 'Heavy armor' }, shields: { es: 'escudos', en: 'Shields' },
};
export interface ClassProf {
  armor: { light: boolean; medium: boolean; heavy: boolean; shields: boolean };
  weapons: Tr;
  martial: 'all' | 'finesse-light' | 'none';
  tools?: { name: Tr; match: RegExp };
  skills: number;
}
const A = (light: boolean, medium: boolean, heavy: boolean, shields: boolean) => ({ light, medium, heavy, shields });
const SIMPLE_MARTIAL: Tr = { es: 'Armas sencillas y marciales', en: 'Simple and Martial weapons' };
const SIMPLE: Tr = { es: 'Armas sencillas', en: 'Simple weapons' };
/** Competencias que da cada clase en las reglas 2024 */
export const CLASS_PROFS: Record<string, ClassProf> = {
  barbaro: { armor: A(true, true, false, true), weapons: SIMPLE_MARTIAL, martial: 'all', skills: 2 },
  bardo: { armor: A(true, false, false, false), weapons: SIMPLE, martial: 'none', tools: { name: { es: 'tres instrumentos musicales', en: 'three musical instruments' }, match: /instrument|laud|lute|flaut|flute|lira|lyre|tambor|drum|gaita|bagpipe|viol|cuerno|horn|dulc|chirim|shawm/ }, skills: 3 },
  clerigo: { armor: A(true, true, false, true), weapons: SIMPLE, martial: 'none', skills: 2 },
  druida: { armor: A(true, false, false, true), weapons: SIMPLE, martial: 'none', tools: { name: { es: 'útiles de herborista', en: 'Herbalism Kit' }, match: /herbor|herbalism/ }, skills: 2 },
  guerrero: { armor: A(true, true, true, true), weapons: SIMPLE_MARTIAL, martial: 'all', skills: 2 },
  monje: { armor: A(false, false, false, false), weapons: { es: 'Armas sencillas y marciales con la propiedad Ligera', en: 'Simple weapons and Martial weapons with the Light property' }, martial: 'finesse-light', skills: 2 },
  paladin: { armor: A(true, true, true, true), weapons: SIMPLE_MARTIAL, martial: 'all', skills: 2 },
  explorador: { armor: A(true, true, false, true), weapons: SIMPLE_MARTIAL, martial: 'all', skills: 3 },
  picaro: { armor: A(true, false, false, false), weapons: { es: 'Armas sencillas y marciales con la propiedad Sutil o Ligera', en: 'Simple weapons and Martial weapons with the Finesse or Light property' }, martial: 'finesse-light', tools: { name: { es: 'herramientas de ladrón', en: 'Thieves’ Tools' }, match: /ladron|thieve/ }, skills: 4 },
  hechicero: { armor: A(false, false, false, false), weapons: SIMPLE, martial: 'none', skills: 2 },
  brujo: { armor: A(true, false, false, false), weapons: SIMPLE, martial: 'none', skills: 2 },
  mago: { armor: A(false, false, false, false), weapons: SIMPLE, martial: 'none', skills: 2 },
};
