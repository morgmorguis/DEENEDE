// Glosario inglés ↔ español de términos de D&D 2024 para traducir los datos de una ficha importada
// (equipo, competencias, idiomas, rasgos, nombres de conjuros y aptitudes…). Funciona sin conexión:
// sustituye términos conocidos y deja intacto el texto libre (historia, apariencia…), que solo se
// puede traducir con Claude.
import type { Lang, Tr } from '../i18n';
import type { Character } from '../types';
import { CLASSES, CONDITIONS, DAMAGE_TYPES, MASTERIES, SIZES, SKILLS, SPECIES } from './srd';
import { SPELLS, findSpell } from './spells';

/** Un término con sus variantes; la primera de cada idioma es la forma canónica */
interface Entry { en: string[]; es: string[] }
const e = (en: string | string[], es: string | string[]): Entry => ({ en: [en].flat(), es: [es].flat() });
const fromTr = (t: Tr): Entry => e(t.en, t.es);

const WEAPONS: Entry[] = [
  e('Club', 'Garrote'), e('Clubs', 'Garrotes'), e('Dagger', 'Daga'), e('Daggers', 'Dagas'), e(['Greatclub', 'Great club'], ['Gran garrote', 'Clava grande']),
  e(['Handaxe', 'Hand axe'], 'Hacha de mano'), e(['Handaxes', 'Hand axes'], 'Hachas de mano'), e('Javelin', 'Jabalina'), e('Javelins', 'Jabalinas'),
  e('Light Hammer', 'Martillo ligero'), e('Light Hammers', 'Martillos ligeros'), e('Mace', 'Maza'), e(['Quarterstaff', 'Staff'], ['Bastón', 'Baston']),
  e('Sickle', 'Hoz'), e('Spear', 'Lanza'), e('Spears', 'Lanzas'), e('Dart', 'Dardo'), e('Darts', 'Dardos'),
  e('Light Crossbow', 'Ballesta ligera'), e(['Shortbow', 'Short bow'], 'Arco corto'), e('Sling', 'Honda'),
  e(['Battleaxe', 'Battle axe'], 'Hacha de batalla'), e('Flail', 'Mayal'), e('Glaive', 'Guja'), e(['Greataxe', 'Great axe'], ['Gran hacha', 'Hacha a dos manos']),
  e(['Greatsword', 'Great sword'], ['Espadón', 'Mandoble']), e('Halberd', 'Alabarda'), e('Lance', 'Lanza de caballería'),
  e(['Longsword', 'Long sword'], 'Espada larga'), e('Maul', 'Mazo'), e(['Morningstar', 'Morning star'], 'Lucero del alba'), e('Pike', 'Pica'),
  e('Rapier', 'Estoque'), e('Scimitar', 'Cimitarra'), e('Scimitars', 'Cimitarras'), e(['Shortsword', 'Short sword'], 'Espada corta'), e(['Shortswords', 'Short swords'], 'Espadas cortas'),
  e('Trident', 'Tridente'), e(['Warhammer', 'War hammer'], 'Martillo de guerra'), e(['War Pick', 'Warpick'], 'Pico de guerra'), e('Whip', 'Látigo'),
  e('Blowgun', 'Cerbatana'), e('Hand Crossbow', 'Ballesta de mano'), e('Heavy Crossbow', 'Ballesta pesada'), e(['Longbow', 'Long bow'], 'Arco largo'),
  e('Musket', 'Mosquete'), e('Pistol', 'Pistola'), e('Unarmed Strike', 'Golpe sin armas'), e('Arrows', 'Flechas'), e('Arrow', 'Flecha'),
  e(['Crossbow Bolts', 'Bolts'], 'Virotes'), e(['Sling Bullets', 'Sling bullet'], 'Balas de honda'), e('Quiver', 'Carcaj'),
];

