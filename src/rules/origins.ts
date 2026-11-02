// Elecciones de origen (nivel 1, reglas 2024): trasfondos con sus habilidades, herramienta, dote y
// características; habilidades que puede elegir cada clase; habilidades que da la especie.
import type { Ability } from '../types';
import type { Tr } from '../i18n';

export interface BackgroundInfo {
  id: string;
  name: Tr;
  abilities: [Ability, Ability, Ability];
  feat: Tr;
  /** La dote Habilidoso deja elegir 3 habilidades más */
  skilledFeat?: boolean;
  skills: [string, string];
  tool: Tr;
}

const r = (es: string, en: string): Tr => ({ es, en });
const b = (id: string, es: string, en: string, abilities: [Ability, Ability, Ability], feat: Tr, skills: [string, string], tool: Tr, skilledFeat = false): BackgroundInfo =>
  ({ id, name: r(es, en), abilities, feat, skills, tool, skilledFeat });

const SKILLED = r('Habilidoso', 'Skilled');
export const BACKGROUNDS: BackgroundInfo[] = [
  b('acolyte', 'Acólito', 'Acolyte', ['int', 'wis', 'cha'], r('Iniciado en la magia (clérigo)', 'Magic Initiate (Cleric)'), ['perspicacia', 'religion'], r('Suministros de calígrafo', 'Calligrapher’s Supplies')),
  b('artisan', 'Artesano', 'Artisan', ['str', 'dex', 'int'], r('Artífice', 'Crafter'), ['investigacion', 'persuasion'], r('Herramientas de artesano (una)', 'Artisan’s Tools (one)')),
  b('charlatan', 'Charlatán', 'Charlatan', ['dex', 'con', 'cha'], SKILLED, ['engano', 'juego_manos'], r('Útiles de falsificación', 'Forgery Kit'), true),
  b('criminal', 'Criminal', 'Criminal', ['dex', 'con', 'int'], r('Alerta', 'Alert'), ['juego_manos', 'sigilo'], r('Herramientas de ladrón', 'Thieves’ Tools')),
  b('entertainer', 'Artista', 'Entertainer', ['str', 'dex', 'cha'], r('Músico', 'Musician'), ['acrobacias', 'interpretacion'], r('Instrumento musical (uno)', 'Musical Instrument (one)')),
  b('farmer', 'Granjero', 'Farmer', ['str', 'con', 'wis'], r('Duro', 'Tough'), ['trato_animales', 'naturaleza'], r('Herramientas de carpintero', 'Carpenter’s Tools')),
  b('guard', 'Guardia', 'Guard', ['str', 'int', 'wis'], r('Alerta', 'Alert'), ['atletismo', 'percepcion'], r('Juego (uno)', 'Gaming Set (one)')),
  b('guide', 'Guía', 'Guide', ['dex', 'con', 'wis'], r('Iniciado en la magia (druida)', 'Magic Initiate (Druid)'), ['sigilo', 'supervivencia'], r('Herramientas de cartógrafo', 'Cartographer’s Tools')),
  b('hermit', 'Ermitaño', 'Hermit', ['con', 'wis', 'cha'], r('Sanador', 'Healer'), ['medicina', 'religion'], r('Útiles de herborista', 'Herbalism Kit')),
  b('merchant', 'Mercader', 'Merchant', ['con', 'int', 'cha'], r('Afortunado', 'Lucky'), ['trato_animales', 'persuasion'], r('Herramientas de navegante', 'Navigator’s Tools')),
  b('noble', 'Noble', 'Noble', ['str', 'int', 'cha'], SKILLED, ['historia', 'persuasion'], r('Juego (uno)', 'Gaming Set (one)'), true),
  b('sage', 'Sabio', 'Sage', ['con', 'int', 'wis'], r('Iniciado en la magia (mago)', 'Magic Initiate (Wizard)'), ['arcanos', 'historia'], r('Suministros de calígrafo', 'Calligrapher’s Supplies')),
  b('sailor', 'Marinero', 'Sailor', ['str', 'dex', 'wis'], r('Camorrista', 'Tavern Brawler'), ['acrobacias', 'percepcion'], r('Herramientas de navegante', 'Navigator’s Tools')),
  b('scribe', 'Escriba', 'Scribe', ['dex', 'int', 'wis'], SKILLED, ['investigacion', 'percepcion'], r('Suministros de calígrafo', 'Calligrapher’s Supplies'), true),
  b('soldier', 'Soldado', 'Soldier', ['str', 'dex', 'con'], r('Atacante salvaje', 'Savage Attacker'), ['atletismo', 'intimidacion'], r('Juego (uno)', 'Gaming Set (one)')),
  b('wayfarer', 'Viajero', 'Wayfarer', ['dex', 'wis', 'cha'], r('Afortunado', 'Lucky'), ['perspicacia', 'sigilo'], r('Herramientas de ladrón', 'Thieves’ Tools')),
];

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
export const findBackground = (text: string) => {
  const k = fold(text);
  return k ? BACKGROUNDS.find((x) => [x.name.es, x.name.en].some((n) => fold(n) === k) || (k === 'trotamundos' && x.id === 'wayfarer')) : undefined;
};

