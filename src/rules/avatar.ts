// Retrato de cuerpo entero al estilo de las ilustraciones de fantasía de los 70: tinta marrón, colores
// planos con una sombra, cielos por bandas y soles a rayas. Se dibuja en SVG por piezas (cuerpo, cara,
// pelo, barba, ropaje de la clase, arma y fondo) y luego se pasa a imagen con un ligero toque pixel.
import type { Physical } from '../types';
import { T, type Tr } from '../i18n';

export interface AvatarLook {
  v: 2;
  face: number;
  body: number;
  hair: number;
  beard: number;
  /** Clase de la que salen los ropajes y el índice dentro de su lista */
  outfitClass: string;
  outfit: number;
  /** Quitar el tocado del ropaje (casco, capucha, sombrero…) */
  noHat: boolean;
  backdrop: number;
  skin: string;
  hairColor: string;
  eyes: string;
  /** Colores del ropaje: principal, secundario (capa, pantalón) y detalles */
  main: string;
  second: string;
  accent: string;
  ears: 'round' | 'pointy';
  horns: boolean;
  tusks: boolean;
  snout: boolean;
  halo: boolean;
  /** Tamaño de la especie (los pequeños se ven más bajos) */
  height: number;
  /** Toque pixel: 0 ninguno, 1 leve, 2 marcado */
  pixel: number;
}

const r = (es: string, en: string): Tr => ({ es, en });

export const SKINS = ['#f3d6bb', '#e8b98f', '#cf9466', '#a86b45', '#7a4a2e', '#4f3020', '#b9c48a', '#7f9a6a', '#c76a4f', '#9a3f3a', '#8f78b8', '#6f8fb0', '#c9a24a', '#b8b6ae'];
export const HAIR_COLORS = ['#1c1410', '#3d2618', '#6b4022', '#9a6a32', '#d9b45a', '#b04a26', '#ece4d0', '#8a8680', '#2f4f8a', '#3f7a46', '#7a3f8a', '#c9506a'];
export const EYE_COLORS = ['#3d6fa6', '#4f8a3a', '#6b4a2a', '#1e1a18', '#c9a227', '#b03a3a', '#8a4ab0', '#5fb3b3'];
export const CLOTH_COLORS = ['#8e3b2a', '#c8642c', '#d9a53a', '#6b7a2e', '#3f5f3a', '#2f5d6b', '#2e3f6e', '#5b3a6e', '#7a2f4f', '#6b4a2e', '#3b2a22', '#d8c9a6', '#e9e1cf', '#5a5a58'];

// ---------------------------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------------------------
interface Face { name: Tr; jaw: 'oval' | 'square' | 'round' | 'narrow' | 'heart'; eyes: 'almond' | 'round' | 'narrow' | 'heavy'; brow: 'thin' | 'thick' | 'angry' | 'arched'; nose: 'small' | 'long' | 'broad' | 'hooked'; mouth: 'neutral' | 'smile' | 'stern' | 'grin' | 'full'; lines: 'none' | 'cheek' | 'wrinkles' | 'scar' | 'freckles' | 'paint' }
export const FACES: Face[] = [
  { name: r('Noble', 'Noble'), jaw: 'oval', eyes: 'almond', brow: 'arched', nose: 'long', mouth: 'neutral', lines: 'none' },
  { name: r('Curtido', 'Weathered'), jaw: 'square', eyes: 'narrow', brow: 'thick', nose: 'broad', mouth: 'stern', lines: 'cheek' },
  { name: r('Joven', 'Youthful'), jaw: 'round', eyes: 'round', brow: 'thin', nose: 'small', mouth: 'smile', lines: 'freckles' },
  { name: r('Severo', 'Stern'), jaw: 'square', eyes: 'heavy', brow: 'angry', nose: 'hooked', mouth: 'stern', lines: 'none' },
  { name: r('Anciano sabio', 'Wise elder'), jaw: 'narrow', eyes: 'heavy', brow: 'thick', nose: 'long', mouth: 'neutral', lines: 'wrinkles' },
  { name: r('Pícaro', 'Roguish'), jaw: 'heart', eyes: 'narrow', brow: 'arched', nose: 'small', mouth: 'grin', lines: 'none' },
  { name: r('Feroz', 'Fierce'), jaw: 'square', eyes: 'almond', brow: 'angry', nose: 'broad', mouth: 'grin', lines: 'paint' },
  { name: r('Sereno', 'Serene'), jaw: 'oval', eyes: 'heavy', brow: 'thin', nose: 'small', mouth: 'full', lines: 'none' },
  { name: r('Marcado', 'Scarred'), jaw: 'square', eyes: 'almond', brow: 'thick', nose: 'hooked', mouth: 'stern', lines: 'scar' },
  { name: r('Bonachón', 'Good-natured'), jaw: 'round', eyes: 'round', brow: 'thick', nose: 'broad', mouth: 'smile', lines: 'cheek' },
];

interface Body { name: Tr; sw: number; ww: number; hw: number; arm: number; leg: number; h: number }
export const BODIES: Body[] = [
  { name: r('Esbelto', 'Slender'), sw: 24, ww: 15, hw: 19, arm: 7, leg: 9, h: 1 },
  { name: r('Atlético', 'Athletic'), sw: 29, ww: 17, hw: 20, arm: 8.5, leg: 11, h: 1 },
  { name: r('Musculoso', 'Muscular'), sw: 35, ww: 20, hw: 22, arm: 11, leg: 13, h: 1 },
  { name: r('Corpulento', 'Heavyset'), sw: 33, ww: 29, hw: 29, arm: 10.5, leg: 13.5, h: 0.97 },
  { name: r('Fornido y bajo', 'Short and stocky'), sw: 32, ww: 24, hw: 25, arm: 10, leg: 12.5, h: 0.88 },
  { name: r('Alto y enjuto', 'Tall and lean'), sw: 25, ww: 14, hw: 17, arm: 7, leg: 9, h: 1.05 },
  { name: r('Ancho de hombros', 'Broad-shouldered'), sw: 38, ww: 19, hw: 21, arm: 11.5, leg: 12.5, h: 1.02 },
  { name: r('Menudo', 'Petite'), sw: 21, ww: 14, hw: 18, arm: 6.5, leg: 8.5, h: 0.92 },
  { name: r('Curvilíneo', 'Curvy'), sw: 24, ww: 16, hw: 27, arm: 7.5, leg: 10.5, h: 0.98 },
  { name: r('Gigante', 'Hulking'), sw: 40, ww: 26, hw: 27, arm: 13, leg: 15, h: 1.06 },
];

export const HAIRS: Tr[] = [
  r('Calvo', 'Bald'), r('Corto', 'Short'), r('Largo y liso', 'Long and straight'), r('Melena ondulada', 'Wavy shag'), r('Coleta', 'Ponytail'),
  r('Trenzas', 'Braids'), r('Cresta', 'Mohawk'), r('Moño alto', 'Topknot'), r('Rizos', 'Curls'), r('Largo con cinta', 'Long with headband'),
];
export const BEARDS: Tr[] = [r('Sin barba', 'None'), r('De tres días', 'Stubble'), r('Bigote', 'Moustache'), r('Corta', 'Short'), r('Poblada', 'Full'), r('Larga', 'Long')];

type Base = 'robe' | 'tunic' | 'leather' | 'chain' | 'plate' | 'bare' | 'gi' | 'gown' | 'vestments' | 'rags';
type Extra = 'cape' | 'fur' | 'pauldrons' | 'pauldron' | 'tabard' | 'sash' | 'quiver' | 'straps' | 'bracers' | 'amulet' | 'hoodDown' | 'mantle' | 'bones' | 'skirt' | 'satchel' | 'scarf';
type Prop = 'sword' | 'greatsword' | 'axe' | 'greataxe' | 'bow' | 'staff' | 'lute' | 'mace' | 'shield' | 'daggers' | 'spear' | 'tome' | 'orb' | 'wand' | 'scythe' | 'flute' | 'rapier' | 'sickle' | 'fists' | 'lantern' | 'crossbow' | 'torch' | 'none';
type Hat = 'none' | 'hood' | 'wizard' | 'helm' | 'horned' | 'circlet' | 'crown' | 'headband' | 'cap' | 'mask';
export interface OutfitDef { name: Tr; base: Base; extras: Extra[]; props: Prop[]; hat: Hat }
const o = (es: string, en: string, base: Base, extras: Extra[], props: Prop[], hat: Hat = 'none'): OutfitDef => ({ name: r(es, en), base, extras, props, hat });