const ARMOR: Entry[] = [
  e(['Padded Armor', 'Padded'], ['Armadura acolchada', 'Acolchada']), e(['Leather Armor', 'Leather'], ['Armadura de cuero', 'Cuero']),
  e(['Studded Leather Armor', 'Studded Leather'], ['Armadura de cuero tachonado', 'Cuero tachonado']), e(['Hide Armor', 'Hide'], ['Armadura de pieles', 'Pieles']),
  e('Chain Shirt', 'Camisote de mallas'), e('Scale Mail', 'Cota de escamas'), e('Breastplate', 'Coraza'), e(['Half Plate Armor', 'Half Plate'], ['Semiplacas', 'Media armadura']),
  e('Ring Mail', 'Cota de anillas'), e('Chain Mail', 'Cota de mallas'), e(['Splint Armor', 'Splint'], ['Armadura de bandas', 'Bandas']),
  e(['Plate Armor', 'Plate'], ['Armadura de placas', 'Placas']), e('Shield', 'Escudo'), e('Shields', 'Escudos'),
];

const GEAR: Entry[] = [
  e('Backpack', 'Mochila'), e('Bedroll', 'Saco de dormir'), e(['Hempen Rope', 'Rope'], ['Cuerda de cáñamo', 'Cuerda']), e(['Silk Rope'], 'Cuerda de seda'),
  e('Torches', 'Antorchas'), e('Torch', 'Antorcha'), e('Rations', 'Raciones'), e('Ration', 'Ración'), e('Waterskin', 'Odre'), e('Tinderbox', 'Yesquero'),
  e('Mess Kit', 'Utensilios de cocina'), e('Crowbar', 'Palanca'), e('Hammer', 'Martillo'), e('Pitons', 'Pitones'), e('Piton', 'Pitón'),
  e('Hooded Lantern', 'Linterna sorda'), e('Bullseye Lantern', 'Linterna de ojo de buey'), e('Lantern', 'Linterna'), e(['Flask of Oil', 'Oil'], ['Frasco de aceite', 'Aceite']),
  e(['Potion of Healing', 'Healing Potion'], 'Poción de curación'), e(['Potions of Healing', 'Healing Potions'], 'Pociones de curación'),
  e("Explorer's Pack", 'Equipo de explorador'), e("Dungeoneer's Pack", 'Equipo de explorador de mazmorras'), e("Priest's Pack", 'Equipo de sacerdote'),
  e("Scholar's Pack", 'Equipo de erudito'), e("Burglar's Pack", 'Equipo de ladrón'), e("Diplomat's Pack", 'Equipo de diplomático'), e("Entertainer's Pack", 'Equipo de artista'),
  e('Holy Symbol', 'Símbolo sagrado'), e('Arcane Focus', 'Canalizador arcano'), e('Druidic Focus', 'Canalizador druídico'), e('Spellbook', 'Libro de conjuros'),
  e('Component Pouch', 'Bolsa de componentes'), e("Traveler's Clothes", 'Ropa de viaje'), e('Fine Clothes', 'Ropa elegante'), e('Common Clothes', 'Ropa común'),
  e('Costume', 'Disfraz'), e('Pouch', 'Bolsa'), e('Blanket', 'Manta'), e('Candles', 'Velas'), e('Candle', 'Vela'), e('Chalk', 'Tiza'), e('Ink Pen', 'Pluma'),
  e('Ink', 'Tinta'), e('Parchment', 'Pergamino'), e('Paper', 'Papel'), e('Book', 'Libro'), e('Mirror', 'Espejo'), e('Manacles', 'Grilletes'), e('Caltrops', 'Abrojos'),
  e('Ball Bearings', 'Canicas'), e('Grappling Hook', 'Garfio'), e("Climber's Kit", 'Equipo de escalador'), e("Healer's Kit", 'Equipo de sanador'),
  e('Bell', 'Campana'), e('Whistle', 'Silbato'), e('Shovel', 'Pala'), e('Tent', 'Tienda de campaña'), e('Flask', 'Frasco'), e('Vial', 'Vial'), e('Sack', 'Saco'),
  e('Chest', 'Cofre'), e('Lock', 'Cerradura'), e('Signet Ring', 'Anillo de sello'), e('Spyglass', 'Catalejo'), e('Magnifying Glass', 'Lupa'), e('Map', 'Mapa'),
  e('Holy Water', 'Agua bendita'), e("Alchemist's Fire", 'Fuego de alquimista'), e('Antitoxin', 'Antitoxina'), e('Basic Poison', 'Veneno básico'),
  e('Gaming Set', 'Juego'), e('Dice Set', 'Juego de dados'), e('Playing Card Set', 'Baraja de cartas'), e('Musical Instrument', 'Instrumento musical'),
  e('Lute', 'Laúd'), e('Flute', 'Flauta'), e('Drum', 'Tambor'), e('Lyre', 'Lira'), e('Bagpipes', 'Gaita'), e('Viol', 'Viola'), e('Dulcimer', 'Dulcémele'),
  e('Pan Flute', 'Flauta de pan'), e('Shawm', 'Chirimía'),
];