const ALL = ['acrobacias', 'trato_animales', 'arcanos', 'atletismo', 'engano', 'historia', 'perspicacia', 'intimidacion', 'investigacion', 'medicina', 'naturaleza', 'percepcion', 'interpretacion', 'persuasion', 'religion', 'juego_manos', 'sigilo', 'supervivencia'];

/** Cuántas habilidades elige cada clase y de qué lista (Player’s Handbook 2024) */
export const CLASS_SKILLS: Record<string, { count: number; list: string[] }> = {
  barbaro: { count: 2, list: ['trato_animales', 'atletismo', 'intimidacion', 'naturaleza', 'percepcion', 'supervivencia'] },
  bardo: { count: 3, list: ALL },
  clerigo: { count: 2, list: ['historia', 'perspicacia', 'medicina', 'persuasion', 'religion'] },
  druida: { count: 2, list: ['arcanos', 'trato_animales', 'perspicacia', 'medicina', 'naturaleza', 'percepcion', 'religion', 'supervivencia'] },
  guerrero: { count: 2, list: ['acrobacias', 'trato_animales', 'atletismo', 'historia', 'perspicacia', 'intimidacion', 'persuasion', 'percepcion', 'supervivencia'] },
  monje: { count: 2, list: ['acrobacias', 'atletismo', 'historia', 'perspicacia', 'religion', 'sigilo'] },
  paladin: { count: 2, list: ['atletismo', 'perspicacia', 'intimidacion', 'medicina', 'persuasion', 'religion'] },
  explorador: { count: 3, list: ['trato_animales', 'atletismo', 'perspicacia', 'investigacion', 'naturaleza', 'percepcion', 'sigilo', 'supervivencia'] },
  picaro: { count: 4, list: ['acrobacias', 'atletismo', 'engano', 'perspicacia', 'intimidacion', 'investigacion', 'percepcion', 'persuasion', 'juego_manos', 'sigilo'] },
  hechicero: { count: 2, list: ['arcanos', 'engano', 'perspicacia', 'intimidacion', 'persuasion', 'religion'] },
  brujo: { count: 2, list: ['arcanos', 'engano', 'historia', 'intimidacion', 'investigacion', 'naturaleza', 'religion'] },
  mago: { count: 2, list: ['arcanos', 'historia', 'perspicacia', 'investigacion', 'medicina', 'naturaleza', 'religion'] },
};

/** Habilidades que da la especie a elegir: elfo (Sentidos agudos), humano (Habilidoso de especie) */
export const SPECIES_SKILLS: Record<string, { count: number; list: string[]; label: Tr }> = {
  elfo: { count: 1, list: ['perspicacia', 'percepcion', 'supervivencia'], label: r('Sentidos agudos (elfo)', 'Keen Senses (Elf)') },
  humano: { count: 1, list: ALL, label: r('Habilidoso (humano)', 'Skillful (Human)') },
};

export const ALL_SKILLS = ALL;

/** Elecciones de nivel 1 de cada clase con sus opciones */
export interface ClassPick { id: string; title: Tr; text: Tr; options: { id: string; name: Tr; text: Tr }[] }
export const LEVEL1_PICKS: Record<string, ClassPick> = {
  clerigo: {
    id: 'divine_order', title: r('Orden divina', 'Divine Order'), text: r('Elige tu papel en el culto.', 'Choose your role in the faith.'),
    options: [
      { id: 'protector', name: r('Protector', 'Protector'), text: r('Entrenamiento con armadura pesada y competencia con armas marciales.', 'Training with Heavy armor and proficiency with Martial weapons.') },
      { id: 'thaumaturge', name: r('Taumaturgo', 'Thaumaturge'), text: r('Un truco de clérigo más y sumas tu mod. SAB (mín. +1) a Arcanos y Religión.', 'One extra cleric cantrip and add your WIS mod (min +1) to Arcana and Religion.') },
    ],
  },
  druida: {
    id: 'primal_order', title: r('Orden primigenia', 'Primal Order'), text: r('Elige tu forma de servir a la naturaleza.', 'Choose how you serve nature.'),
    options: [
      { id: 'magician', name: r('Mago', 'Magician'), text: r('Un truco de druida más y sumas tu mod. SAB (mín. +1) a Arcanos y Naturaleza.', 'One extra druid cantrip and add your WIS mod (min +1) to Arcana and Nature.') },
      { id: 'warden', name: r('Guardián', 'Warden'), text: r('Competencia con armas marciales y entrenamiento con armadura intermedia.', 'Proficiency with Martial weapons and training with Medium armor.') },
    ],
  },
};