/** Diez ropajes por clase */
export const OUTFITS: Record<string, OutfitDef[]> = {
  barbaro: [
    o('Pieles del norte', 'Northern furs', 'bare', ['fur', 'skirt', 'bracers'], ['greataxe']),
    o('Correas y taparrabos', 'Straps and loincloth', 'bare', ['straps', 'skirt', 'bracers'], ['greatsword']),
    o('Jefe de clan', 'Clan chief', 'leather', ['fur', 'cape'], ['axe', 'shield'], 'horned'),
    o('Jinete de la estepa', 'Steppe rider', 'tunic', ['sash', 'bracers'], ['sword']),
    o('Berserker', 'Berserker', 'bare', ['skirt', 'bones'], ['axe']),
    o('Cazador de la tundra', 'Tundra hunter', 'leather', ['fur'], ['spear'], 'hood'),
    o('Gladiador', 'Gladiator', 'bare', ['pauldron', 'skirt', 'straps'], ['sword', 'shield'], 'helm'),
    o('Guerrero de la jungla', 'Jungle warrior', 'bare', ['skirt', 'bones', 'bracers'], ['spear']),
    o('Montañés', 'Highlander', 'tunic', ['fur', 'cape', 'skirt'], ['greatsword']),
    o('Señor de la guerra', 'Warlord', 'chain', ['fur', 'cape'], ['greataxe'], 'horned'),
  ],
  bardo: [
    o('Trovador', 'Troubadour', 'tunic', ['cape', 'sash'], ['lute'], 'cap'),
    o('Juglar de la corte', 'Court minstrel', 'gown', ['mantle'], ['lute'], 'circlet'),
    o('Poeta errante', 'Wandering poet', 'tunic', ['scarf', 'satchel'], ['flute']),
    o('Espadachín galante', 'Dashing swordsman', 'leather', ['cape', 'sash'], ['rapier'], 'cap'),
    o('Narrador de taberna', 'Tavern storyteller', 'tunic', ['satchel'], ['tome']),
    o('Bardo de los bosques', 'Woodland bard', 'leather', ['hoodDown'], ['flute']),
    o('Diva de la ópera', 'Opera diva', 'gown', ['amulet', 'mantle'], ['none'], 'crown'),
    o('Skald', 'Skald', 'chain', ['fur'], ['lute'], 'helm'),
    o('Saltimbanqui', 'Jester', 'tunic', ['scarf'], ['daggers'], 'cap'),
    o('Maestro del saber', 'Lore master', 'robe', ['amulet'], ['tome', 'lute']),
  ],
  clerigo: [
    o('Sacerdote del sol', 'Sun priest', 'vestments', ['amulet', 'mantle'], ['mace', 'shield']),
    o('Clérigo de guerra', 'War cleric', 'plate', ['tabard', 'cape'], ['mace', 'shield'], 'helm'),
    o('Monje de la orden', 'Order monk', 'robe', ['amulet', 'hoodDown'], ['staff']),
    o('Sanador', 'Healer', 'robe', ['satchel', 'amulet'], ['lantern']),
    o('Inquisidor', 'Inquisitor', 'chain', ['tabard', 'cape'], ['mace'], 'hood'),
    o('Profeta del desierto', 'Desert prophet', 'robe', ['scarf'], ['staff']),
    o('Alto sacerdote', 'High priest', 'vestments', ['mantle', 'amulet'], ['staff', 'tome'], 'crown'),
    o('Clérigo de la muerte', 'Death cleric', 'robe', ['amulet'], ['scythe'], 'hood'),
    o('Guardián del templo', 'Temple guardian', 'chain', ['tabard', 'pauldrons'], ['spear', 'shield']),
    o('Peregrino', 'Pilgrim', 'rags', ['satchel', 'amulet'], ['staff'], 'hood'),
  ],
  druida: [
    o('Guardián del bosque', 'Forest warden', 'robe', ['mantle', 'bones'], ['staff']),
    o('Pastor de bestias', 'Beast herder', 'leather', ['fur'], ['staff']),
    o('Druida del círculo', 'Circle druid', 'robe', ['hoodDown', 'amulet'], ['sickle'], 'circlet'),
    o('Chamán de la tormenta', 'Storm shaman', 'bare', ['fur', 'skirt', 'bones'], ['staff']),
    o('Herbolario', 'Herbalist', 'tunic', ['satchel', 'sash'], ['sickle']),
    o('Hijo de la luna', 'Moon child', 'gown', ['mantle'], ['orb'], 'circlet'),
    o('Ermitaño del pantano', 'Swamp hermit', 'rags', ['bones'], ['staff'], 'hood'),
    o('Guardián de las piedras', 'Stone keeper', 'robe', ['fur', 'amulet'], ['staff'], 'horned'),
    o('Vagabundo de las dunas', 'Dune wanderer', 'robe', ['scarf'], ['spear']),
    o('Señor de la cosecha', 'Harvest lord', 'tunic', ['mantle', 'sash'], ['scythe'], 'crown'),
  ],
  guerrero: [
    o('Caballero', 'Knight', 'plate', ['tabard', 'cape'], ['sword', 'shield'], 'helm'),
    o('Mercenario', 'Mercenary', 'chain', ['pauldron', 'straps'], ['greatsword']),
    o('Soldado de la guardia', 'Guard soldier', 'chain', ['tabard'], ['spear', 'shield'], 'helm'),
    o('Duelista', 'Duelist', 'leather', ['cape', 'sash'], ['rapier']),
    o('Campeón de la arena', 'Arena champion', 'bare', ['pauldrons', 'skirt', 'bracers'], ['sword', 'shield']),
    o('Arquero', 'Archer', 'leather', ['quiver', 'hoodDown'], ['bow']),
    o('Señor de la frontera', 'Marcher lord', 'chain', ['fur', 'cape'], ['axe', 'shield'], 'helm'),
    o('Vikingo', 'Viking', 'chain', ['fur'], ['axe', 'shield'], 'horned'),
    o('Ballestero', 'Crossbowman', 'leather', ['tabard'], ['crossbow'], 'cap'),
    o('Paladín negro', 'Dark knight', 'plate', ['cape', 'pauldrons'], ['greatsword'], 'horned'),
  ],
  monje: [
    o('Monje del templo', 'Temple monk', 'gi', ['sash'], ['fists']),
    o('Maestro del bastón', 'Staff master', 'gi', ['sash', 'bracers'], ['staff']),
    o('Monje errante', 'Wandering monk', 'robe', ['satchel'], ['staff'], 'hood'),
    o('Puño de hierro', 'Iron fist', 'bare', ['sash', 'bracers'], ['fists']),
    o('Sombra silenciosa', 'Silent shadow', 'gi', ['scarf', 'straps'], ['daggers'], 'mask'),
    o('Asceta', 'Ascetic', 'rags', ['amulet', 'sash'], ['fists']),
    o('Danzarín del viento', 'Wind dancer', 'gi', ['scarf'], ['spear'], 'headband'),
    o('Abad', 'Abbot', 'robe', ['amulet', 'mantle'], ['staff']),
    o('Luchador de la montaña', 'Mountain fighter', 'bare', ['fur', 'sash'], ['fists'], 'headband'),
    o('Monje de la luna', 'Moon monk', 'gi', ['mantle', 'amulet'], ['sickle'], 'circlet'),
  ],
  paladin: [
    o('Paladín de la luz', 'Paladin of light', 'plate', ['tabard', 'cape'], ['sword', 'shield'], 'helm'),
    o('Cruzado', 'Crusader', 'chain', ['tabard', 'cape'], ['greatsword'], 'helm'),
    o('Guardián del juramento', 'Oath warden', 'plate', ['pauldrons', 'cape'], ['mace', 'shield']),
    o('Caballero del alba', 'Dawn knight', 'plate', ['tabard', 'mantle'], ['spear', 'shield'], 'circlet'),
    o('Vengador', 'Avenger', 'chain', ['cape', 'straps'], ['greatsword'], 'hood'),
    o('Paladín de la corona', 'Crown paladin', 'plate', ['tabard', 'cape', 'amulet'], ['sword', 'shield'], 'crown'),
    o('Templario', 'Templar', 'chain', ['tabard'], ['sword', 'shield']),
    o('Guardián antiguo', 'Ancient guardian', 'leather', ['fur', 'cape'], ['axe', 'shield'], 'horned'),
    o('Penitente', 'Penitent', 'rags', ['amulet', 'straps'], ['mace'], 'hood'),
    o('Caballero de la gloria', 'Glory knight', 'plate', ['pauldrons', 'cape', 'tabard'], ['greatsword'], 'crown'),
  ],
  explorador: [
    o('Montaraz', 'Ranger', 'leather', ['cape', 'quiver'], ['bow'], 'hood'),
    o('Cazador', 'Hunter', 'leather', ['fur', 'quiver'], ['spear']),
    o('Batidor', 'Scout', 'tunic', ['quiver', 'scarf'], ['bow']),
    o('Guardabosques', 'Forester', 'leather', ['quiver', 'hoodDown'], ['bow']),
    o('Rastreador del norte', 'Northern tracker', 'leather', ['fur', 'cape'], ['axe'], 'hood'),
    o('Explorador de la jungla', 'Jungle explorer', 'tunic', ['satchel', 'straps'], ['sword']),
    o('Señor de las bestias', 'Beast master', 'leather', ['fur', 'bones'], ['spear']),
    o('Arquero élfico', 'Elven archer', 'gown', ['quiver', 'mantle'], ['bow'], 'circlet'),
    o('Cazador de monstruos', 'Monster hunter', 'leather', ['straps', 'cape'], ['crossbow'], 'cap'),
    o('Vigía de la frontera', 'Border warden', 'chain', ['cape', 'quiver'], ['sword', 'bow']),
  ],
  picaro: [
    o('Ladrón', 'Thief', 'leather', ['cape', 'straps'], ['daggers'], 'hood'),
    o('Asesino', 'Assassin', 'leather', ['sash', 'scarf'], ['daggers'], 'mask'),
    o('Bandido', 'Bandit', 'tunic', ['straps', 'scarf'], ['sword']),
    o('Pirata', 'Pirate', 'tunic', ['sash'], ['rapier'], 'headband'),
    o('Espía de la corte', 'Court spy', 'gown', ['mantle'], ['daggers'], 'circlet'),
    o('Ratero callejero', 'Street urchin', 'rags', ['satchel'], ['daggers'], 'cap'),
    o('Embaucador', 'Swindler', 'tunic', ['cape', 'amulet'], ['rapier'], 'cap'),
    o('Ladrón de tumbas', 'Tomb robber', 'leather', ['satchel', 'straps'], ['torch']),
    o('Contrabandista', 'Smuggler', 'leather', ['sash', 'satchel'], ['crossbow']),
    o('Señor del gremio', 'Guildmaster', 'leather', ['cape', 'amulet'], ['rapier'], 'hood'),
  ],
  hechicero: [
    o('Hechicero de fuego', 'Fire sorcerer', 'robe', ['mantle', 'sash'], ['orb']),
    o('Linaje dracónico', 'Draconic bloodline', 'gown', ['pauldron', 'amulet'], ['orb'], 'circlet'),
    o('Tormenta salvaje', 'Wild storm', 'tunic', ['scarf', 'bracers'], ['wand']),
    o('Hechicero del desierto', 'Desert sorcerer', 'robe', ['scarf'], ['staff']),
    o('Alma de cristal', 'Crystal soul', 'gown', ['mantle'], ['orb'], 'crown'),
    o('Brujo de la sombra', 'Shadow sorcerer', 'robe', ['cape'], ['wand'], 'hood'),
    o('Noble arcano', 'Arcane noble', 'gown', ['cape', 'amulet'], ['wand'], 'circlet'),
    o('Vagabundo mágico', 'Arcane vagabond', 'rags', ['scarf', 'satchel'], ['orb']),
    o('Hechicero guerrero', 'Battle sorcerer', 'leather', ['pauldron', 'cape'], ['sword', 'orb']),
    o('Hijo del caos', 'Child of chaos', 'tunic', ['mantle', 'bones'], ['wand'], 'horned'),
  ],
  brujo: [
    o('Pacto infernal', 'Fiend pact', 'robe', ['cape', 'amulet'], ['orb'], 'horned'),
    o('Brujo del bosque', 'Fey warlock', 'gown', ['mantle'], ['wand'], 'circlet'),
    o('Ocultista', 'Occultist', 'robe', ['amulet'], ['tome'], 'hood'),
    o('Espadachín del pacto', 'Pact blade', 'leather', ['cape', 'straps'], ['sword']),
    o('Profeta del abismo', 'Abyss prophet', 'rags', ['bones', 'amulet'], ['staff'], 'hood'),
    o('Cortesano oscuro', 'Dark courtier', 'gown', ['cape', 'amulet'], ['rapier']),
    o('Cazador de brujas renegado', 'Renegade witch hunter', 'leather', ['cape', 'sash'], ['crossbow'], 'cap'),
    o('Siervo del gran antiguo', 'Great Old One servant', 'robe', ['mantle'], ['orb'], 'mask'),
    o('Brujo de la tormenta', 'Storm warlock', 'tunic', ['scarf', 'bracers'], ['staff']),
    o('Señor de los pactos', 'Pact lord', 'plate', ['cape'], ['scythe'], 'crown'),
  ],
  mago: [
    o('Mago de la torre', 'Tower wizard', 'robe', ['sash'], ['staff'], 'wizard'),
    o('Archimago', 'Archmage', 'robe', ['mantle', 'amulet'], ['staff', 'orb'], 'wizard'),
    o('Erudito', 'Scholar', 'robe', ['satchel'], ['tome'], 'cap'),
    o('Nigromante', 'Necromancer', 'robe', ['bones', 'cape'], ['scythe'], 'hood'),
    o('Ilusionista', 'Illusionist', 'gown', ['mantle'], ['wand'], 'circlet'),
    o('Mago de batalla', 'Battle mage', 'chain', ['cape', 'pauldron'], ['sword', 'wand']),
    o('Encantador', 'Enchanter', 'gown', ['amulet'], ['orb'], 'crown'),
    o('Aprendiz', 'Apprentice', 'tunic', ['satchel', 'sash'], ['wand']),
    o('Mago errante', 'Wandering wizard', 'robe', ['cape', 'scarf'], ['staff'], 'wizard'),
    o('Alquimista', 'Alchemist', 'tunic', ['satchel', 'straps'], ['lantern'], 'cap'),
  ],
};
export const outfitsFor = (classId: string) => OUTFITS[classId] ?? OUTFITS.guerrero;
export const CLASS_IDS = Object.keys(OUTFITS);

export const BACKDROPS: Tr[] = [
  r('Atardecer', 'Sunset'), r('Castillo', 'Castle'), r('Bosque', 'Forest'), r('Lunas gemelas', 'Twin moons'),
  r('Mar', 'Sea'), r('Mazmorra', 'Dungeon'), r('Desierto', 'Desert'), r('Cosmos', 'Cosmos'),
];

// ---------------------------------------------------------------------------------------------
// Utilidades de dibujo
// ---------------------------------------------------------------------------------------------
const INK = '#2a170e';
const CX = 100;
const SH = 95; // hombros
const WAIST = 145;
const HIP = 166;
const KNEE = 222;
const ANKLE = 274;
const FOOT = 284;