const TOOLS: Entry[] = [
  e("Thieves' Tools", 'Herramientas de ladrón'), e('Herbalism Kit', 'Útiles de herborista'), e('Disguise Kit', 'Útiles para disfrazarse'),
  e('Forgery Kit', 'Útiles de falsificación'), e("Poisoner's Kit", 'Útiles de envenenador'), e("Navigator's Tools", 'Herramientas de navegante'),
  e("Smith's Tools", 'Herramientas de herrero'), e("Carpenter's Tools", 'Herramientas de carpintero'), e("Cook's Utensils", 'Utensilios de cocinero'),
  e("Alchemist's Supplies", 'Suministros de alquimista'), e("Calligrapher's Supplies", 'Suministros de calígrafo'), e("Tinker's Tools", 'Herramientas de hojalatero'),
  e("Mason's Tools", 'Herramientas de albañil'), e("Leatherworker's Tools", 'Herramientas de peletero'), e("Brewer's Supplies", 'Suministros de cervecero'),
  e("Cartographer's Tools", 'Herramientas de cartógrafo'), e("Painter's Supplies", 'Suministros de pintor'), e("Jeweler's Tools", 'Herramientas de joyero'),
  e("Woodcarver's Tools", 'Herramientas de tallador'), e("Weaver's Tools", 'Herramientas de tejedor'), e("Glassblower's Tools", 'Herramientas de soplador de vidrio'),
  e("Potter's Tools", 'Herramientas de alfarero'), e("Cobbler's Tools", 'Herramientas de zapatero'), e(['Vehicles (Land)', 'Land Vehicles'], 'Vehículos (terrestres)'),
  e(['Vehicles (Water)', 'Water Vehicles'], 'Vehículos (acuáticos)'),
];

const PROFICIENCIES: Entry[] = [
  e('Simple Weapons', ['Armas sencillas', 'Armas simples']), e('Martial Weapons', 'Armas marciales'), e('Light Armor', 'Armadura ligera'),
  e('Medium Armor', ['Armadura intermedia', 'Armadura media']), e('Heavy Armor', 'Armadura pesada'), e('All Armor', 'Todas las armaduras'),
  e('Proficiency Bonus', 'Bonificador por competencia'), e('Armor Class', 'Clase de armadura'), e(['Hit Points', 'HP'], ['Puntos de golpe', 'PG']),
  e('Temporary Hit Points', 'Puntos de golpe temporales'), e('Hit Dice', 'Dados de golpe'), e('Hit Die', 'Dado de golpe'), e('Passive Perception', 'Percepción pasiva'),
  e('Spell Save DC', 'CD de salvación de conjuros'), e('Spell Attack', 'Ataque de conjuro'), e('Saving Throws', 'Tiradas de salvación'), e('Saves', 'Salvaciones'),
  e('Saving Throw', 'Tirada de salvación'), e('Save', 'Salvación'), e('Advantage', 'Ventaja'), e('Disadvantage', 'Desventaja'), e('Bonus Action', 'Acción adicional'),
  e('Reaction', 'Reacción'), e('Short Rest', 'Descanso corto'), e('Long Rest', 'Descanso largo'), e('Cantrips', 'Trucos'), e('Cantrip', 'Truco'),
  e('Spell Slots', 'Espacios de conjuro'), e('Spell Slot', 'Espacio de conjuro'), e('Concentration', 'Concentración'), e('Heroic Inspiration', 'Inspiración heroica'),
  e('Expertise', 'Pericia'), e('Proficiency', 'Competencia'), e('Initiative', 'Iniciativa'), e('Speed', 'Velocidad'), e(['feet', 'ft.', 'ft'], 'pies'),
  e('Requires Attunement', 'Requiere sintonización'), e('Attunement', 'Sintonización'), e('Darkvision', 'Visión en la oscuridad'), e('Resistance', 'Resistencia'),
  e('Immunity', 'Inmunidad'), e('Vulnerability', 'Vulnerabilidad'), e('Spellcasting', 'Lanzamiento de conjuros'), e('Ritual', 'Ritual'),
];

