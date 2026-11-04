// Especies de D&D 2024 (SRD 5.2) con sus linajes o ascendencias: alto elfo, drow, dracónido de cada
// color, gigante de cada tipo para los goliat, legado infernal de los tiefling… Al elegirlos en la
// hoja se ponen su velocidad, tamaño, resistencias, rasgos y trucos.
import type { Character, DamageType } from '../types';
import { L, T, type Tr } from '../i18n';
import { addDbSpell } from './levelup';

export interface Trait { name: Tr; text: Tr }
export interface Lineage { id: string; name: Tr; traits: Trait[]; resist?: DamageType[]; speed?: number; spells?: string[] }
export interface SpeciesInfo {
  id: string;
  name: Tr;
  size: 'medium' | 'small' | 'either';
  speed: number;
  traits: Trait[];
  resist?: DamageType[];
  spells?: string[];
  lineageLabel?: Tr;
  lineages?: Lineage[];
}

const r = (es: string, en: string): Tr => ({ es, en });
const t = (es: string, en: string, tes: string, ten: string): Trait => ({ name: r(es, en), text: r(tes, ten) });
const DARK60 = t('Visión en la oscuridad', 'Darkvision', 'Ves en penumbra a 60 pies como si hubiera luz brillante, y en la oscuridad como en penumbra.', 'You see in dim light within 60 feet as if it were bright light, and in darkness as if it were dim light.');
const DARK120 = t('Visión en la oscuridad', 'Darkvision', 'Visión en la oscuridad a 120 pies.', 'Darkvision 120 feet.');

const dragon = (id: string, es: string, en: string, type: DamageType, tes: string, ten: string): Lineage => ({
  id, name: r(es, en), resist: [type],
  traits: [t('Ascendencia dracónica', 'Draconic Ancestry', `Dragón ${es.toLowerCase()}: tu Arma de aliento y tu resistencia son de ${tes}.`, `${en} dragon: your Breath Weapon and Damage Resistance use ${ten} damage.`)],
});
const giant = (id: string, es: string, en: string, tes: string, ten: string): Lineage => ({
  id, name: r(es, en), traits: [t(es, en, tes, ten)],
});