/** Oscurece o aclara un color hex */
export function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)));
  return `#${((ch(n >> 16) << 16) | (ch((n >> 8) & 255) << 8) | ch(n & 255)).toString(16).padStart(6, '0')}`;
}
const P = (d: string, fill: string, w = 1.8, extra = '') => `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round" ${extra}/>`;
const L = (d: string, w = 1.4, col = INK, extra = '') => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const limb = (d: string, w: number, col: string) => `${L(d, w + 3.6)}${L(d, w, col)}`;
const circ = (x: number, y: number, rr: number, fill: string, w = 1.6) => `<circle cx="${x}" cy="${y}" r="${rr}" fill="${fill}" stroke="${INK}" stroke-width="${w}"/>`;
let clipN = 0;
/** Sombra en la mitad derecha de una forma (luz desde la izquierda) */
const shadowR = (d: string, from = CX + 2, op = 0.2) => {
  const id = `c${clipN++}`;
  return `<clipPath id="${id}"><path d="${d}"/></clipPath><rect x="${from}" y="0" width="200" height="330" fill="#1a0c06" opacity="${op}" clip-path="url(#${id})"/>`;
};
const lerp = (a: [number, number], b: [number, number], t: number): [number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

interface Geo {
  b: Body;
  sh: [[number, number], [number, number]]; // hombro izq, der
  el: [[number, number], [number, number]];
  hand: [[number, number], [number, number]];
  hipP: [[number, number], [number, number]];
  knee: [[number, number], [number, number]];
  ankle: [[number, number], [number, number]];
  torso: string;
}
function geo(b: Body): Geo {
  const side = (s: number) => ({
    sh: [CX + s * (b.sw - b.arm * 0.55), SH + 3] as [number, number],
    el: [CX + s * (b.sw + 2.5), 133] as [number, number],
    hand: [CX + s * (b.sw + 5), 171] as [number, number],
    hipP: [CX + s * b.hw * 0.48, HIP - 6] as [number, number],
    knee: [CX + s * b.hw * 0.5, KNEE] as [number, number],
    ankle: [CX + s * (b.hw * 0.5 + 1), ANKLE] as [number, number],
  });
  const lft = side(-1); const rgt = side(1);
  const torso = `M${CX - b.sw},${SH + 5} Q${CX - b.sw},${SH - 3} ${CX - b.sw + 9},${SH - 4} L${CX + b.sw - 9},${SH - 4} Q${CX + b.sw},${SH - 3} ${CX + b.sw},${SH + 5} Q${CX + b.ww + 2},${WAIST - 18} ${CX + b.ww},${WAIST} L${CX + b.hw},${HIP} L${CX - b.hw},${HIP} L${CX - b.ww},${WAIST} Q${CX - b.ww - 2},${WAIST - 18} ${CX - b.sw},${SH + 5} Z`;
  return { b, sh: [lft.sh, rgt.sh], el: [lft.el, rgt.el], hand: [lft.hand, rgt.hand], hipP: [lft.hipP, rgt.hipP], knee: [lft.knee, rgt.knee], ankle: [lft.ankle, rgt.ankle], torso };
}
const armPath = (g: Geo, i: 0 | 1, t = 1) => {
  // t: 0..1 a lo largo del brazo (0.5 = codo)
  const a = g.sh[i]; const e = g.el[i]; const h = g.hand[i];
  if (t <= 0.5) { const p = lerp(a, e, t * 2); return `M${a[0]},${a[1]} L${p[0]},${p[1]}`; }
  const p = lerp(e, h, (t - 0.5) * 2);
  return `M${a[0]},${a[1]} L${e[0]},${e[1]} L${p[0]},${p[1]}`;
};
const legPath = (g: Geo, i: 0 | 1, from = 0, to = 1) => {
  const pts = [g.hipP[i], g.knee[i], g.ankle[i]];
  const at = (t: number) => (t <= 0.5 ? lerp(pts[0], pts[1], t * 2) : lerp(pts[1], pts[2], (t - 0.5) * 2));
  const a = at(from); const z = at(to);
  return from < 0.5 && to > 0.5 ? `M${a[0]},${a[1]} L${pts[1][0]},${pts[1][1]} L${z[0]},${z[1]}` : `M${a[0]},${a[1]} L${z[0]},${z[1]}`;
};

// ---------------------------------------------------------------------------------------------
// Fondos (estilo 70: bandas de color, soles a rayas, siluetas)
// ---------------------------------------------------------------------------------------------
function bands(colors: string[], y0 = 0, y1 = 300) {
  const h = (y1 - y0) / colors.length;
  return colors.map((c, i) => `<rect x="0" y="${(y0 + i * h).toFixed(1)}" width="200" height="${(h + 0.6).toFixed(1)}" fill="${c}"/>`).join('');
}
/** Sol a rayas, el clásico de los 70 */
function stripedSun(x: number, y: number, rr: number, col: string, gap: string[]) {
  const id = `s${clipN++}`;
  let s = `<clipPath id="${id}"><circle cx="${x}" cy="${y}" r="${rr}"/></clipPath><circle cx="${x}" cy="${y}" r="${rr}" fill="${col}"/>`;
  gap.forEach((g, i) => { const yy = y + rr * 0.15 + i * rr * 0.2; s += `<rect x="${x - rr}" y="${yy}" width="${rr * 2}" height="${1.5 + i * 1.3}" fill="${g}" clip-path="url(#${id})"/>`; });
  return s;
}
function mountains(y: number, amp: number, col: string, seed: number, snow?: string) {
  let d = `M0,330 L0,${y}`;
  let snowD = '';
  for (let x = 0; x <= 200; x += 20) {
    const k = Math.sin(x * 0.07 + seed) * 0.6 + Math.sin(x * 0.17 + seed * 2) * 0.4;
    const peakY = y - amp * (0.5 + 0.5 * k);
    d += ` L${x + 10},${peakY.toFixed(1)} L${x + 20},${(y - amp * 0.2 * (1 + Math.sin(x + seed))).toFixed(1)}`;
    if (snow && k > 0.2) snowD += `M${x + 4},${(peakY + amp * 0.25).toFixed(1)} L${x + 10},${peakY.toFixed(1)} L${x + 16},${(peakY + amp * 0.25).toFixed(1)} L${x + 12},${(peakY + amp * 0.2).toFixed(1)} L${x + 10},${(peakY + amp * 0.27).toFixed(1)} L${x + 8},${(peakY + amp * 0.2).toFixed(1)} Z `;
  }
  d += ' L200,330 Z';
  return `<path d="${d}" fill="${col}"/>${snow && snowD ? `<path d="${snowD}" fill="${snow}"/>` : ''}`;
}
function stars(n: number, seed: number, col = '#f6ecd0', maxY = 160) {
  let s = ''; let k = seed;
  const rnd = () => { k = (k * 16807) % 2147483647; return k / 2147483647; };
  for (let i = 0; i < n; i++) s += `<circle cx="${(rnd() * 200).toFixed(1)}" cy="${(rnd() * maxY).toFixed(1)}" r="${(0.4 + rnd() * 0.9).toFixed(2)}" fill="${col}"/>`;
  return s;
}
function backdropSvg(i: number): string {
  switch (i) {
    case 1: // Castillo bajo la luna
      return bands(['#0f2430', '#16323d', '#1f4549', '#2c5b55', '#46766a', '#7aa088', '#b8c79e'], 0, 260) + stars(30, 3, '#e9e4c4', 120)
        + `<circle cx="140" cy="70" r="30" fill="#f2e3b3"/><circle cx="130" cy="62" r="5" fill="#e0cc96"/><circle cx="150" cy="80" r="7" fill="#e0cc96"/>`
        + mountains(215, 30, '#24453f', 1.2)
        + `<path d="M20,215 L20,150 L28,150 L28,140 L32,140 L32,150 L36,150 L36,120 L40,112 L44,120 L44,150 L52,150 L52,132 L60,132 L60,150 L66,150 L66,215 Z" fill="#132726"/><rect x="38" y="128" width="3" height="5" fill="#f2c14e"/><rect x="55" y="140" width="2.5" height="4" fill="#f2c14e"/><path d="M40,112 L40,102 L46,105 L40,107" fill="#c94f2c"/>`
        + mountains(250, 22, '#173029', 4.1) + `<rect x="0" y="255" width="200" height="75" fill="#10221d"/>`;
    case 2: // Bosque con rayos de luz
      return bands(['#20301a', '#2c3f1e', '#3d5224', '#566a2c', '#7d8a3a', '#b0a44f', '#d8c56a'], 0, 280)
        + `<path d="M120,0 L160,0 L90,300 L60,300 Z" fill="#f4e7a6" opacity=".18"/><path d="M60,0 L80,0 L30,300 L10,300 Z" fill="#f4e7a6" opacity=".12"/>`
        + [10, 46, 150, 184].map((x, j) => `<rect x="${x}" y="0" width="${14 - j}" height="300" fill="${j % 2 ? '#2a2414' : '#1e1a10'}"/><ellipse cx="${x + 6}" cy="${20 + j * 9}" rx="${30 - j * 2}" ry="${26 - j}" fill="${j % 2 ? '#2f4a1c' : '#25391a'}"/>`).join('')
        + `<path d="M0,268 Q30,250 60,264 Q100,248 140,262 Q170,250 200,262 L200,330 L0,330 Z" fill="#1b2a12"/>`
        + [20, 70, 120, 170].map((x) => `<path d="M${x},270 q4,-12 9,-16 M${x + 4},270 q-2,-14 -8,-18 M${x + 8},270 q6,-10 12,-12" stroke="#3f5a22" stroke-width="2" fill="none"/>`).join('');
    case 3: // Lunas gemelas
      return bands(['#160c2e', '#2a1243', '#43185a', '#6b2468', '#9a3870', '#c95a6e', '#e88a64', '#f3b871'], 0, 250) + stars(40, 7, '#fde8c8', 140)
        + `<circle cx="58" cy="78" r="34" fill="#f3c6a0"/><path d="M40,70 q10,-6 20,0 M50,92 q12,-4 18,2" stroke="#e0a986" stroke-width="3" fill="none"/><circle cx="150" cy="52" r="14" fill="#a9e0d4"/>`
        + `<path d="M0,250 L10,180 L18,250 L30,205 L40,250 L150,250 L160,170 L166,140 L172,175 L180,250 L200,250 L200,330 L0,330 Z" fill="#2a1238"/><path d="M60,262 Q100,240 140,262 L200,262 L200,330 L0,330 L0,262 Z" fill="#1b0b26"/>`;
    case 4: // Mar al atardecer con barco
      return bands(['#183242', '#244a5a', '#3e6670', '#a8784e', '#d9944c', '#f2b85c', '#f7d37f'], 0, 190)
        + stripedSun(100, 186, 40, '#fbe2a0', ['#f2b85c', '#d9944c', '#a8784e', '#3e6670'])
        + `<rect x="0" y="186" width="200" height="144" fill="#1f4552"/>` + [200, 214, 230, 248, 268].map((y, j) => `<path d="M${10 + j * 7},${y} q8,-3 16,0 M${90 - j * 4},${y + 4} q10,-3 20,0 M${150 + j * 3},${y + 2} q8,-3 16,0" stroke="#5e8c94" stroke-width="1.6" fill="none"/>`).join('')
        + `<rect x="80" y="190" width="40" height="3" fill="#fbe2a0" opacity=".6"/><rect x="88" y="198" width="24" height="2" fill="#fbe2a0" opacity=".4"/>`
        + `<path d="M140,186 L170,186 L166,193 L144,193 Z M154,186 L154,160 M154,162 L166,176 L154,178 Z M153,164 L144,178 L153,180 Z" fill="#1a1a1f" stroke="#1a1a1f" stroke-width="1"/>`;
    case 5: // Mazmorra con antorchas
      return `<rect x="0" y="0" width="200" height="330" fill="#2f2826"/>`
        + Array.from({ length: 16 }, (_, row) => Array.from({ length: 6 }, (__, col) => `<rect x="${col * 36 - (row % 2) * 18 + 1}" y="${row * 18 + 1}" width="34" height="16" rx="2" fill="${(row + col) % 3 ? '#3b3330' : '#453b36'}"/>`).join('')).join('')
        + `<path d="M50,330 L50,120 Q100,60 150,120 L150,330 Z" fill="#120e0d"/><path d="M50,120 Q100,60 150,120" stroke="#5a4e46" stroke-width="6" fill="none"/>`
        + [24, 176].map((x) => `<radialGradient id="tg${x}"><stop offset="0" stop-color="#ffb347" stop-opacity=".55"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient><circle cx="${x}" cy="120" r="45" fill="url(#tg${x})"/><rect x="${x - 2}" y="122" width="4" height="22" fill="#3a2414"/><path d="M${x},104 q-7,10 -3,18 q3,3 6,0 q4,-8 -3,-18" fill="#f7a234"/><path d="M${x},112 q-3,5 -1,9 q2,1 3,0 q1,-4 -2,-9" fill="#ffe08a"/>`).join('')
        + `<rect x="0" y="270" width="200" height="60" fill="#221c1a"/>`;
    case 6: // Desierto
      return bands(['#f6e1a6', '#f2cc85', '#eeb466', '#e59a52', '#d88246'], 0, 220)
        + `<circle cx="150" cy="60" r="22" fill="#fff4d2"/>`
        + `<path d="M30,220 L58,160 L86,220 Z" fill="#b8693a"/><path d="M58,160 L86,220 L66,220 Z" fill="#8e4f2c"/><path d="M110,220 L124,192 L138,220 Z" fill="#a85f34"/>`
        + `<path d="M0,215 Q50,195 100,214 Q150,232 200,208 L200,330 L0,330 Z" fill="#d08a48"/><path d="M0,250 Q60,228 120,250 Q170,268 200,246 L200,330 L0,330 Z" fill="#b36a36"/>`
        + `<rect x="160" y="226" width="6" height="30" fill="#e6c48a"/><rect x="172" y="232" width="6" height="24" fill="#e6c48a"/><rect x="157" y="222" width="24" height="5" fill="#e6c48a"/>`;
    case 7: // Cosmos
      return `<rect x="0" y="0" width="200" height="330" fill="#0b0a24"/>`
        + `<radialGradient id="nb1"><stop offset="0" stop-color="#b04a9a" stop-opacity=".7"/><stop offset="1" stop-color="#b04a9a" stop-opacity="0"/></radialGradient><radialGradient id="nb2"><stop offset="0" stop-color="#3fa7a0" stop-opacity=".55"/><stop offset="1" stop-color="#3fa7a0" stop-opacity="0"/></radialGradient>`
        + `<ellipse cx="60" cy="90" rx="90" ry="60" fill="url(#nb1)"/><ellipse cx="150" cy="190" rx="80" ry="70" fill="url(#nb2)"/>` + stars(70, 11, '#fff8e6', 330)
        + `<circle cx="150" cy="70" r="22" fill="#e48a4c"/><path d="M150,48 a22,22 0 0,1 0,44" fill="#b8613a"/><ellipse cx="150" cy="70" rx="38" ry="7" fill="none" stroke="#f3c88a" stroke-width="2.5"/>`
        + `<path d="M0,275 Q100,255 200,275 L200,330 L0,330 Z" fill="#1d1638"/>`;
    default: // Atardecer con sol a rayas y montañas
      return bands(['#2b1b3d', '#43203f', '#6a2a45', '#93363f', '#bd4c35', '#de6f33', '#f0983d', '#f6c768'], 0, 230)
        + stars(14, 5, '#fbe7c6', 60)
        + stripedSun(100, 150, 50, '#f9d77e', ['#f0983d', '#de6f33', '#bd4c35', '#93363f', '#6a2a45'])
        + mountains(200, 50, '#5c2a3c', 0.6) + mountains(230, 34, '#3e1d2e', 2.4) + `<rect x="0" y="252" width="200" height="78" fill="#26121d"/>`;
  }
}

// ---------------------------------------------------------------------------------------------
// Personaje
// ---------------------------------------------------------------------------------------------
const HEAD = 'M85,60 C85,46 92,43 100,43 C108,43 115,46 115,60 C115,72 108,81 100,81 C92,81 85,72 85,60 Z';
const JAWS: Record<Face['jaw'], string> = {
  oval: HEAD,
  square: 'M85,59 C85,46 92,43 100,43 C108,43 115,46 115,59 L115,70 C115,77 108,81 100,81 C92,81 85,77 85,70 Z',
  round: 'M84,60 C84,46 91,43 100,43 C109,43 116,46 116,60 C116,73 109,80 100,80 C91,80 84,73 84,60 Z',
  narrow: 'M86.5,59 C86.5,46 93,43 100,43 C107,43 113.5,46 113.5,59 C113.5,69 107,82 100,82 C93,82 86.5,69 86.5,59 Z',
  heart: 'M84.5,58 C84.5,45 92,43 100,43 C108,43 115.5,45 115.5,58 C115.5,68 106,80 100,82 C94,80 84.5,68 84.5,58 Z',
};
const SNOUT = 'M85,56 C85,43 93,40 100,40 C107,40 115,43 115,56 L119,70 C120,79 111,84 100,84 C89,84 80,79 81,70 Z';

function headSvg(lk: AvatarLook): { back: string; head: string } {
  const f = FACES[lk.face % FACES.length];
  const skin = lk.skin;
  const dark = shade(skin, -0.35);
  const browCol = lk.hair === 0 ? shade(skin, -0.45) : shade(lk.hairColor, -0.25);
  let back = '';
  let s = '';
  // Orejas
  const earL = lk.ears === 'pointy' ? 'M86.5,58 L72,48 L86.5,68 Z' : 'M86,57 C81,56 81,68 86,68 Z';
  const earR = lk.ears === 'pointy' ? 'M113.5,58 L128,48 L113.5,68 Z' : 'M114,57 C119,56 119,68 114,68 Z';
  s += P(earL, skin, 1.6) + P(earR, shade(skin, -0.12), 1.6);
  // Cabeza
  const jaw = lk.snout ? SNOUT : JAWS[f.jaw];
  s += P(jaw, skin, 2) + shadowR(jaw, 106, 0.12);
  // Halo detrás
  if (lk.halo) back += `<ellipse cx="100" cy="40" rx="24" ry="7" fill="none" stroke="#fff3b0" stroke-width="5" opacity=".45"/><ellipse cx="100" cy="40" rx="24" ry="7" fill="none" stroke="#f6d36a" stroke-width="2"/>`;
  // Ojos
  const eye = (x: number, m: number) => {
    const w = f.eyes === 'narrow' ? 1.3 : f.eyes === 'round' ? 2.6 : 2;
    let e = `<path d="M${x - 4},62 Q${x},${62 - w - 0.6} ${x + 4},62 Q${x},${62 + w} ${x - 4},62 Z" fill="#f4ecdc" stroke="${INK}" stroke-width="1.1"/>`;
    e += `<circle cx="${x + m * 0.3}" cy="62" r="${f.eyes === 'narrow' ? 1.3 : 1.8}" fill="${lk.eyes}"/>`;
    e += lk.snout ? `<rect x="${x + m * 0.3 - 0.4}" y="60.2" width="0.8" height="3.6" fill="${INK}"/>` : `<circle cx="${x + m * 0.3}" cy="62" r=".8" fill="${INK}"/>`;
    if (f.eyes === 'heavy') e += L(`M${x - 4.4},60.8 Q${x},${58.6} ${x + 4.4},60.8`, 1.6);
    return e;
  };
  s += eye(93, -1) + eye(107, 1);
  // Cejas
  const brow = (x: number, m: number) => {
    switch (f.brow) {
      case 'thick': return L(`M${x - 4.5},56.8 Q${x},55 ${x + 4.5},56.6`, 2.6, browCol);
      case 'angry': return L(m < 0 ? `M${x - 4.5},55.5 L${x + 4},58` : `M${x - 4},58 L${x + 4.5},55.5`, 2.2, browCol);
      case 'arched': return L(`M${x - 4.5},57 Q${x},53.8 ${x + 4.5},56.6`, 1.6, browCol);
      default: return L(`M${x - 4},57 Q${x},55.6 ${x + 4},57`, 1.3, browCol);
    }
  };
  if (!lk.snout) s += brow(93, -1) + brow(107, 1);
  else s += L('M88,55 L97,57 M112,55 L103,57', 2, dark);
  // Nariz y boca
  if (lk.snout) {
    s += `<circle cx="96" cy="74" r="1.2" fill="${INK}"/><circle cx="104" cy="74" r="1.2" fill="${INK}"/>` + L('M86,78 Q100,82.5 114,78', 1.6);
    s += [[90, 50], [100, 47], [110, 50], [94, 70], [106, 70], [100, 66]].map(([x, y]) => `<path d="M${x - 2},${y} q2,-2 4,0" stroke="${dark}" stroke-width="1" fill="none"/>`).join('');
  } else {
    const nose = { small: 'M100.5,64 Q102,69 99,70', long: 'M100,59 L102,69.5 Q100.5,71 98,70', broad: 'M98.5,63 Q96.5,70 100,70.5 Q103.5,70 101.5,63', hooked: 'M99,59 Q105,66 101.5,70.5 L98.5,70' }[f.nose];
    s += L(nose, 1.3, dark);
    const mouth = {
      neutral: L('M95,75.5 Q100,76.6 105,75.5', 1.4, shade(skin, -0.5)),
      smile: L('M94.5,74.5 Q100,79 105.5,74.5', 1.5, shade(skin, -0.5)),
      stern: L('M95,76.2 L105,76.2 M95,76.2 L94,77.4 M105,76.2 L106,77.4', 1.4, shade(skin, -0.5)),
      grin: `<path d="M94,74.5 Q100,80 106,74.5 Z" fill="#f4ecdc" stroke="${INK}" stroke-width="1.2"/>`,
      full: `<path d="M95,75.6 Q100,73.8 105,75.6 Q100,78.6 95,75.6 Z" fill="${shade('#b0503f', 0)}" stroke="${INK}" stroke-width=".9"/>`,
    }[f.mouth];
    s += mouth;
  }
  // Marcas
  if (f.lines === 'cheek') s += L('M88,66 Q89.5,70 92,71.5 M112,66 Q110.5,70 108,71.5', 1, dark);
  if (f.lines === 'wrinkles') s += L('M92,50.5 Q100,49 108,50.5 M93,53 Q100,51.8 107,53 M87.5,61.5 L86,60.5 M112.5,61.5 L114,60.5 M95,72.5 Q93,75 94,77.5 M105,72.5 Q107,75 106,77.5', 0.9, dark);
  if (f.lines === 'scar') s += L('M106,53 L110,70', 1.6, '#9a3a2e') + L('M106.5,57 L109.5,57.6 M107.5,62 L110.5,62.6 M108.3,66.5 L111,67', 0.9, '#9a3a2e');
  if (f.lines === 'freckles') s += [[90, 67], [92, 69], [94, 67.5], [106, 67.5], [108, 69], [110, 67]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".55" fill="${dark}"/>`).join('');
  if (f.lines === 'paint') s += `<path d="M87,64 L97,66 L97,68 L88,67 Z M113,64 L103,66 L103,68 L112,67 Z" fill="#b8342a" opacity=".85"/>`;
  // Colmillos y cuernos
  if (lk.tusks) s += P('M95,77 L93.6,70.5 L97.4,76.2 Z', '#f1e6cc', 1) + P('M105,77 L106.4,70.5 L102.6,76.2 Z', '#f1e6cc', 1);
  if (lk.horns) {
    const hc = lk.snout ? '#d8c9a6' : '#3a2a26';
    s += P('M90,48 C84,32 70,30 66,40 C72,36 80,38 85,52 Z', hc, 1.6) + P('M110,48 C116,32 130,30 134,40 C128,36 120,38 115,52 Z', shade(hc, -0.15), 1.6);
  }
  return { back, head: s };
}

function hairSvg(lk: AvatarLook, hatOn: boolean): { back: string; front: string } {
  const hc = lk.hairColor;
  const hd = shade(hc, -0.3);
  const hl = shade(hc, 0.25);
  let back = ''; let front = '';
  const fringe = (d: string) => {
    const id = `h${clipN++}`;
    return P(d, hc, 1.8) + `<clipPath id="${id}"><path d="${d}"/></clipPath>` + L('M92,34 Q89,42 87,56 M100,30 Q100,40 99,47 M108,34 Q111,42 113,56', 1.1, hl, `clip-path="url(#${id})"`);
  };
  const shortTop = 'M84,59 C81,40 91,33 100,33 C110,33 119,40 116,59 C114,49 109,45 100,45 C91,45 86,49 84,59 Z';
  if (lk.snout && lk.hair !== 6) return { back, front };
  switch (lk.hair % 10) {
    case 1: front = fringe(shortTop); break;
    case 2:
      back = P('M83,55 C79,36 90,31 100,31 C110,31 121,36 117,55 L121,110 Q100,116 79,110 Z', hd, 1.8);
      front = fringe('M84,62 C81,39 92,32 100,34 C108,32 119,39 116,62 C114,48 107,43 100,43 C93,43 86,48 84,62 Z'); break;
    case 3:
      back = P('M81,57 C76,34 92,29 100,29 C110,29 124,34 119,57 C124,72 122,88 113,94 L87,94 C78,88 76,72 81,57 Z', hd, 1.8);
      front = fringe('M83,60 C80,38 92,31 100,31 C109,31 120,38 117,60 C113,52 112,46 100,47 C88,46 87,52 83,60 Z'); break;
    case 4:
      back = P('M110,46 C126,52 127,82 120,104 C116,86 115,64 107,52 Z', hd, 1.8);
      front = fringe(shortTop); break;
    case 5:
      back = P('M84,56 C80,36 92,31 100,31 C108,31 120,36 116,56 Z', hd, 1.8)
        + [84, 116].map((x) => [0, 1, 2, 3, 4, 5].map((k) => P(`M${x - 3.6},${64 + k * 8} q3.6,-3 7.2,0 q-0.4,4.5 -3.6,8 q-3.2,-3.5 -3.6,-8 Z`, k % 2 ? hc : hd, 1.2)).join('')).join('');
      front = fringe(shortTop); break;
    case 6:
      if (!hatOn) front = P('M95,47 C93,36 95,24 100,19 C105,24 107,36 105,47 Z', hc, 1.8) + L('M100,22 L100,46', 1, hl);
      break;
    case 7:
      front = fringe(shortTop) + (hatOn ? '' : circ(100, 30, 7, hc, 1.8) + L('M96,27 Q100,24 104,27', 1, hl)); break;
    case 8:
      back = `<ellipse cx="100" cy="54" rx="26" ry="25" fill="${hc}" stroke="${INK}" stroke-width="1.8"/>`;
      front = [0, 1, 2, 3, 4, 5, 6].map((k) => circ(83 + k * 5.6, 42 - Math.sin((k / 6) * Math.PI) * 6, 5, k % 2 ? hc : hl, 1.2)).join(''); break;
    case 9:
      back = P('M82,55 C78,36 90,30 100,30 C110,30 122,36 118,55 L124,120 Q100,126 76,120 Z', hd, 1.8);
      front = fringe('M84,60 C81,38 92,31 100,33 C108,31 119,38 116,60 C114,50 108,47 100,47 C92,47 86,50 84,60 Z') + (hatOn ? '' : P('M83.5,50 Q100,44 116.5,50 L116.5,54 Q100,48 83.5,54 Z', lk.accent, 1.2)); break;
    default: break;
  }
  return { back, front };
}

function beardSvg(lk: AvatarLook): string {
  if (lk.snout) return '';
  const hc = lk.hairColor; const hd = shade(hc, -0.25);
  switch (lk.beard) {
    case 1: return `<path d="M86,68 C88,80 94,83 100,83 C106,83 112,80 114,68 C110,76 106,79 100,79 C94,79 90,76 86,68 Z" fill="${hd}" opacity=".45"/>`;
    case 2: return P('M92,73.5 Q96,71 100,72.8 Q104,71 108,73.5 Q105,73.8 100,74.6 Q95,73.8 92,73.5 Z', hc, 1.1);
    case 3: return P('M86,66 C86,82 93,88 100,88 C107,88 114,82 114,66 C111,74 106,78 100,78 C94,78 89,74 86,66 Z', hc, 1.6) + P('M93,73.5 Q100,71 107,73.5 L105,75 Q100,74 95,75 Z', hc, 1);
    case 4: return P('M85,62 C84,86 92,96 100,96 C108,96 116,86 115,62 C111,74 107,78 100,78 C93,78 89,74 85,62 Z', hc, 1.6) + P('M92.5,73.5 Q100,70.5 107.5,73.5 L105,75.5 Q100,74.2 95,75.5 Z', hc, 1) + L('M95,84 L96,92 M100,82 L100,94 M105,84 L104,92', 0.9, hd);
    case 5: return P('M85,62 C84,92 92,118 100,124 C108,118 116,92 115,62 C111,74 107,78 100,78 C93,78 89,74 85,62 Z', hc, 1.6) + P('M92.5,73.5 Q100,70.5 107.5,73.5 L105,75.5 Q100,74.2 95,75.5 Z', hc, 1) + L('M95,86 Q96,102 98,114 M100,84 L100,120 M105,86 Q104,102 102,114', 0.9, hd);
    default: return '';
  }
}

function hatSvg(hat: Hat, lk: AvatarLook): { back: string; front: string } {
  const m = lk.main; const s2 = lk.second; const a = lk.accent; const metal = '#b9b4a6';
  switch (hat) {
    case 'hood': return {
      back: P('M78,96 C70,64 76,28 100,24 C124,28 130,64 122,96 Z', shade(s2, -0.12), 1.8),
      front: P('M78,96 C70,64 76,28 100,24 C124,28 130,64 122,96 L116,92 C119,66 116,46 100,44 C84,46 81,66 84,92 Z', s2, 1.8) + shadowR('M78,96 C70,64 76,28 100,24 C124,28 130,64 122,96 L116,92 C119,66 116,46 100,44 C84,46 81,66 84,92 Z', 104, 0.18),
    };
    case 'wizard': return { back: '', front: P('M72,47 Q100,38 128,47 Q100,54 72,47 Z', m, 1.8) + P('M86,46 Q92,26 98,10 Q104,2 118,-2 Q108,8 106,22 Q110,34 114,46 Q100,50 86,46 Z', m, 1.8) + shadowR('M86,46 Q92,26 98,10 Q104,2 118,-2 Q108,8 106,22 Q110,34 114,46 Q100,50 86,46 Z', 102, 0.2) + P('M86.5,44 Q100,48.5 113.5,44 L113,40 Q100,44 87.5,40 Z', a, 1.2) + `<path d="M98,26 l1.6,3.2 3.4,.4 -2.5,2.3 .7,3.4 -3.2,-1.7 -3,1.7 .6,-3.4 -2.5,-2.3 3.4,-.4 Z" fill="${shade(a, 0.4)}"/>` };
    case 'helm': return { back: '', front: P('M83,60 C82,38 91,32 100,32 C109,32 118,38 117,60 L113,61 L113,52 L87,52 L87,61 Z', metal, 1.8) + P('M98,50 L102,50 L102,70 L98,70 Z', metal, 1.4) + L('M84,52 L116,52', 2, shade(metal, -0.35)) + L('M90,40 Q94,35 99,34', 1.6, '#eceae2') + shadowR('M83,60 C82,38 91,32 100,32 C109,32 118,38 117,60 L113,61 L113,52 L87,52 L87,61 Z', 104, 0.18) };
    case 'horned': {
      const h = hatSvg('helm', lk);
      return { back: '', front: P('M86,45 C76,40 70,28 74,16 C78,26 84,32 90,38 Z', '#efe4c8', 1.6) + P('M114,45 C124,40 130,28 126,16 C122,26 116,32 110,38 Z', '#d8cba8', 1.6) + h.front };
    }
    case 'circlet': return { back: '', front: P('M84.5,51 Q100,46 115.5,51 L115.5,53.5 Q100,48.5 84.5,53.5 Z', a, 1.1) + `<circle cx="100" cy="48.6" r="2.4" fill="#5fb3d3" stroke="${INK}" stroke-width="1"/>` };
    case 'crown': return { back: '', front: P('M85,52 L85,40 L90,46 L95,36 L100,44 L105,36 L110,46 L115,40 L115,52 Q100,48 85,52 Z', '#e0b443', 1.5) + `<circle cx="100" cy="47" r="2" fill="#c0392b"/><circle cx="91" cy="48.5" r="1.4" fill="#2e86c1"/><circle cx="109" cy="48.5" r="1.4" fill="#2e86c1"/>` };
    case 'headband': return { back: P('M114,50 L126,58 L124,62 L114,55 Z', a, 1.1), front: P('M84,49.5 Q100,44 116,49.5 L116,54 Q100,48.5 84,54 Z', a, 1.1) };
    case 'cap': return { back: '', front: P('M80,48 C80,32 112,28 120,42 L124,48 Q100,52 80,48 Z', m, 1.8) + P('M114,36 C124,22 136,18 146,14 C138,22 130,30 118,40 Z', a, 1.3) + L('M118,38 L140,18', 0.9, shade(a, -0.3)) + P('M80,48 Q100,52 124,48 L123,51 Q100,55 81,51 Z', shade(m, -0.25), 1.2) };
    case 'mask': return { back: '', front: P('M85,66 C88,70 94,72 100,72 C106,72 112,70 115,66 L115,78 C110,83 105,84 100,84 C95,84 90,83 85,78 Z', s2, 1.5) };
    default: return { back: '', front: '' };
  }
}

function propSvg(p: Prop, g: Geo, side: 0 | 1, lk: AvatarLook): { back: string; front: string } {
  const [hx, hy] = g.hand[side];
  const metal = '#c7c3b8'; const wood = '#6b4423'; const a = lk.accent;
  const dir = side === 0 ? -1 : 1;
  switch (p) {
    case 'sword': return { back: '', front: P(`M${hx - 2.2},${hy - 4} L${hx - 2.2},${hy - 78} L${hx},${hy - 86} L${hx + 2.2},${hy - 78} L${hx + 2.2},${hy - 4} Z`, metal, 1.4) + L(`M${hx},${hy - 80} L${hx},${hy - 8}`, 0.8, '#efece4') + P(`M${hx - 9},${hy - 6} L${hx + 9},${hy - 6} L${hx + 9},${hy - 2} L${hx - 9},${hy - 2} Z`, a, 1.3) + P(`M${hx - 1.8},${hy - 2} L${hx + 1.8},${hy - 2} L${hx + 1.8},${hy + 9} L${hx - 1.8},${hy + 9} Z`, wood, 1.2) + circ(hx, hy + 11, 2.4, a, 1.2) };
    case 'rapier': return { back: '', front: L(`M${hx},${hy - 4} L${hx + dir * 4},${hy - 90}`, 3.4) + L(`M${hx},${hy - 4} L${hx + dir * 4},${hy - 90}`, 1.8, metal) + `<path d="M${hx - 7},${hy - 4} Q${hx},${hy - 14} ${hx + 7},${hy - 4}" fill="none" stroke="${INK}" stroke-width="3"/><path d="M${hx - 7},${hy - 4} Q${hx},${hy - 14} ${hx + 7},${hy - 4}" fill="none" stroke="${a}" stroke-width="1.6"/>` + L(`M${hx},${hy - 4} L${hx},${hy + 9}`, 3, wood) };
    case 'greatsword': return { back: '', front: P(`M${hx - 3},${hy - 6} L${hx - 3},${hy - 110} L${hx},${hy - 120} L${hx + 3},${hy - 110} L${hx + 3},${hy - 6} Z`, metal, 1.5) + L(`M${hx},${hy - 112} L${hx},${hy - 10}`, 0.9, '#efece4') + P(`M${hx - 12},${hy - 8} L${hx + 12},${hy - 8} L${hx + 12},${hy - 3} L${hx - 12},${hy - 3} Z`, a, 1.3) + P(`M${hx - 2},${hy - 3} L${hx + 2},${hy - 3} L${hx + 2},${hy + 16} L${hx - 2},${hy + 16} Z`, wood, 1.2) + circ(hx, hy + 18, 3, a, 1.2) };
    case 'axe': return { back: '', front: L(`M${hx},${hy + 12} L${hx},${hy - 52}`, 4.6) + L(`M${hx},${hy + 12} L${hx},${hy - 52}`, 2.8, wood) + P(`M${hx},${hy - 50} Q${hx + dir * 18},${hy - 62} ${hx + dir * 20},${hy - 44} Q${hx + dir * 14},${hy - 40} ${hx},${hy - 38} Z`, metal, 1.5) };
    case 'greataxe': return { back: '', front: L(`M${hx},${hy + 40} L${hx},${hy - 92}`, 5) + L(`M${hx},${hy + 40} L${hx},${hy - 92}`, 3.2, wood) + P(`M${hx},${hy - 90} Q${hx + 26},${hy - 106} ${hx + 26},${hy - 76} Q${hx + 18},${hy - 70} ${hx},${hy - 68} Z`, metal, 1.5) + P(`M${hx},${hy - 90} Q${hx - 26},${hy - 106} ${hx - 26},${hy - 76} Q${hx - 18},${hy - 70} ${hx},${hy - 68} Z`, shade(metal, -0.12), 1.5) };
    case 'spear': return { back: '', front: L(`M${hx},${hy + 100} L${hx},${hy - 130}`, 4) + L(`M${hx},${hy + 100} L${hx},${hy - 130}`, 2.4, wood) + P(`M${hx},${hy - 150} Q${hx + 6},${hy - 136} ${hx},${hy - 126} Q${hx - 6},${hy - 136} ${hx},${hy - 150} Z`, metal, 1.4) + L(`M${hx - 3},${hy - 124} L${hx + 3},${hy - 124}`, 2, a) };
    case 'staff': return { back: '', front: L(`M${hx},${hy + 110} Q${hx + 3},${hy} ${hx - 2},${hy - 120}`, 5) + L(`M${hx},${hy + 110} Q${hx + 3},${hy} ${hx - 2},${hy - 120}`, 3.2, wood) + `<circle cx="${hx - 2}" cy="${hy - 128}" r="10" fill="${a}" opacity=".35"/>` + circ(hx - 2, hy - 128, 5.5, shade(a, 0.35), 1.4) + L(`M${hx - 6},${hy - 120} Q${hx - 8},${hy - 130} ${hx - 3},${hy - 136} M${hx + 2},${hy - 120} Q${hx + 4},${hy - 130} ${hx - 1},${hy - 136}`, 1.6, wood) };
    case 'orb': return { back: '', front: `<circle cx="${hx}" cy="${hy - 14}" r="14" fill="${a}" opacity=".3"/>` + circ(hx, hy - 12, 7.5, shade(a, 0.3), 1.5) + `<circle cx="${hx - 2.5}" cy="${hy - 15}" r="2.2" fill="#fff" opacity=".8"/>` };
    case 'wand': return { back: '', front: L(`M${hx},${hy + 4} L${hx + dir * 10},${hy - 30}`, 3.6) + L(`M${hx},${hy + 4} L${hx + dir * 10},${hy - 30}`, 2, wood) + `<circle cx="${hx + dir * 10.5}" cy="${hy - 32}" r="5" fill="${a}" opacity=".55"/><circle cx="${hx + dir * 10.5}" cy="${hy - 32}" r="1.8" fill="#fff"/>` };
    case 'tome': return { back: '', front: P(`M${hx - 10},${hy - 10} L${hx + 10},${hy - 12} L${hx + 11},${hy + 12} L${hx - 9},${hy + 14} Z`, shade(lk.main, -0.2), 1.5) + L(`M${hx - 7},${hy - 9} L${hx - 6},${hy + 12}`, 1.2, a) + `<circle cx="${hx + 1}" cy="${hy + 1}" r="3" fill="none" stroke="${a}" stroke-width="1.2"/>` };
    case 'shield': return { back: '', front: P(`M${hx - 16},${hy - 34} L${hx + 16},${hy - 34} L${hx + 16},${hy - 6} Q${hx + 14},${hy + 14} ${hx},${hy + 22} Q${hx - 14},${hy + 14} ${hx - 16},${hy - 6} Z`, lk.main, 1.8) + `<path d="M${hx - 12},${hy - 30} L${hx + 12},${hy - 30} L${hx + 12},${hy - 7} Q${hx + 10},${hy + 10} ${hx},${hy + 17} Q${hx - 10},${hy + 10} ${hx - 12},${hy - 7} Z" fill="none" stroke="${a}" stroke-width="2"/>` + `<path d="M${hx},${hy - 26} L${hx + 5},${hy - 12} L${hx},${hy + 2} L${hx - 5},${hy - 12} Z" fill="${a}"/>` + shadowR(`M${hx - 16},${hy - 34} L${hx + 16},${hy - 34} L${hx + 16},${hy - 6} Q${hx + 14},${hy + 14} ${hx},${hy + 22} Q${hx - 14},${hy + 14} ${hx - 16},${hy - 6} Z`, hx + 1, 0.2) };
    case 'mace': return { back: '', front: L(`M${hx},${hy + 12} L${hx},${hy - 40}`, 4.4) + L(`M${hx},${hy + 12} L${hx},${hy - 40}`, 2.6, wood) + circ(hx, hy - 46, 7, metal, 1.5) + [0, 60, 120, 180, 240, 300].map((d) => { const rad = (d * Math.PI) / 180; return P(`M${hx + Math.cos(rad) * 6},${hy - 46 + Math.sin(rad) * 6} L${hx + Math.cos(rad) * 10},${hy - 46 + Math.sin(rad) * 10} L${hx + Math.cos(rad + 0.4) * 6},${hy - 46 + Math.sin(rad + 0.4) * 6} Z`, metal, 0.9); }).join('') };
    case 'daggers': return { back: '', front: P(`M${hx - 1.6},${hy - 2} L${hx - 1.6},${hy - 24} L${hx},${hy - 30} L${hx + 1.6},${hy - 24} L${hx + 1.6},${hy - 2} Z`, metal, 1.2) + L(`M${hx - 5},${hy - 2} L${hx + 5},${hy - 2}`, 2.4, a) };
    case 'bow': return { back: '', front: `<path d="M${hx + dir * 2},${hy - 70} Q${hx + dir * 24},${hy} ${hx + dir * 2},${hy + 70}" fill="none" stroke="${INK}" stroke-width="5"/><path d="M${hx + dir * 2},${hy - 70} Q${hx + dir * 24},${hy} ${hx + dir * 2},${hy + 70}" fill="none" stroke="${wood}" stroke-width="3"/>` + L(`M${hx + dir * 2},${hy - 70} L${hx + dir * 2},${hy + 70}`, 0.8, '#e8e0cc') };
    case 'crossbow': return { back: '', front: L(`M${hx},${hy + 6} L${hx},${hy - 34}`, 5) + L(`M${hx},${hy + 6} L${hx},${hy - 34}`, 3.2, wood) + `<path d="M${hx - 16},${hy - 22} Q${hx},${hy - 34} ${hx + 16},${hy - 22}" fill="none" stroke="${INK}" stroke-width="4"/><path d="M${hx - 16},${hy - 22} Q${hx},${hy - 34} ${hx + 16},${hy - 22}" fill="none" stroke="${metal}" stroke-width="2.2"/>` + L(`M${hx - 16},${hy - 22} L${hx + 16},${hy - 22}`, 0.8, '#e8e0cc') };
    case 'lute': return { back: '', front: `<ellipse cx="${hx + dir * 6}" cy="${hy - 4}" rx="11" ry="14" fill="#a8672f" stroke="${INK}" stroke-width="1.6"/><circle cx="${hx + dir * 6}" cy="${hy - 6}" r="3" fill="${INK}"/>` + L(`M${hx + dir * 6},${hy - 18} L${hx + dir * 12},${hy - 54}`, 4.6) + L(`M${hx + dir * 6},${hy - 18} L${hx + dir * 12},${hy - 54}`, 2.8, wood) + P(`M${hx + dir * 10},${hy - 54} L${hx + dir * 16},${hy - 62} L${hx + dir * 15},${hy - 52} Z`, wood, 1.1) };
    case 'flute': return { back: '', front: L(`M${hx - dir * 2},${hy + 4} L${hx + dir * 8},${hy - 34}`, 4) + L(`M${hx - dir * 2},${hy + 4} L${hx + dir * 8},${hy - 34}`, 2.4, '#c9a56a') };
    case 'scythe': return { back: '', front: L(`M${hx},${hy + 110} Q${hx - 3},${hy} ${hx},${hy - 120}`, 4.6) + L(`M${hx},${hy + 110} Q${hx - 3},${hy} ${hx},${hy - 120}`, 2.8, wood) + P(`M${hx},${hy - 118} Q${hx - dir * 34},${hy - 128} ${hx - dir * 48},${hy - 104} Q${hx - dir * 30},${hy - 114} ${hx},${hy - 108} Z`, metal, 1.5) };
    case 'sickle': return { back: '', front: L(`M${hx},${hy + 8} L${hx},${hy - 12}`, 4) + L(`M${hx},${hy + 8} L${hx},${hy - 12}`, 2.4, wood) + `<path d="M${hx},${hy - 12} Q${hx + dir * 18},${hy - 20} ${hx + dir * 10},${hy - 36}" fill="none" stroke="${INK}" stroke-width="4.4"/><path d="M${hx},${hy - 12} Q${hx + dir * 18},${hy - 20} ${hx + dir * 10},${hy - 36}" fill="none" stroke="${metal}" stroke-width="2.4"/>` };
    case 'lantern': return { back: '', front: L(`M${hx},${hy + 2} L${hx},${hy + 8}`, 1.4) + `<circle cx="${hx}" cy="${hy + 18}" r="12" fill="#ffcf6a" opacity=".3"/>` + P(`M${hx - 5},${hy + 8} L${hx + 5},${hy + 8} L${hx + 6},${hy + 24} L${hx - 6},${hy + 24} Z`, '#ffd981', 1.4) + L(`M${hx - 5},${hy + 8} L${hx + 5},${hy + 8} M${hx - 6},${hy + 24} L${hx + 6},${hy + 24}`, 2.2, '#3a2a1a') };
    case 'torch': return { back: '', front: L(`M${hx},${hy + 10} L${hx},${hy - 26}`, 4.4) + L(`M${hx},${hy + 10} L${hx},${hy - 26}`, 2.6, wood) + `<circle cx="${hx}" cy="${hy - 34}" r="13" fill="#ffb347" opacity=".3"/><path d="M${hx},${hy - 46} q-8,10 -4,16 q4,4 8,0 q4,-8 -4,-16" fill="#f7a234"/><path d="M${hx},${hy - 38} q-3,5 -1,8 q2,1 3,0 q1,-4 -2,-8" fill="#ffe08a"/>` };
    default: return { back: '', front: '' };
  }
}

function outfitSvg(def: OutfitDef, g: Geo, lk: AvatarLook): { back: string; legs: string; torso: string; armsBack: string; over: string; arms: [string, string] } {
  const b = g.b; const m = lk.main; const s2 = lk.second; const a = lk.accent; const skin = lk.skin;
  const metal = '#b9b4a6'; const leather = '#7a4e2c'; const boot = shade(leather, -0.35);
  let back = ''; let legs = ''; let torso = ''; let over = '';
  const ex = new Set(def.extras);
  const arms: [string, string] = ['', ''];
  // Capa por detrás
  if (ex.has('cape')) back += P(`M${CX - b.sw + 2},${SH - 2} L${CX + b.sw - 2},${SH - 2} L${CX + b.sw + 24},${FOOT} Q${CX},${FOOT + 8} ${CX - b.sw - 24},${FOOT} Z`, shade(s2, -0.15), 1.8);
  if (ex.has('quiver')) back += P(`M${CX + b.sw - 6},${SH - 22} L${CX + b.sw + 4},${SH - 18} L${CX - 4},${WAIST} L${CX - 12},${WAIST - 4} Z`, leather, 1.5) + L(`M${CX + b.sw - 4},${SH - 22} L${CX + b.sw - 2},${SH - 34} M${CX + b.sw},${SH - 20} L${CX + b.sw + 3},${SH - 32}`, 1.6, '#e8dcc0');
  // Piernas
  const pants = def.base === 'bare' ? skin : def.base === 'plate' ? metal : def.base === 'gi' ? m : s2;
  const boots = def.base === 'gi' || def.base === 'rags' ? shade(leather, -0.1) : boot;
  for (const i of [0, 1] as const) {
    legs += limb(legPath(g, i), b.leg, i ? shade(pants, -0.12) : pants);
    if (def.base === 'bare' && !ex.has('skirt')) legs += limb(legPath(g, i, 0, 0.45), b.leg + 1, i ? shade(s2, -0.12) : s2);
    if (def.base === 'plate') legs += limb(legPath(g, i, 0.55, 0.95), b.leg + 2, i ? shade(metal, -0.12) : metal) + `<circle cx="${g.knee[i][0]}" cy="${g.knee[i][1]}" r="${b.leg * 0.55}" fill="${shade(metal, 0.15)}" stroke="${INK}" stroke-width="1.4"/>`;
    else legs += limb(legPath(g, i, 0.68, 1), b.leg + 1.5, i ? shade(boots, -0.12) : boots);
    const [fx, fy] = g.ankle[i];
    legs += `<ellipse cx="${fx + (i ? 3 : -3)}" cy="${fy + 8}" rx="${b.leg * 0.7 + 3}" ry="4.6" fill="${def.base === 'plate' ? metal : boots}" stroke="${INK}" stroke-width="1.6"/>`;
  }
  // Brazos (manga hasta t)
  const sleeve: Record<Base, [number, number]> = { robe: [0.95, 5], tunic: [0.62, 1.5], leather: [0.5, 1.5], chain: [0.55, 2], plate: [0.95, 2.5], bare: [0, 0], gi: [0.6, 3], gown: [0.9, 4], vestments: [0.9, 4], rags: [0.5, 2] };
  const [st, sw] = sleeve[def.base];
  const sleeveCol = def.base === 'plate' ? metal : def.base === 'chain' ? '#9b9890' : m;
  for (const i of [0, 1] as const) {
    let s = limb(armPath(g, i), b.arm, i ? shade(skin, -0.1) : skin);
    if (st > 0) s += limb(armPath(g, i, st), b.arm + sw, i ? shade(sleeveCol, -0.14) : sleeveCol);
    if (ex.has('bracers') || def.base === 'leather') { const p1 = lerp(g.el[i], g.hand[i], 0.45); const p2 = lerp(g.el[i], g.hand[i], 0.85); s += limb(`M${p1[0]},${p1[1]} L${p2[0]},${p2[1]}`, b.arm + 2, i ? shade(leather, -0.15) : leather); }
    const [hx, hy] = g.hand[i];
    s += circ(hx, hy + 2, b.arm * 0.62 + 1, def.base === 'plate' ? metal : i ? shade(skin, -0.1) : skin, 1.6);
    arms[i] = s;
  }
  // Torso según la base
  const t = g.torso;
  switch (def.base) {
    case 'bare': {
      torso += P(t, skin, 2) + shadowR(t, CX + 4, 0.18);
      torso += L(`M${CX - b.sw * 0.55},${SH + 18} Q${CX - 6},${SH + 26} ${CX - 2},${SH + 20} M${CX + b.sw * 0.55},${SH + 18} Q${CX + 6},${SH + 26} ${CX + 2},${SH + 20} M${CX},${SH + 30} L${CX},${WAIST - 4} M${CX - 7},${SH + 38} L${CX + 7},${SH + 38} M${CX - 6},${SH + 46} L${CX + 6},${SH + 46}`, 1, shade(skin, -0.35));
      break;
    }
    case 'robe': case 'vestments': case 'gown': {
      const flare = def.base === 'gown' ? 22 : 16;
      const d = `M${CX - b.sw + 1},${SH - 3} L${CX + b.sw - 1},${SH - 3} Q${CX + b.ww + 4},${WAIST - 10} ${CX + b.ww + 1},${WAIST} L${CX + b.hw + flare},${FOOT - 2} Q${CX},${FOOT + 4} ${CX - b.hw - flare},${FOOT - 2} L${CX - b.ww - 1},${WAIST} Q${CX - b.ww - 4},${WAIST - 10} ${CX - b.sw + 1},${SH - 3} Z`;
      torso += P(d, m, 2) + shadowR(d, CX + 4, 0.2);
      torso += L(`M${CX - 8},${HIP + 10} Q${CX - 10},${FOOT - 40} ${CX - 14},${FOOT - 4} M${CX + 8},${HIP + 10} Q${CX + 10},${FOOT - 40} ${CX + 14},${FOOT - 4}`, 1, shade(m, -0.35));
      torso += L(`M${CX - b.hw - flare + 2},${FOOT - 4} Q${CX},${FOOT + 1} ${CX + b.hw + flare - 2},${FOOT - 4}`, 3, a);
      if (def.base === 'vestments') torso += P(`M${CX - 9},${SH - 2} L${CX + 9},${SH - 2} L${CX + 10},${FOOT - 6} L${CX - 10},${FOOT - 6} Z`, s2, 1.5) + `<path d="M${CX},${SH + 30} l0,22 M${CX - 7},${SH + 38} l14,0" stroke="${a}" stroke-width="3"/>`;
      torso += P(`M${CX - 9},${SH - 3} L${CX},${SH + 12} L${CX + 9},${SH - 3} Z`, shade(m, -0.25), 1.4);
      break;
    }
    case 'tunic': case 'gi': case 'rags': {
      const len = def.base === 'gi' ? HIP + 8 : HIP + 22;
      const d = `M${CX - b.sw},${SH + 4} Q${CX - b.sw},${SH - 3} ${CX - b.sw + 9},${SH - 4} L${CX + b.sw - 9},${SH - 4} Q${CX + b.sw},${SH - 3} ${CX + b.sw},${SH + 4} Q${CX + b.ww + 2},${WAIST - 18} ${CX + b.ww + 1},${WAIST} L${CX + b.hw + 6},${len} L${CX - b.hw - 6},${len} L${CX - b.ww - 1},${WAIST} Q${CX - b.ww - 2},${WAIST - 18} ${CX - b.sw},${SH + 4} Z`;
      const col = def.base === 'rags' ? shade(m, -0.1) : m;
      torso += P(d, col, 2) + shadowR(d, CX + 4, 0.2);
      if (def.base === 'gi') torso += L(`M${CX - 10},${SH - 3} L${CX + 6},${WAIST} M${CX + 10},${SH - 3} L${CX - 2},${WAIST - 10}`, 1.6, shade(m, -0.4));
      else torso += P(`M${CX - 7},${SH - 3} L${CX},${SH + 10} L${CX + 7},${SH - 3} Z`, skin, 1.3);
      if (def.base === 'rags') torso += L(`M${CX - b.hw - 6},${len} l4,-6 l4,6 l5,-7 l4,7 l5,-6 l4,6 l5,-7 l4,7`, 1.2) + `<rect x="${CX + 4}" y="${SH + 26}" width="9" height="8" fill="${shade(m, 0.2)}" stroke="${INK}" stroke-width="1"/>`;
      torso += L(`M${CX - b.hw - 5},${len - 3} L${CX + b.hw + 5},${len - 3}`, 2.4, a);
      break;
    }
    case 'leather': {
      const d = `M${CX - b.sw},${SH + 4} Q${CX - b.sw},${SH - 3} ${CX - b.sw + 9},${SH - 4} L${CX + b.sw - 9},${SH - 4} Q${CX + b.sw},${SH - 3} ${CX + b.sw},${SH + 4} Q${CX + b.ww + 2},${WAIST - 18} ${CX + b.ww + 1},${WAIST} L${CX + b.hw + 3},${HIP + 14} L${CX - b.hw - 3},${HIP + 14} L${CX - b.ww - 1},${WAIST} Q${CX - b.ww - 2},${WAIST - 18} ${CX - b.sw},${SH + 4} Z`;
      torso += P(d, m, 2) + shadowR(d, CX + 4, 0.2);
      torso += P(`M${CX - b.ww * 0.7},${SH + 8} L${CX + b.ww * 0.7},${SH + 8} L${CX + b.ww * 0.8},${WAIST - 4} L${CX - b.ww * 0.8},${WAIST - 4} Z`, leather, 1.6) + L(`M${CX - 3},${SH + 12} L${CX + 3},${SH + 16} M${CX - 3},${SH + 20} L${CX + 3},${SH + 24} M${CX - 3},${SH + 28} L${CX + 3},${SH + 32} M${CX - 3},${SH + 36} L${CX + 3},${SH + 40}`, 1, '#e8d8b8');
      break;
    }
    case 'chain': {
      const d = `M${CX - b.sw},${SH + 4} Q${CX - b.sw},${SH - 3} ${CX - b.sw + 9},${SH - 4} L${CX + b.sw - 9},${SH - 4} Q${CX + b.sw},${SH - 3} ${CX + b.sw},${SH + 4} Q${CX + b.ww + 2},${WAIST - 18} ${CX + b.ww + 1},${WAIST} L${CX + b.hw + 5},${HIP + 18} L${CX - b.hw - 5},${HIP + 18} L${CX - b.ww - 1},${WAIST} Q${CX - b.ww - 2},${WAIST - 18} ${CX - b.sw},${SH + 4} Z`;
      torso += P(d, '#9b9890', 2) + `<path d="${d}" fill="url(#chainP)"/>` + shadowR(d, CX + 4, 0.22);
      break;
    }
    case 'plate': {
      torso += P(t, metal, 2) + shadowR(t, CX + 4, 0.22);
      torso += L(`M${CX},${SH - 2} L${CX},${WAIST - 4}`, 1.4, shade(metal, -0.35)) + L(`M${CX - b.ww},${WAIST - 6} Q${CX},${WAIST} ${CX + b.ww},${WAIST - 6} M${CX - b.ww - 2},${WAIST + 4} Q${CX},${WAIST + 10} ${CX + b.ww + 2},${WAIST + 4} M${CX - b.hw + 2},${WAIST + 14} Q${CX},${WAIST + 20} ${CX + b.hw - 2},${WAIST + 14}`, 1.5, shade(metal, -0.35));
      torso += `<path d="M${CX - b.sw + 8},${SH + 4} Q${CX - b.sw + 10},${SH + 18} ${CX - 8},${SH + 30}" stroke="#f1eee6" stroke-width="2" fill="none" opacity=".8"/>`;
      torso += P(`M${CX - b.hw - 2},${HIP - 4} L${CX + b.hw + 2},${HIP - 4} L${CX + b.hw + 4},${HIP + 18} L${CX - b.hw - 4},${HIP + 18} Z`, s2, 1.6);
      break;
    }
  }
  // Extras por encima
  if (ex.has('skirt')) torso += P(`M${CX - b.hw - 2},${HIP - 8} L${CX + b.hw + 2},${HIP - 8} L${CX + b.hw + 7},${HIP + 22} L${CX - b.hw - 7},${HIP + 22} Z`, def.base === 'bare' && ex.has('fur') ? '#8a6a48' : s2, 1.6) + L(`M${CX - b.hw + 2},${HIP - 6} L${CX - b.hw - 2},${HIP + 20} M${CX - 6},${HIP - 6} L${CX - 7},${HIP + 21} M${CX + 6},${HIP - 6} L${CX + 7},${HIP + 21} M${CX + b.hw - 2},${HIP - 6} L${CX + b.hw + 2},${HIP + 20}`, 1, shade(s2, -0.4));
  if (ex.has('tabard')) over += P(`M${CX - b.ww * 0.75},${SH} L${CX + b.ww * 0.75},${SH} L${CX + b.ww * 0.85},${HIP + 34} L${CX},${HIP + 40} L${CX - b.ww * 0.85},${HIP + 34} Z`, m, 1.7) + shadowR(`M${CX - b.ww * 0.75},${SH} L${CX + b.ww * 0.75},${SH} L${CX + b.ww * 0.85},${HIP + 34} L${CX},${HIP + 40} L${CX - b.ww * 0.85},${HIP + 34} Z`, CX + 3, 0.18) + `<path d="M${CX},${SH + 14} L${CX + 7},${SH + 26} L${CX},${SH + 38} L${CX - 7},${SH + 26} Z" fill="${a}" stroke="${INK}" stroke-width="1.1"/>`;
  // Cinturón
  if (def.base !== 'robe' && def.base !== 'gown' && def.base !== 'vestments' || ex.has('sash')) {
    if (ex.has('sash')) over += P(`M${CX - b.ww - 2},${WAIST - 4} L${CX + b.ww + 2},${WAIST - 4} L${CX + b.ww + 2},${WAIST + 5} L${CX - b.ww - 2},${WAIST + 5} Z`, s2, 1.4) + P(`M${CX + b.ww - 4},${WAIST + 2} L${CX + b.ww + 2},${WAIST + 26} L${CX + b.ww - 6},${WAIST + 24} Z`, s2, 1.2);
    else over += P(`M${CX - b.ww - 2},${WAIST - 2} L${CX + b.ww + 2},${WAIST - 2} L${CX + b.ww + 2},${WAIST + 4} L${CX - b.ww - 2},${WAIST + 4} Z`, leather, 1.4) + `<rect x="${CX - 3.5}" y="${WAIST - 3}" width="7" height="8" fill="${a}" stroke="${INK}" stroke-width="1.1"/>`;
  }
  if (ex.has('straps')) over += P(`M${CX - b.sw + 6},${SH - 2} L${CX - b.sw + 12},${SH - 4} L${CX + b.ww + 2},${WAIST - 4} L${CX + b.ww - 4},${WAIST} Z`, leather, 1.3) + `<circle cx="${CX - 2}" cy="${SH + 22}" r="2.6" fill="${a}" stroke="${INK}" stroke-width="1"/>`;
  if (ex.has('satchel')) over += L(`M${CX - b.sw + 8},${SH - 3} L${CX + b.ww + 4},${HIP - 4}`, 2.4, leather) + P(`M${CX + b.ww - 4},${HIP - 8} L${CX + b.ww + 14},${HIP - 8} L${CX + b.ww + 14},${HIP + 8} L${CX + b.ww - 4},${HIP + 8} Z`, leather, 1.4) + L(`M${CX + b.ww - 4},${HIP - 2} L${CX + b.ww + 14},${HIP - 2}`, 1);
  if (ex.has('amulet')) over += L(`M${CX - 8},${SH - 3} Q${CX},${SH + 14} ${CX + 8},${SH - 3}`, 1, '#e0b443') + circ(CX, SH + 13, 3.2, a, 1.1);
  if (ex.has('bones')) over += [-8, -3, 2, 7].map((x, j) => P(`M${CX + x},${SH + 4 + (j % 2) * 2} l2,6 l-4,0 Z`, '#efe4c8', 0.9)).join('');
  if (ex.has('scarf')) over += P(`M${CX - 12},${SH - 6} Q${CX},${SH + 4} ${CX + 12},${SH - 6} L${CX + 12},${SH - 1} Q${CX},${SH + 10} ${CX - 12},${SH - 1} Z`, s2, 1.4) + P(`M${CX + 6},${SH + 2} L${CX + 12},${SH + 24} L${CX + 4},${SH + 22} Z`, s2, 1.2);
  if (ex.has('hoodDown')) over += P(`M${CX - 16},${SH - 6} Q${CX},${SH + 10} ${CX + 16},${SH - 6} Q${CX + 12},${SH - 12} ${CX},${SH - 10} Q${CX - 12},${SH - 12} ${CX - 16},${SH - 6} Z`, s2, 1.5);
  if (ex.has('mantle')) over += P(`M${CX - b.sw - 2},${SH + 8} Q${CX - b.sw},${SH - 6} ${CX},${SH - 7} Q${CX + b.sw},${SH - 6} ${CX + b.sw + 2},${SH + 8} Q${CX},${SH + 22} ${CX - b.sw - 2},${SH + 8} Z`, s2, 1.6) + L(`M${CX - b.sw},${SH + 9} Q${CX},${SH + 21} ${CX + b.sw},${SH + 9}`, 2, a);
  if (ex.has('fur')) {
    let d = `M${CX - b.sw - 4},${SH + 10}`;
    for (let k = 0; k <= 10; k++) { const x = CX - b.sw - 4 + ((b.sw * 2 + 8) * k) / 10; const y = SH + 10 + Math.sin((k / 10) * Math.PI) * 10; d += ` L${x},${y + (k % 2 ? 5 : 0)}`; }
    d += ` Q${CX + b.sw},${SH - 10} ${CX},${SH - 10} Q${CX - b.sw},${SH - 10} ${CX - b.sw - 4},${SH + 10} Z`;
    over += P(d, '#8a6a48', 1.6) + L(`M${CX - b.sw + 4},${SH + 2} l3,4 M${CX - 6},${SH} l3,4 M${CX + 10},${SH + 2} l3,4`, 1, '#5a4430');
  }
  if (ex.has('pauldrons') || ex.has('pauldron')) {
    const sides: (0 | 1)[] = ex.has('pauldrons') ? [0, 1] : [0];
    for (const i of sides) over += `<ellipse cx="${CX + (i ? 1 : -1) * (b.sw - 3)}" cy="${SH + 3}" rx="${b.sw * 0.42 + 3}" ry="9" fill="${i ? shade(metal, -0.12) : metal}" stroke="${INK}" stroke-width="1.8"/>` + L(`M${CX + (i ? 1 : -1) * (b.sw - 3) - 8},${SH + 6} Q${CX + (i ? 1 : -1) * (b.sw - 3)},${SH + 10} ${CX + (i ? 1 : -1) * (b.sw - 3) + 8},${SH + 6}`, 1.2, shade(metal, -0.35));
  }
  return { back, legs, torso, armsBack: '', over, arms };
}

/** SVG completo del retrato (200×330) */
export function portraitSvg(lk: AvatarLook, name = ''): string {
  clipN = 0;
  const b = BODIES[lk.body % BODIES.length];
  const g = geo(b);
  const def = outfitsFor(lk.outfitClass)[lk.outfit % 10];
  const hat: Hat = lk.noHat ? 'none' : def.hat;
  const fit = outfitSvg(def, g, lk);
  const hd = headSvg(lk);
  const hr = hairSvg(lk, hat !== 'none' && hat !== 'circlet' && hat !== 'headband' && hat !== 'mask');
  const ht = hatSvg(hat, lk);
  const p1 = propSvg(def.props[0] ?? 'none', g, 0, lk);
  const p2 = def.props[1] ? propSvg(def.props[1], g, 1, lk) : { back: '', front: '' };
  const neckW = 5 + b.arm * 0.32;
  const neck = P(`M${CX - neckW},${74} L${CX + neckW},${74} L${CX + neckW + 1},${SH} L${CX - neckW - 1},${SH} Z`, shade(lk.skin, -0.12), 1.6) + `<path d="M${CX - neckW},78 Q${CX},84 ${CX + neckW},78 L${CX + neckW},74 L${CX - neckW},74 Z" fill="#1a0c06" opacity=".25"/>`;
  const scale = Math.min(1.1, b.h * lk.height);
  const figure = `<g transform="translate(100 ${FOOT}) scale(${scale.toFixed(3)}) translate(-100 -${FOOT})">`
    + `<ellipse cx="100" cy="${FOOT + 2}" rx="${b.hw + 22}" ry="5" fill="#000" opacity=".3"/>`
    + fit.back + hd.back + hr.back + ht.back + fit.legs + fit.arms[0] + fit.arms[1] + fit.torso + fit.over + neck + hd.head + beardSvg(lk) + hr.front + ht.front + p1.front + p2.front
    + `</g>`;
  const title = name ? `<text x="100" y="319" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="13" font-style="italic" font-weight="700" fill="#f4dfae" letter-spacing="1">${name.replace(/[<&>"]/g, '').slice(0, 26)}</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 330" width="200" height="330">
<defs><pattern id="chainP" width="5" height="4" patternUnits="userSpaceOnUse"><path d="M0,4 Q2.5,0 5,4" fill="none" stroke="#5f5c56" stroke-width=".9"/></pattern>
<clipPath id="frame"><rect x="9" y="9" width="182" height="288" rx="7"/></clipPath>
<pattern id="grain" width="3" height="3" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="#000" opacity=".05"/><rect x="2" y="1" width="1" height="1" fill="#fff" opacity=".035"/></pattern></defs>
<rect width="200" height="330" rx="10" fill="#3b2213"/><rect x="3" y="3" width="194" height="324" rx="8" fill="none" stroke="#c99a4a" stroke-width="2"/>
<g clip-path="url(#frame)">${backdropSvg(lk.backdrop)}${figure}<rect x="9" y="9" width="182" height="288" fill="url(#grain)"/></g>
<rect x="9" y="9" width="182" height="288" rx="7" fill="none" stroke="#c99a4a" stroke-width="2.4"/><rect x="12" y="12" width="176" height="282" rx="5" fill="none" stroke="#2a170e" stroke-width="1"/>
<path d="M30,302 L170,302 L178,312 L170,323 L30,323 L22,312 Z" fill="#5a3218" stroke="#c99a4a" stroke-width="1.6"/>${title}
</svg>`;
}

/** Dibuja el retrato en un lienzo. Con toque pixel se dibuja pequeño y se amplía sin suavizar. */
export function renderPortrait(lk: AvatarLook, name: string, out: HTMLCanvasElement, displayScale = 2): Promise<void> {
  const svg = portraitSvg(lk, name);
  const img = new Image();
  const factor = lk.pixel === 2 ? 0.55 : lk.pixel === 1 ? 1 : displayScale;
  return new Promise((resolve, reject) => {
    img.onload = () => {
      const w = Math.round(200 * factor); const h = Math.round(330 * factor);
      const small = document.createElement('canvas');
      small.width = w; small.height = h;
      const sctx = small.getContext('2d')!;
      sctx.imageSmoothingEnabled = true;
      sctx.drawImage(img, 0, 0, w, h);
      out.width = 200 * displayScale; out.height = 330 * displayScale;
      const ctx = out.getContext('2d')!;
      ctx.imageSmoothingEnabled = lk.pixel === 0;
      ctx.drawImage(small, 0, 0, out.width, out.height);
      resolve();
    };
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/** Imagen del retrato para la hoja y miniatura de la cara para la barra superior */
export async function portraitDataUrl(lk: AvatarLook, name: string): Promise<{ full: string; thumb: string }> {
  const c = document.createElement('canvas');
  // Sin toque pixel: imagen grande y suave; con toque pixel: tamaño natural, la hoja lo amplía sin suavizar
  const k = lk.pixel === 0 ? 2 : lk.pixel === 2 ? 0.55 : 1;
  await renderPortrait(lk, name, c, k);
  const full = lk.pixel === 0 ? c.toDataURL('image/jpeg', 0.9) : c.toDataURL('image/png');
  // Miniatura: un cuadrado alrededor de la cabeza (la figura se escala desde los pies)
  const scale = Math.min(1.1, BODIES[lk.body % BODIES.length].h * lk.height);
  const headY = FOOT - (FOOT - 58) * scale;
  const size = 64 * scale;
  const t = document.createElement('canvas');
  t.width = 96; t.height = 96;
  const ctx = t.getContext('2d')!;
  ctx.imageSmoothingEnabled = lk.pixel === 0;
  ctx.drawImage(c, (100 - size / 2) * k, (headY - size / 2) * k, size * k, size * k, 0, 0, 96, 96);
  return { full, thumb: t.toDataURL('image/png') };
}

/** Aspecto inicial según especie y clase */
export function defaultLook(speciesId: string | undefined, lineageId: string | undefined, classId: string): AvatarLook {
  const cls = OUTFITS[classId] ? classId : 'guerrero';
  // Colores típicos de cada clase: principal, secundario y detalles
  const pal: Record<string, [number, number, number]> = {
    barbaro: [9, 10, 1], bardo: [8, 2, 1], clerigo: [12, 2, 2], druida: [3, 9, 1], guerrero: [0, 9, 2], monje: [1, 10, 0],
    paladin: [6, 12, 2], explorador: [4, 9, 2], picaro: [10, 13, 0], hechicero: [0, 7, 1], brujo: [7, 10, 3], mago: [6, 7, 2],
  };
  const [pm, ps, pa] = pal[cls] ?? [0, 9, 2];
  const base: AvatarLook = {
    v: 2, face: 0, body: 1, hair: 3, beard: 0, outfitClass: cls, outfit: 0, noHat: false, backdrop: 0,
    skin: SKINS[1], hairColor: HAIR_COLORS[2], eyes: EYE_COLORS[0], main: CLOTH_COLORS[pm], second: CLOTH_COLORS[ps], accent: CLOTH_COLORS[pa],
    ears: 'round', horns: false, tusks: false, snout: false, halo: false, height: 1, pixel: 1,
  };
  const dragon: Record<string, string> = { black: '#3a3a3a', blue: '#4f74a8', brass: '#c9a24a', bronze: '#a8743a', copper: '#b8673a', gold: '#d9b44a', green: '#5f8a4a', red: '#a8402e', silver: '#b8bcc4', white: '#e6e4dc' };
  switch (speciesId) {
    case 'elfo': return { ...base, ears: 'pointy', body: 0, face: 0, hair: 2, hairColor: lineageId === 'drow' ? HAIR_COLORS[6] : HAIR_COLORS[4], skin: lineageId === 'drow' ? '#5b4a6e' : SKINS[0], backdrop: 2 };
    case 'enano': return { ...base, body: 4, face: 1, beard: 5, hair: 1, hairColor: HAIR_COLORS[5], skin: SKINS[2], height: 0.9, backdrop: 5 };
    case 'orco': return { ...base, body: 2, face: 6, tusks: true, skin: SKINS[7], hair: 6, hairColor: HAIR_COLORS[0] };
    case 'tiefling': return { ...base, horns: true, skin: SKINS[9], hair: 2, hairColor: HAIR_COLORS[0], eyes: EYE_COLORS[4], backdrop: 3 };
    case 'draconido': return { ...base, snout: true, horns: true, hair: 0, body: 2, skin: dragon[lineageId ?? 'red'] ?? dragon.red, eyes: EYE_COLORS[4] };
    case 'goliat': return { ...base, body: 9, face: 1, hair: 0, skin: SKINS[13], backdrop: 1 };
    case 'gnomo': return { ...base, ears: 'pointy', body: 7, face: 2, hair: 8, hairColor: HAIR_COLORS[5], skin: SKINS[0], height: 0.86, backdrop: 2 };
    case 'mediano': return { ...base, body: 7, face: 9, hair: 8, hairColor: HAIR_COLORS[3], height: 0.86, backdrop: 4 };
    case 'aasimar': return { ...base, halo: true, face: 7, hair: 2, hairColor: HAIR_COLORS[6], skin: SKINS[0], eyes: EYE_COLORS[4], backdrop: 7 };
    default: return base;
  }
}

/** Aspecto aleatorio (respetando los rasgos de la especie y la clase) */
export function randomLook(prev: AvatarLook): AvatarLook {
  const n = (k: number) => Math.floor(Math.random() * k);
  const pick = <X,>(a: readonly X[]) => a[n(a.length)];
  return {
    ...prev, face: n(FACES.length), body: n(BODIES.length), hair: prev.snout ? 0 : n(HAIRS.length), beard: prev.snout ? 0 : pick([0, 0, 0, 1, 2, 3, 4, 5]),
    outfit: n(10), backdrop: n(BACKDROPS.length), hairColor: pick(HAIR_COLORS), eyes: pick(EYE_COLORS),
    main: pick(CLOTH_COLORS), second: pick(CLOTH_COLORS), accent: pick(CLOTH_COLORS), noHat: false,
  };
}

/** Texto corto con los datos físicos («120 años · 1,70 m · ojos verdes…») */
export function physicalLine(p?: Physical) {
  if (!p) return '';
  return [
    p.age && T(`${p.age} años`, `${p.age} years old`), p.height, p.weight,
    p.eyes && T(`ojos ${p.eyes}`, `${p.eyes} eyes`), p.hair && T(`pelo ${p.hair}`, `${p.hair} hair`), p.skin && T(`piel ${p.skin}`, `${p.skin} skin`),
  ].filter(Boolean).join(' · ');
}