const PROPERTIES: Entry[] = [
  e('Finesse', 'Sutil'), e('Versatile', 'Versátil'), e(['Two-Handed', 'Two Handed', '2-Handed', '2Handed'], 'A dos manos'), e('Ammo', 'Munición'), e('Heavy', 'Pesada'), e('Reach', 'Alcance'),
  e('Thrown', 'Arrojadiza'), e('Ammunition', 'Munición'), e('Loading', 'Recarga'), e('Light', 'Ligera'), e('Mastery', 'Maestría'),
];

const LANGUAGES: Entry[] = [
  e(['Common Sign Language', 'Common Sign'], 'Lengua de signos común'), e('Common', 'Común'), e('Draconic', 'Dracónico'), e(['Dwarvish', 'Dwarven'], 'Enano'),
  e(['Elvish', 'Elven'], 'Élfico'), e('Giant', 'Gigante'), e('Gnomish', 'Gnómico'), e('Goblin', 'Goblin'), e('Halfling', 'Mediano'), e(['Orc', 'Orcish'], 'Orco'),
  e('Abyssal', 'Abisal'), e('Celestial', 'Celestial'), e('Deep Speech', 'Habla profunda'), e('Infernal', 'Infernal'), e('Primordial', 'Primordial'),
  e('Sylvan', 'Silvano'), e('Undercommon', 'Infracomún'), e("Thieves' Cant", 'Jerga de ladrones'), e('Druidic', 'Druídico'), e('Goblinoid', 'Goblinoide'),
];

const BACKGROUNDS: Entry[] = [
  e('Acolyte', 'Acólito'), e('Artisan', 'Artesano'), e('Charlatan', 'Charlatán'), e('Criminal', 'Criminal'), e('Entertainer', 'Artista'),
  e('Farmer', 'Granjero'), e('Guard', 'Guardia'), e('Guide', 'Guía'), e('Hermit', 'Ermitaño'), e('Merchant', 'Mercader'), e('Noble', 'Noble'),
  e('Sage', 'Sabio'), e('Sailor', 'Marinero'), e('Scribe', 'Escriba'), e('Soldier', 'Soldado'), e('Wayfarer', ['Viajero', 'Trotamundos']),
  e('Folk Hero', 'Héroe del pueblo'), e('Outlander', 'Forastero'), e('Urchin', 'Golfillo'), e('Guild Artisan', 'Artesano gremial'),
];

const ALIGNMENTS: Entry[] = [
  e(['Lawful Good', 'LG'], ['Legal bueno', 'Legal buena', 'LB']), e(['Neutral Good', 'NG'], ['Neutral bueno', 'Neutral buena', 'NB']),
  e(['Chaotic Good', 'CG'], ['Caótico bueno', 'Caótica buena', 'CB']), e(['Lawful Neutral', 'LN'], ['Legal neutral', 'LN']),
  e(['Neutral', 'True Neutral', 'N'], ['Neutral', 'N']), e(['Chaotic Neutral', 'CN'], ['Caótico neutral', 'Caótica neutral', 'CN']),
  e(['Lawful Evil', 'LE'], ['Legal malvado', 'Legal malvada', 'LM']), e(['Neutral Evil', 'NE'], ['Neutral malvado', 'Neutral malvada', 'NM']),
  e(['Chaotic Evil', 'CE'], ['Caótico malvado', 'Caótica malvada', 'CM']),
];