export const SPECIES_INFO: SpeciesInfo[] = [
  {
    id: 'aasimar', name: r('Aasimar', 'Aasimar'), size: 'either', speed: 30, resist: ['necrotico', 'radiante'], spells: ['Light'],
    traits: [
      t('Resistencia celestial', 'Celestial Resistance', 'Resistencia al daño necrótico y radiante.', 'Resistance to Necrotic and Radiant damage.'),
      DARK60,
      t('Manos curativas', 'Healing Hands', 'Acción Magia: tocas a una criatura y tiras tantos d4 como tu bonificador de competencia; recupera esos PG. Una vez por descanso largo.', 'Magic action: touch a creature and roll d4s equal to your Proficiency Bonus; it regains that many HP. Once per Long Rest.'),
      t('Portador de luz', 'Light Bearer', 'Conoces el truco Luz (CAR).', 'You know the Light cantrip (CHA).'),
      t('Revelación celestial', 'Celestial Revelation', 'Desde nivel 3, acción adicional: alas celestiales, mortaja interior o velo necrótico durante 1 minuto, con daño extra.', 'From level 3, Bonus Action: Heavenly Wings, Inner Radiance or Necrotic Shroud for 1 minute, with extra damage.'),
    ],
  },
  {
    id: 'draconido', name: r('Dracónido', 'Dragonborn'), size: 'medium', speed: 30,
    traits: [
      t('Arma de aliento', 'Breath Weapon', 'Sustituye un ataque: cono de 15 pies o línea de 30; salvación de DES (CD 8 + CON + competencia) o 1d10 de daño de tu ascendencia (2d10 a nivel 5, 3d10 a 11, 4d10 a 17). Usos = bonificador de competencia por descanso largo.', 'Replaces an attack: 15-ft cone or 30-ft line; DEX save (DC 8 + CON + PB) or 1d10 damage of your ancestry (2d10 at 5, 3d10 at 11, 4d10 at 17). Uses = PB per Long Rest.'),
      DARK60,
      t('Vuelo dracónico', 'Draconic Flight', 'Desde nivel 5, acción adicional: alas espectrales durante 10 minutos (velocidad de vuelo igual a tu Velocidad). Una vez por descanso largo.', 'From level 5, Bonus Action: spectral wings for 10 minutes (Fly Speed equal to your Speed). Once per Long Rest.'),
    ],
    lineageLabel: r('Ascendencia', 'Ancestry'),
    lineages: [
      dragon('black', 'Negro', 'Black', 'acido', 'ácido', 'Acid'), dragon('blue', 'Azul', 'Blue', 'relampago', 'relámpago', 'Lightning'),
      dragon('brass', 'Latón', 'Brass', 'fuego', 'fuego', 'Fire'), dragon('bronze', 'Bronce', 'Bronze', 'relampago', 'relámpago', 'Lightning'),
      dragon('copper', 'Cobre', 'Copper', 'acido', 'ácido', 'Acid'), dragon('gold', 'Oro', 'Gold', 'fuego', 'fuego', 'Fire'),
      dragon('green', 'Verde', 'Green', 'veneno', 'veneno', 'Poison'), dragon('red', 'Rojo', 'Red', 'fuego', 'fuego', 'Fire'),
      dragon('silver', 'Plata', 'Silver', 'frio', 'frío', 'Cold'), dragon('white', 'Blanco', 'White', 'frio', 'frío', 'Cold'),
    ],
  },
  {
    id: 'enano', name: r('Enano', 'Dwarf'), size: 'medium', speed: 30, resist: ['veneno'],
    traits: [
      DARK120,
      t('Resistencia enana', 'Dwarven Resilience', 'Resistencia al daño de veneno y ventaja en salvaciones para evitar o terminar el estado Envenenado.', 'Resistance to Poison damage and Advantage on saves to avoid or end the Poisoned condition.'),
      t('Dureza enana', 'Dwarven Toughness', '+1 PG máximo por nivel.', '+1 Hit Point maximum per level.'),
      t('Afinidad con la piedra', 'Stonecunning', 'Acción adicional: Sentido de la vibración a 60 pies durante 10 minutos sobre piedra. Usos = competencia por descanso largo.', 'Bonus Action: Tremorsense 60 ft for 10 minutes on stone. Uses = PB per Long Rest.'),
    ],
  },
  {
    id: 'elfo', name: r('Elfo', 'Elf'), size: 'medium', speed: 30,
    traits: [
      DARK60,
      t('Ascendencia feérica', 'Fey Ancestry', 'Ventaja en salvaciones para evitar o terminar el estado Hechizado.', 'Advantage on saves to avoid or end the Charmed condition.'),
      t('Sentidos agudos', 'Keen Senses', 'Competencia en Perspicacia, Percepción o Supervivencia.', 'Proficiency in Insight, Perception or Survival.'),
      t('Trance', 'Trance', 'No necesitas dormir; un descanso largo te lleva 4 horas de trance.', 'You don’t need to sleep; a Long Rest takes 4 hours of trance.'),
    ],
    lineageLabel: r('Linaje', 'Lineage'),
    lineages: [
      { id: 'drow', name: r('Drow', 'Drow'), traits: [t('Linaje drow', 'Drow Lineage', 'Visión en la oscuridad a 120 pies. Truco Luces danzantes; a nivel 3 Fuego feérico y a nivel 5 Oscuridad, una vez por descanso largo.', 'Darkvision 120 ft. Dancing Lights cantrip; Faerie Fire at level 3 and Darkness at level 5, once per Long Rest each.')] },
      { id: 'high', name: r('Alto elfo', 'High Elf'), traits: [t('Linaje de alto elfo', 'High Elf Lineage', 'Truco Prestidigitación (puedes cambiarlo tras un descanso largo); a nivel 3 Detectar magia y a nivel 5 Paso brumoso, una vez por descanso largo.', 'Prestidigitation cantrip (swappable after a Long Rest); Detect Magic at level 3 and Misty Step at level 5, once per Long Rest each.')], spells: ['Prestidigitation'] },
      { id: 'wood', name: r('Elfo de los bosques', 'Wood Elf'), speed: 35, traits: [t('Linaje de elfo de los bosques', 'Wood Elf Lineage', 'Velocidad 35 pies. Truco Druidismo; a nivel 3 Zancada prodigiosa y a nivel 5 Pasar sin rastro, una vez por descanso largo.', 'Speed 35 ft. Druidcraft cantrip; Longstrider at level 3 and Pass without Trace at level 5, once per Long Rest each.')], spells: ['Druidcraft'] },
    ],
  },
  {
    id: 'gnomo', name: r('Gnomo', 'Gnome'), size: 'small', speed: 30,
    traits: [DARK60, t('Astucia gnoma', 'Gnomish Cunning', 'Ventaja en salvaciones de INT, SAB y CAR.', 'Advantage on INT, WIS and CHA saving throws.')],
    lineageLabel: r('Linaje', 'Lineage'),
    lineages: [
      { id: 'forest', name: r('Gnomo de los bosques', 'Forest Gnome'), traits: [t('Linaje de los bosques', 'Forest Gnome Lineage', 'Truco Ilusión menor y siempre tienes preparado Hablar con los animales (gratis tantas veces como tu competencia por descanso largo).', 'Minor Illusion cantrip and Speak with Animals always prepared (free uses = PB per Long Rest).')], spells: ['Minor Illusion', 'Speak with Animals'] },
      { id: 'rock', name: r('Gnomo de las rocas', 'Rock Gnome'), traits: [t('Linaje de las rocas', 'Rock Gnome Lineage', 'Trucos Remendar y Prestidigitación; puedes crear pequeños mecanismos de relojería.', 'Mending and Prestidigitation cantrips; you can build tiny clockwork devices.')], spells: ['Mending', 'Prestidigitation'] },
    ],
  },
  {
    id: 'goliat', name: r('Goliat', 'Goliath'), size: 'medium', speed: 35,
    traits: [
      t('Forma grande', 'Large Form', 'Desde nivel 5, acción adicional: te vuelves Grande 10 minutos, ventaja en FUE y +10 pies de Velocidad. Una vez por descanso largo.', 'From level 5, Bonus Action: become Large for 10 minutes, Advantage on STR checks and +10 ft Speed. Once per Long Rest.'),
      t('Constitución poderosa', 'Powerful Build', 'Ventaja para terminar el estado Agarrado y cuentas como un tamaño más para cargar.', 'Advantage to end the Grappled condition and you count as one size larger for carrying.'),
    ],
    lineageLabel: r('Ascendencia gigante', 'Giant Ancestry'),
    lineages: [
      giant('cloud', 'Paso de las nubes (gigante de las nubes)', 'Cloud’s Jaunt (Cloud Giant)', 'Acción adicional: te teletransportas hasta 30 pies. Usos = competencia por descanso largo.', 'Bonus Action: teleport up to 30 ft. Uses = PB per Long Rest.'),
      giant('fire', 'Quemadura del fuego (gigante de fuego)', 'Fire’s Burn (Fire Giant)', 'Al impactar, +1d10 de daño de fuego. Usos = competencia por descanso largo.', 'When you hit, +1d10 Fire damage. Uses = PB per Long Rest.'),
      giant('frost', 'Escalofrío de la escarcha (gigante de escarcha)', 'Frost’s Chill (Frost Giant)', 'Al impactar, +1d6 de frío y −10 pies de Velocidad al objetivo. Usos = competencia.', 'When you hit, +1d6 Cold damage and −10 ft Speed to the target. Uses = PB.'),
      giant('hill', 'Derribo de la colina (gigante de las colinas)', 'Hill’s Tumble (Hill Giant)', 'Al impactar a una criatura Grande o menor, la derribas. Usos = competencia.', 'When you hit a Large or smaller creature, knock it Prone. Uses = PB.'),
      giant('stone', 'Aguante de la piedra (gigante de piedra)', 'Stone’s Endurance (Stone Giant)', 'Reacción al recibir daño: lo reduces 1d12 + CON. Usos = competencia.', 'Reaction when you take damage: reduce it by 1d12 + CON. Uses = PB.'),
      giant('storm', 'Trueno de la tormenta (gigante de las tormentas)', 'Storm’s Thunder (Storm Giant)', 'Reacción al recibir daño de alguien a 60 pies: le haces 1d8 de trueno. Usos = competencia.', 'Reaction when damaged by a creature within 60 ft: deal 1d8 Thunder damage to it. Uses = PB.'),
    ],
  },
  {
    id: 'mediano', name: r('Mediano', 'Halfling'), size: 'small', speed: 30,
    traits: [
      t('Valiente', 'Brave', 'Ventaja en salvaciones para evitar o terminar el estado Asustado.', 'Advantage on saves to avoid or end the Frightened condition.'),
      t('Agilidad de mediano', 'Halfling Nimbleness', 'Puedes moverte por el espacio de criaturas de tamaño mayor que el tuyo.', 'You can move through the space of any creature a size larger than you.'),
      t('Suerte', 'Luck', 'Cuando sacas un 1 en una prueba d20, puedes repetirla y usar el nuevo resultado.', 'When you roll a 1 on a D20 Test, you can reroll it and must use the new roll.'),
      t('Sigilo natural', 'Naturally Stealthy', 'Puedes esconderte detrás de criaturas al menos un tamaño mayores.', 'You can take the Hide action even when obscured only by a creature at least one size larger.'),
    ],
  },
  {
    id: 'humano', name: r('Humano', 'Human'), size: 'either', speed: 30,
    traits: [
      t('Ingenioso', 'Resourceful', 'Ganas Inspiración heroica al terminar un descanso largo.', 'You gain Heroic Inspiration whenever you finish a Long Rest.'),
      t('Habilidoso', 'Skillful', 'Competencia en una habilidad a tu elección.', 'Proficiency in one skill of your choice.'),
      t('Versátil', 'Versatile', 'Ganas una dote de origen a tu elección.', 'You gain an Origin feat of your choice.'),
    ],
  },
  {
    id: 'orco', name: r('Orco', 'Orc'), size: 'medium', speed: 30,
    traits: [
      t('Subidón de adrenalina', 'Adrenaline Rush', 'Acción adicional: Correr y ganas PG temporales iguales a tu competencia. Usos = competencia por descanso corto o largo.', 'Bonus Action: Dash and gain Temporary HP equal to your PB. Uses = PB per Short or Long Rest.'),
      DARK120,
      t('Aguante incansable', 'Relentless Endurance', 'Cuando caes a 0 PG sin morir, te quedas con 1 PG. Una vez por descanso largo.', 'When reduced to 0 HP but not killed, you drop to 1 HP instead. Once per Long Rest.'),
    ],
  },
  {
    id: 'tiefling', name: r('Tiefling', 'Tiefling'), size: 'either', speed: 30, spells: ['Thaumaturgy'],
    traits: [DARK60, t('Presencia de otro mundo', 'Otherworldly Presence', 'Conoces el truco Taumaturgia.', 'You know the Thaumaturgy cantrip.')],
    lineageLabel: r('Legado infernal', 'Fiendish Legacy'),
    lineages: [
      { id: 'abyssal', name: r('Abisal', 'Abyssal'), resist: ['veneno'], spells: ['Poison Spray'], traits: [t('Legado abisal', 'Abyssal Legacy', 'Resistencia al veneno y truco Rociada venenosa; Rayo nauseabundo a nivel 3 y Inmovilizar persona a nivel 5.', 'Poison resistance and Poison Spray cantrip; Ray of Sickness at level 3 and Hold Person at level 5.')] },
      { id: 'chthonic', name: r('Ctónico', 'Chthonic'), resist: ['necrotico'], spells: ['Chill Touch'], traits: [t('Legado ctónico', 'Chthonic Legacy', 'Resistencia necrótica y truco Toque helado; Falsa vida a nivel 3 y Rayo debilitante a nivel 5.', 'Necrotic resistance and Chill Touch cantrip; False Life at level 3 and Ray of Enfeeblement at level 5.')] },
      { id: 'infernal', name: r('Infernal', 'Infernal'), resist: ['fuego'], spells: ['Fire Bolt'], traits: [t('Legado infernal', 'Infernal Legacy', 'Resistencia al fuego y truco Descarga de fuego; Reprensión infernal a nivel 3 y Oscuridad a nivel 5.', 'Fire resistance and Fire Bolt cantrip; Hellish Rebuke at level 3 and Darkness at level 5.')] },
    ],
  },
];

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** Reconoce la especie a partir del texto de la ficha («Elfo», «High Elf», «Dracónido rojo»…) */
export function findSpecies(text: string): { species?: SpeciesInfo; lineage?: Lineage } {
  const k0 = fold(text);
  if (!k0) return {};
  // También en femenino: «Enana», «Elfa», «Alta elfa», «Mediana», «Dracónida roja»…
  const k = `${k0} | ${k0.replace(/([a-z]+)a\b/g, '$1o')}`;
  for (const sp of SPECIES_INFO) {
    for (const ln of sp.lineages ?? []) if ([ln.name.es, ln.name.en].some((n) => k.includes(fold(n).split(' (')[0]))) return { species: sp, lineage: ln };
  }
  const species = SPECIES_INFO.find((sp) => [sp.name.es, sp.name.en].some((n) => k.includes(fold(n))));
  return { species };
}

export const speciesLabel = (sp?: SpeciesInfo, ln?: Lineage) => (sp ? (ln ? `${L(sp.name)} (${L(ln.name).split(' (')[0]})` : L(sp.name)) : '');

const traitsText = (sp: SpeciesInfo, ln?: Lineage) => [...sp.traits, ...(ln?.traits ?? [])].map((x) => `${L(x.name)}: ${L(x.text)}`).join('\n');

/**
 * Aplica una especie (y linaje) a la ficha: velocidad, tamaño si no encaja, resistencias, rasgos y trucos.
 * Quita lo que daba la especie anterior para no acumular resistencias.
 */
export function applySpecies(c: Character, speciesId: string, lineageId?: string): Character {
  const next = structuredClone(c);
  const sp = SPECIES_INFO.find((x) => x.id === speciesId);
  if (!sp) return next;
  const ln = sp.lineages?.find((x) => x.id === lineageId);
  const prev = findSpecies(c.species);
  const prevResist = [...(prev.species?.resist ?? []), ...(prev.lineage?.resist ?? [])];
  next.resistances = next.resistances.filter((d) => !prevResist.includes(d));
  for (const d of [...(sp.resist ?? []), ...(ln?.resist ?? [])]) if (!next.resistances.includes(d)) next.resistances.push(d);
  next.species = speciesLabel(sp, ln);
  next.speed = ln?.speed ?? sp.speed;
  if (sp.size === 'small') next.size = T('Pequeño', 'Small');
  else if (sp.size === 'medium') next.size = T('Mediano', 'Medium');
  // Rasgos: se rehacen si estaban vacíos o eran los de la especie anterior
  const prevText = prev.species ? traitsText(prev.species, prev.lineage) : '';
  if (!c.speciesTraits.trim() || c.speciesTraits.trim() === prevText.trim()) next.speciesTraits = traitsText(sp, ln);
  for (const s of [...(sp.spells ?? []), ...(ln?.spells ?? [])]) addDbSpell(next, s, true);
  return next;
}