const SUBSPECIES: Entry[] = [
  e('Wood Elf', 'Elfo de los bosques'), e('High Elf', 'Alto elfo'), e('Drow', 'Drow'), e('Forest Gnome', 'Gnomo de los bosques'), e('Rock Gnome', 'Gnomo de las rocas'),
  e('Hill Dwarf', 'Enano de las colinas'), e('Mountain Dwarf', 'Enano de las montañas'), e(['Half-Elf', 'Half Elf'], 'Semielfo'), e(['Half-Orc', 'Half Orc'], 'Semiorco'),
  e('Stone Giant', 'Gigante de piedra'), e('Hill Giant', 'Gigante de las colinas'), e('Fire Giant', 'Gigante de fuego'), e('Frost Giant', 'Gigante de escarcha'),
  e('Cloud Giant', 'Gigante de las nubes'), e('Storm Giant', 'Gigante de las tormentas'),
];

const FEATS: Entry[] = [
  e('Alert', 'Alerta'), e('Crafter', 'Artífice'), e('Healer', 'Sanador'), e('Lucky', 'Afortunado'), e('Magic Initiate', 'Iniciado en la magia'),
  e('Musician', 'Músico'), e('Savage Attacker', 'Atacante salvaje'), e('Skilled', 'Habilidoso'), e('Tavern Brawler', 'Camorrista'), e('Tough', 'Duro'),
  e('Ability Score Improvement', 'Mejora de característica'), e('Grappler', 'Agarrador'), e('Great Weapon Master', 'Maestro de armas pesadas'),
  e('Sharpshooter', 'Tirador de primera'), e('War Caster', 'Lanzador de guerra'), e('Sentinel', 'Centinela'), e('Polearm Master', 'Maestro de armas de asta'),
  e('Resilient', 'Resiliente'), e('Observant', 'Observador'), e('Speedy', 'Veloz'), e('Mobile', 'Móvil'), e('Dual Wielder', 'Combatiente con dos armas'),
  e('Fighting Style', 'Estilo de combate'), e('Archery', 'Tiro con arco'), e('Defense', 'Defensa'), e('Dueling', 'Duelo'),
  e('Great Weapon Fighting', 'Combate con armas pesadas'), e('Two-Weapon Fighting', 'Combate con dos armas'), e('Protection', 'Protección'),
  e('Interception', 'Intercepción'), e('Blind Fighting', 'Combate a ciegas'), e('Thrown Weapon Fighting', 'Combate con armas arrojadizas'),
  e('Unarmed Fighting', 'Combate sin armas'), e('Inspiring Leader', 'Líder inspirador'), e('Mage Slayer', 'Cazamagos'), e('Elemental Adept', 'Adepto elemental'),
  e('Heavily Armored', 'Acorazado'), e('Moderately Armored', 'Armadura moderada'), e('Lightly Armored', 'Armadura ligera'),
];

const TRAITS: Entry[] = [
  e('Fey Ancestry', 'Ascendencia feérica'), e('Trance', 'Trance'), e('Keen Senses', 'Sentidos agudos'), e('Dwarven Resilience', 'Resistencia enana'),
  e('Dwarven Toughness', 'Dureza enana'), e('Stonecunning', 'Afinidad con la piedra'), e('Breath Weapon', 'Arma de aliento'), e('Damage Resistance', 'Resistencia al daño'),
  e('Draconic Flight', 'Vuelo dracónico'), e('Draconic Ancestry', 'Ascendencia dracónica'), e('Giant Ancestry', 'Ascendencia gigante'), e('Large Form', 'Forma grande'),
  e('Powerful Build', 'Constitución poderosa'), e('Brave', 'Valiente'), e('Halfling Nimbleness', 'Agilidad de mediano'), e('Luck', 'Suerte'),
  e('Naturally Stealthy', 'Sigilo natural'), e('Resourceful', 'Ingenioso'), e('Versatile', 'Versátil'), e('Adrenaline Rush', 'Subidón de adrenalina'),
  e('Relentless Endurance', 'Aguante incansable'), e('Celestial Resistance', 'Resistencia celestial'), e('Healing Hands', 'Manos curativas'),
  e('Light Bearer', 'Portador de luz'), e('Celestial Revelation', 'Revelación celestial'), e('Fiendish Legacy', 'Legado infernal'),
  e('Otherworldly Presence', 'Presencia de otro mundo'), e('Gnomish Cunning', 'Astucia gnoma'), e('Gnomish Lineage', 'Linaje gnomo'), e('Elven Lineage', 'Linaje élfico'),
  e("Cloud's Jaunt", 'Paso de las nubes'), e("Fire's Burn", 'Quemadura del fuego'), e("Frost's Chill", 'Escalofrío de la escarcha'), e("Hill's Tumble", 'Derribo de la colina'),
  e("Stone's Endurance", 'Aguante de la piedra'), e("Storm's Thunder", 'Trueno de la tormenta'),
];

const FEMININE_CLASSES: Record<string, string[]> = {
  barbaro: ['Bárbara'], bardo: ['Barda'], clerigo: ['Clériga'], guerrero: ['Guerrera'], hechicero: ['Hechicera'], brujo: ['Bruja'],
  mago: ['Maga'], monje: ['Monja'], paladin: ['Paladina'], picaro: ['Pícara'], explorador: ['Exploradora'],
};

const uniqueFeatures = (): Entry[] => {
  const seen = new Set<string>();
  const out: Entry[] = [];
  for (const cls of CLASSES) for (const f of cls.features(20)) {
    if (seen.has(f.name.en)) continue;
    seen.add(f.name.en);
    out.push(fromTr(f.name));
  }
  return out;
};

export type GlossaryDomain = 'general' | 'attack' | 'spell' | 'feature' | 'species' | 'size' | 'alignment' | 'language' | 'background' | 'class';

let tables: Record<GlossaryDomain, Entry[]> | null = null;
const getTables = () => {
  if (tables) return tables;
  const classes = CLASSES.map((c) => e(c.name.en, [c.name.es, ...(FEMININE_CLASSES[c.id] ?? [])]));
  const skills = SKILLS.map((s) => fromTr(s.name));
  const conditions = CONDITIONS.map((c) => fromTr(c.name));
  const damage = DAMAGE_TYPES.map((d) => fromTr(d.name)).map((x) => e([`${x.en[0]} damage`], [`daño ${x.es[0].toLowerCase()}`, `daño de ${x.es[0].toLowerCase()}`]));
  const damageWords = DAMAGE_TYPES.map((d) => fromTr(d.name));
  const species = [...SUBSPECIES, ...SPECIES.map(fromTr)];
  const general = [...WEAPONS, ...ARMOR, ...GEAR, ...TOOLS, ...PROFICIENCIES, ...skills, ...conditions, ...damage, ...SUBSPECIES, ...TRAITS, ...FEATS, ...classes];
  tables = {
    general,
    attack: [...general, ...PROPERTIES, ...MASTERIES.map((m) => fromTr(m.name)), ...damageWords],
    spell: [...SPELLS.map((s) => fromTr(s.name)), ...general],
    feature: [...uniqueFeatures(), ...FEATS, ...TRAITS, ...general],
    species: [...species, ...TRAITS],
    size: SIZES.map(fromTr),
    alignment: ALIGNMENTS,
    language: [...LANGUAGES, ...general],
    background: [...BACKGROUNDS, ...general],
    class: classes,
  };
  return tables;
};

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();

/** Expresión que acepta mayúsculas/minúsculas, tildes, apóstrofos tipográficos y espacios o guiones opcionales */
const looseRx = (term: string) => fold(term).split('').map((ch) => {
  if (ch === ' ' || ch === '-') return '[\\s-]*';
  if (ch === "'") return "['’]?";
  const accents: Record<string, string> = { a: 'aáàä', e: 'eéèë', i: 'iíìï', o: 'oóòö', u: 'uúùü', n: 'nñ' };
  if (accents[ch]) return `[${accents[ch]}]`;
  return ch.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}).join('');

const cache = new Map<string, { rx: RegExp; lookup: Map<string, string> }>();

function compiled(domain: GlossaryDomain, to: Lang) {
  const id = `${domain}:${to}`;
  const hit = cache.get(id);
  if (hit) return hit;
  const from: Lang = to === 'es' ? 'en' : 'es';
  const lookup = new Map<string, string>();
  for (const entry of getTables()[domain]) {
    for (const v of entry[from]) {
      const k = fold(v).replace(/[\s-]+/g, '');
      // Abreviaturas de una o dos letras (LG, N…) solo cuentan como valor completo, no dentro de un texto
      if (!lookup.has(k)) lookup.set(k, entry[to][0]);
    }
  }
  const terms = [...new Set(getTables()[domain].flatMap((x) => x[from]).filter((t) => t.length > 2))].sort((a, b) => b.length - a.length);
  const rx = new RegExp(`(?<![\\p{L}\\p{N}])(?:${terms.map(looseRx).join('|')})(?![\\p{L}\\p{N}])`, 'giu');
  const out = { rx, lookup };
  cache.set(id, out);
  return out;
}

const matchCase = (found: string, repl: string) => {
  const letters = found.replace(/[^\p{L}]/gu, '');
  if (letters.length > 1 && letters === letters.toUpperCase()) return repl.toUpperCase();
  if (found[0] === found[0].toLowerCase() && found[0] !== found[0].toUpperCase()) return repl[0].toLowerCase() + repl.slice(1);
  return repl[0].toUpperCase() + repl.slice(1);
};

/** Traduce los términos de D&D conocidos de un texto corto al idioma indicado. El resto del texto se mantiene. */
export function translateTerms(text: string, to: Lang, domain: GlossaryDomain = 'general'): string {
  if (!text || !text.trim()) return text;
  const { rx, lookup } = compiled(domain, to);
  const whole = lookup.get(fold(text).replace(/[\s-]+/g, ''));
  if (whole) return whole;
  return text.replace(rx, (m) => {
    const repl = lookup.get(fold(m).replace(/[\s-]+/g, ''));
    return repl ? matchCase(m, repl) : m;
  });
}

/** Nombre de conjuro en el idioma indicado (si está en la base de conjuros) */
export const spellName = (name: string, to: Lang) => {
  const info = findSpell(name);
  return info ? info.name[to] : translateTerms(name, to, 'spell');
};

/**
 * Traduce los campos de términos de una ficha (no la historia ni los textos largos).
 * Se usa al importar y desde Ajustes para una ficha ya creada.
 */
export function translateCharacter(c: Character, to: Lang): Character {
  const tt = (s: string, d: GlossaryDomain = 'general') => translateTerms(s, to, d);
  const cls = CLASSES.find((x) => x.id === c.classId);
  const knownClassName = cls && (!c.className || fold(c.className) === fold(cls.name.es) || fold(c.className) === fold(cls.name.en)
    || (FEMININE_CLASSES[cls.id] ?? []).some((n) => fold(n) === fold(c.className)));
  return {
    ...c,
    species: tt(c.species, 'species'),
    className: knownClassName ? cls.name[to] : tt(c.className, 'class'),
    background: tt(c.background, 'background'),
    alignment: tt(c.alignment, 'alignment'),
    size: tt(c.size, 'size'),
    languages: tt(c.languages, 'language'),
    weaponProf: tt(c.weaponProf),
    toolProf: tt(c.toolProf),
    feats: tt(c.feats, 'feature'),
    inventory: tt(c.inventory),
    attunement: c.attunement.map((a) => tt(a)),
    attacks: c.attacks.map((a) => ({ ...a, name: tt(a.name, 'attack'), notes: a.notes ? tt(a.notes, 'attack') : a.notes, range: a.range ? tt(a.range) : a.range })),
    spells: c.spells.map((s) => {
      const info = findSpell(s.name);
      return {
        ...s,
        name: info ? info.name[to] : tt(s.name, 'spell'),
        castingTime: s.castingTime ? tt(s.castingTime) : info ? info.time[to] : '',
        range: s.range ? tt(s.range) : info ? info.range[to] : '',
        concentration: s.concentration || !!info?.concentration,
        ritual: s.ritual || !!info?.ritual,
        components: s.components || info?.components,
        material: s.material || !!info?.components.includes('M'),
      };
    }),
    features: c.features.map((f) => ({ ...f, name: tt(f.name, 'feature') })),
  };
}
