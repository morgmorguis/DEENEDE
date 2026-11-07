// Monstruos habituales del System Reference Document 5.2 (CC-BY-4.0) para que el DM los añada al
// combate. Solo lo necesario para llevar el combate: CA, PG (media y dados), iniciativa y VD. El DM
// puede editar cualquier valor desde su pantalla.
import type { Tr } from '../i18n';

export interface MonsterInfo {
  id: string;
  name: Tr;
  cr: string;
  ac: number;
  hp: number;
  dice: string;
  init: number;
  type: Tr;
  /** Ataque principal: nombre, bonificador y daño (orientativo; el DM puede cambiarlo) */
  atk?: [Tr, number, string];
}

const r = (es: string, en: string): Tr => ({ es, en });
const HUM = r('Humanoide', 'Humanoid');
const BEAST = r('Bestia', 'Beast');
const UND = r('Muerto viviente', 'Undead');
const MON = r('Monstruosidad', 'Monstrosity');
const GIANT = r('Gigante', 'Giant');
const FIEND = r('Infernal', 'Fiend');
const ELEM = r('Elemental', 'Elemental');
const DRAGON = r('Dragón', 'Dragon');
const CONSTRUCT = r('Constructo', 'Construct');
const FEY = r('Feérico', 'Fey');
const OOZE = r('Cieno', 'Ooze');
const ABER = r('Aberración', 'Aberration');
const m = (id: string, es: string, en: string, cr: string, ac: number, hp: number, dice: string, init: number, type: Tr): MonsterInfo => ({ id, name: r(es, en), cr, ac, hp, dice, init, type });
/** Monstruo con ataque principal */
const ma = (id: string, es: string, en: string, cr: string, ac: number, hp: number, dice: string, init: number, type: Tr, atkEs: string, atkEn: string, bonus: number, dmg: string): MonsterInfo => ({ ...m(id, es, en, cr, ac, hp, dice, init, type), atk: [r(atkEs, atkEn), bonus, dmg] });

export const MONSTERS: MonsterInfo[] = [
  ma('commoner', 'Plebeyo', 'Commoner', '0', 10, 4, '1d8', 0, HUM, 'Garrote', 'Club', 2, '1d4'),
  ma('rat', 'Rata gigante', 'Giant Rat', '1/8', 13, 7, '2d6', 3, BEAST, 'Mordisco', 'Bite', 5, '1d4+3'),
  ma('stirge', 'Estirge', 'Stirge', '1/8', 13, 5, '2d4', 3, BEAST, 'Probóscide', 'Proboscis', 5, '1d4+3'),
  ma('kobold', 'Kobold guerrero', 'Kobold Warrior', '1/8', 14, 7, '3d6-3', 2, HUM, 'Daga', 'Dagger', 4, '1d4+2'),
  ma('bandit', 'Bandido', 'Bandit', '1/8', 12, 11, '2d8+2', 1, HUM, 'Cimitarra', 'Scimitar', 3, '1d6+1'),
  ma('guard', 'Guardia', 'Guard', '1/8', 16, 11, '2d8+2', 1, HUM, 'Lanza', 'Spear', 3, '1d6+1'),
  ma('cultist', 'Sectario', 'Cultist', '1/8', 12, 9, '2d8', 1, HUM, 'Daga ritual', 'Ritual Sickle', 3, '1d4+1'),
  ma('goblin', 'Goblin guerrero', 'Goblin Warrior', '1/4', 15, 10, '3d6', 2, r('Feérico', 'Fey'), 'Cimitarra', 'Scimitar', 4, '1d6+2'),
  ma('skeleton', 'Esqueleto', 'Skeleton', '1/4', 14, 13, '2d8+4', 3, UND, 'Espada corta', 'Shortsword', 5, '1d6+3'),
  ma('zombie', 'Zombi', 'Zombie', '1/4', 8, 15, '2d8+6', -2, UND, 'Golpe', 'Slam', 3, '1d8+1'),
  ma('wolf', 'Lobo', 'Wolf', '1/4', 12, 11, '2d8+2', 2, BEAST, 'Mordisco', 'Bite', 4, '1d6+2'),
  ma('giant_spider_small', 'Araña lobo gigante', 'Giant Wolf Spider', '1/4', 13, 11, '2d8+2', 3, BEAST, 'Mordisco', 'Bite', 5, '1d4+3'),
  ma('hobgoblin', 'Hobgoblin guerrero', 'Hobgoblin Warrior', '1/2', 18, 11, '2d8+2', 1, r('Feérico', 'Fey'), 'Espada larga', 'Longsword', 3, '2d10+1'),
  ma('gnoll', 'Gnoll guerrero', 'Gnoll Warrior', '1/2', 15, 27, '6d8', 1, FIEND, 'Lanza', 'Spear', 4, '1d8+2'),
  ma('shadow', 'Sombra', 'Shadow', '1/2', 12, 27, '6d8', 2, UND, 'Toque drenante', 'Draining Swipe', 4, '2d6+2'),
  ma('thug', 'Matón', 'Tough', '1/2', 12, 32, '5d8+10', 1, HUM, 'Maza', 'Mace', 4, '1d6+2'),
  ma('scout', 'Explorador', 'Scout', '1/2', 13, 16, '3d8+3', 2, HUM, 'Arco largo', 'Longbow', 4, '1d8+2'),
  ma('goblin_boss', 'Jefe goblin', 'Goblin Boss', '1', 17, 21, '6d6', 2, r('Feérico', 'Fey'), 'Cimitarra', 'Scimitar', 4, '1d6+2'),
  ma('bugbear', 'Osgo guerrero', 'Bugbear Warrior', '1', 14, 33, '6d8+6', 2, r('Feérico', 'Fey'), 'Lucero del alba', 'Morningstar', 4, '2d6+2'),
  ma('dire_wolf', 'Lobo terrible', 'Dire Wolf', '1', 14, 22, '3d10+6', 2, BEAST, 'Mordisco', 'Bite', 5, '1d10+3'),
  ma('ghoul', 'Necrófago', 'Ghoul', '1', 12, 22, '5d8', 2, UND, 'Garras', 'Claw', 4, '1d4+2'),
  ma('giant_spider', 'Araña gigante', 'Giant Spider', '1', 14, 26, '4d10+4', 3, BEAST, 'Mordisco', 'Bite', 5, '1d8+3'),
  ma('brown_bear', 'Oso pardo', 'Brown Bear', '1', 11, 22, '3d10+6', 1, BEAST, 'Zarpazo', 'Claw', 5, '2d6+3'),
  ma('imp', 'Diablillo', 'Imp', '1', 13, 21, '6d4+6', 3, FIEND, 'Aguijón', 'Sting', 5, '1d6+3'),
  ma('specter', 'Espectro', 'Specter', '1', 12, 22, '5d8', 2, UND, 'Toque vital', 'Life Drain', 4, '3d6'),
  ma('priest', 'Sacerdote', 'Priest', '2', 13, 38, '7d8+7', 0, HUM, 'Maza', 'Mace', 5, '1d6+3'),
  ma('ogre', 'Ogro', 'Ogre', '2', 11, 68, '8d10+24', -1, GIANT, 'Gran garrote', 'Greatclub', 6, '2d8+4'),
  ma('bandit_captain', 'Capitán bandido', 'Bandit Captain', '2', 15, 52, '8d8+16', 3, HUM, 'Cimitarra', 'Scimitar', 5, '1d6+3'),
  ma('gelatinous_cube', 'Cubo gelatinoso', 'Gelatinous Cube', '2', 6, 63, '6d10+30', -4, r('Cieno', 'Ooze'), 'Pseudópodo', 'Pseudopod', 4, '3d6'),
  ma('mimic', 'Mímico', 'Mimic', '2', 12, 58, '9d8+18', 1, MON, 'Mordisco', 'Bite', 5, '1d8+3'),
  ma('ghost', 'Fantasma', 'Ghost', '4', 11, 45, '10d8', 1, UND, 'Toque marchitador', 'Withering Touch', 5, '3d10+3'),
  ma('owlbear', 'Osolechuza', 'Owlbear', '3', 13, 59, '7d10+21', 1, MON, 'Zarpazo', 'Rend', 7, '2d8+5'),
  ma('veteran', 'Guerrero veterano', 'Warrior Veteran', '3', 17, 65, '10d8+20', 1, HUM, 'Espada larga', 'Longsword', 5, '1d8+3'),
  ma('basilisk', 'Basilisco', 'Basilisk', '3', 15, 52, '8d8+16', -1, MON, 'Mordisco', 'Bite', 5, '2d6+3'),
  ma('wight', 'Tumulario', 'Wight', '3', 14, 82, '11d8+33', 2, UND, 'Espada larga', 'Longsword', 4, '1d8+2'),
  ma('minotaur', 'Minotauro', 'Minotaur', '3', 14, 85, '10d10+30', 0, MON, 'Gran hacha', 'Gore', 6, '2d12+4'),
  ma('hell_hound', 'Sabueso infernal', 'Hell Hound', '3', 15, 58, '7d8+21', 1, FIEND, 'Mordisco', 'Bite', 5, '1d8+3'),
  ma('manticore', 'Mantícora', 'Manticore', '3', 14, 68, '8d10+24', 3, MON, 'Garras', 'Claw', 5, '1d6+3'),
  ma('mage', 'Mago', 'Mage', '6', 15, 81, '18d8', 2, HUM, 'Rayo arcano', 'Arcane Burst', 6, '3d8+3'),
  ma('troll', 'Trol', 'Troll', '5', 15, 94, '9d10+45', 1, GIANT, 'Garras', 'Rend', 7, '2d6+4'),
  ma('young_red_dragon', 'Dragón rojo joven', 'Young Red Dragon', '10', 18, 178, '17d10+85', 0, r('Dragón', 'Dragon'), 'Desgarrar', 'Rend', 10, '2d10+6'),
  // Más criaturas habituales (valores orientativos del SRD; ajústalos a tu mesa)
  ma('swarm_rats', 'Enjambre de ratas', 'Swarm of Rats', '1/4', 10, 14, '4d8-4', 0, BEAST, 'Mordiscos', 'Bites', 2, '2d6'),
  ma('giant_bat', 'Murciélago gigante', 'Giant Bat', '1/4', 13, 22, '4d10', 3, BEAST, 'Mordisco', 'Bite', 4, '1d6+2'),
  ma('pseudodragon', 'Pseudodragón', 'Pseudodragon', '1/4', 14, 10, '3d4+3', 2, DRAGON, 'Aguijón', 'Sting', 4, '1d4+2'),
  ma('sprite', 'Duendecillo', 'Sprite', '1/4', 15, 10, '4d4', 4, FEY, 'Arco corto', 'Shortbow', 6, '1d4'),
  ma('dretch', 'Dretch', 'Dretch', '1/4', 11, 18, '4d6+4', 0, FIEND, 'Garras', 'Claws', 2, '1d6'),
  ma('crocodile', 'Cocodrilo', 'Crocodile', '1/2', 12, 13, '2d10+2', 0, BEAST, 'Mordisco', 'Bite', 4, '1d8+2'),
  ma('black_bear', 'Oso negro', 'Black Bear', '1/2', 11, 19, '3d8+6', 0, BEAST, 'Zarpazos', 'Rend', 4, '1d6+2'),
  ma('worg', 'Huargo', 'Worg', '1/2', 13, 26, '4d10+4', 1, FEY, 'Mordisco', 'Bite', 5, '2d6+3'),
  ma('satyr', 'Sátiro', 'Satyr', '1/2', 14, 31, '7d8', 3, FEY, 'Embestida', 'Ram', 5, '1d6+3'),
  ma('sahuagin', 'Sahuagin', 'Sahuagin', '1/2', 12, 22, '4d8+4', 0, FIEND, 'Garras', 'Claws', 3, '1d6+1'),
  ma('lizardfolk', 'Hombre lagarto', 'Lizardfolk', '1/2', 15, 22, '4d8+4', 0, HUM, 'Mordisco', 'Bite', 4, '1d6+2'),
  ma('harpy', 'Arpía', 'Harpy', '1', 11, 38, '7d8+7', 1, MON, 'Garras', 'Claws', 3, '2d4+1'),
  ma('animated_armor', 'Armadura animada', 'Animated Armor', '1', 18, 33, '6d8+6', 0, CONSTRUCT, 'Golpe', 'Slam', 4, '1d6+2'),
  ma('quasit', 'Quasit', 'Quasit', '1', 13, 25, '10d4', 3, FIEND, 'Garras', 'Claws', 5, '1d4+3'),
  ma('berserker', 'Berserker', 'Berserker', '2', 13, 67, '9d8+27', 1, HUM, 'Gran hacha', 'Greataxe', 5, '1d12+3'),
  ma('gargoyle', 'Gárgola', 'Gargoyle', '2', 15, 67, '9d8+27', 0, ELEM, 'Garras', 'Claw', 4, '1d6+2'),
  ma('griffon', 'Grifo', 'Griffon', '2', 12, 59, '7d10+21', 2, MON, 'Garras', 'Rend', 6, '1d8+4'),
  ma('ghast', 'Ghast', 'Ghast', '2', 13, 36, '8d8', 3, UND, 'Garras', 'Claw', 5, '2d6+3'),
  ma('wererat', 'Hombre rata', 'Wererat', '2', 13, 60, '11d8+11', 3, MON, 'Espada corta', 'Shortsword', 5, '1d6+3'),
  ma('werewolf', 'Hombre lobo', 'Werewolf', '3', 15, 71, '11d8+22', 2, MON, 'Garras', 'Scratch', 5, '2d4+3'),
  ma('knight', 'Caballero', 'Knight', '3', 18, 52, '8d8+16', 0, HUM, 'Espadón', 'Greatsword', 5, '2d6+3'),
  ma('doppelganger', 'Doppelganger', 'Doppelganger', '3', 14, 52, '8d8+16', 4, MON, 'Golpe', 'Slam', 6, '1d6+4'),
  ma('green_hag', 'Saga verde', 'Green Hag', '3', 17, 82, '11d8+33', 1, FEY, 'Garras', 'Claw', 6, '2d8+4'),
  ma('phase_spider', 'Araña de fase', 'Phase Spider', '3', 14, 45, '7d10+7', 3, MON, 'Mordisco', 'Bite', 5, '1d10+3'),
  ma('banshee', 'Banshee', 'Banshee', '4', 12, 54, '12d8', 2, UND, 'Toque corruptor', 'Corrupting Touch', 4, '3d6+2'),
  ma('black_pudding', 'Pudin negro', 'Black Pudding', '4', 7, 68, '8d10+24', -3, OOZE, 'Seudópodo', 'Pseudopod', 5, '3d6+3'),
  ma('ettin', 'Ettin', 'Ettin', '4', 12, 85, '10d10+30', -1, GIANT, 'Hacha de batalla', 'Battleaxe', 7, '2d8+5'),
  ma('air_elemental', 'Elemental del aire', 'Air Elemental', '5', 15, 90, '12d10+24', 5, ELEM, 'Golpe', 'Thunderous Slam', 8, '2d8+5'),
  ma('earth_elemental', 'Elemental de tierra', 'Earth Elemental', '5', 17, 147, '14d10+70', -1, ELEM, 'Golpe', 'Slam', 8, '2d8+5'),
  ma('fire_elemental', 'Elemental de fuego', 'Fire Elemental', '5', 13, 93, '11d10+33', 3, ELEM, 'Toque abrasador', 'Burn', 6, '2d6+3'),
  ma('water_elemental', 'Elemental del agua', 'Water Elemental', '5', 14, 114, '12d10+48', 2, ELEM, 'Golpe', 'Slam', 7, '2d8+4'),
  ma('hill_giant', 'Gigante de las colinas', 'Hill Giant', '5', 13, 105, '10d12+40', -1, GIANT, 'Garrote', 'Tree Club', 8, '3d8+5'),
  ma('vampire_spawn', 'Engendro vampírico', 'Vampire Spawn', '5', 16, 90, '12d8+36', 3, UND, 'Mordisco', 'Bite', 6, '1d4+3'),
  ma('wraith', 'Aparecido', 'Wraith', '5', 13, 67, '9d8+27', 3, UND, 'Toque vital', 'Life Drain', 6, '4d8+3'),
  ma('gladiator', 'Gladiador', 'Gladiator', '5', 16, 112, '15d8+45', 2, HUM, 'Lanza', 'Spear', 7, '2d6+4'),
  ma('otyugh', 'Otyugh', 'Otyugh', '5', 14, 104, '11d10+44', 0, ABER, 'Tentáculo', 'Tentacle', 6, '1d8+3'),
  ma('wyvern', 'Guiverno', 'Wyvern', '6', 14, 127, '15d10+45', 0, DRAGON, 'Aguijón', 'Sting', 7, '2d6+4'),
  ma('chimera', 'Quimera', 'Chimera', '6', 14, 114, '12d10+48', 0, MON, 'Mordisco', 'Bite', 7, '2d6+4'),
  ma('medusa', 'Medusa', 'Medusa', '6', 15, 127, '17d8+51', 2, MON, 'Garras', 'Claw', 5, '2d6+2'),
  ma('young_white_dragon', 'Dragón blanco joven', 'Young White Dragon', '6', 17, 123, '13d10+52', 0, DRAGON, 'Desgarrar', 'Rend', 7, '2d6+4'),
  ma('young_black_dragon', 'Dragón negro joven', 'Young Black Dragon', '7', 18, 127, '15d10+45', 2, DRAGON, 'Desgarrar', 'Rend', 7, '2d6+4'),
  ma('stone_giant', 'Gigante de piedra', 'Stone Giant', '7', 17, 126, '11d12+55', 2, GIANT, 'Garrote', 'Stone Club', 9, '3d10+6'),
  ma('young_green_dragon', 'Dragón verde joven', 'Young Green Dragon', '8', 18, 136, '16d10+48', 1, DRAGON, 'Desgarrar', 'Rend', 7, '2d6+4'),
  ma('frost_giant', 'Gigante de escarcha', 'Frost Giant', '8', 15, 149, '13d12+65', -1, GIANT, 'Hacha de escarcha', 'Frost Axe', 9, '2d12+6'),
  ma('hydra', 'Hidra', 'Hydra', '8', 15, 184, '16d12+80', 1, MON, 'Mordisco', 'Bite', 8, '1d10+5'),
  ma('assassin', 'Asesino', 'Assassin', '8', 16, 97, '15d8+30', 4, HUM, 'Espada corta', 'Shortsword', 7, '1d6+4'),
  ma('young_blue_dragon', 'Dragón azul joven', 'Young Blue Dragon', '9', 18, 152, '16d10+64', 0, DRAGON, 'Desgarrar', 'Rend', 9, '2d10+5'),
  ma('fire_giant', 'Gigante de fuego', 'Fire Giant', '9', 18, 162, '13d12+78', -1, GIANT, 'Espada llameante', 'Flame Sword', 11, '4d6+7'),
  ma('cloud_giant', 'Gigante de las nubes', 'Cloud Giant', '9', 14, 200, '16d12+96', 0, GIANT, 'Lucero del alba', 'Thunderous Mace', 12, '3d8+8'),
  ma('aboleth', 'Aboleth', 'Aboleth', '10', 17, 150, '20d10+40', -1, ABER, 'Tentáculo', 'Tentacle', 9, '2d6+5'),
  ma('stone_golem', 'Gólem de piedra', 'Stone Golem', '10', 18, 220, '21d10+105', -1, CONSTRUCT, 'Golpe', 'Slam', 10, '3d8+6'),
  ma('archmage', 'Archimago', 'Archmage', '12', 17, 170, '31d8+31', 2, HUM, 'Ráfaga arcana', 'Arcane Burst', 9, '4d10+5'),
  ma('adult_red_dragon', 'Dragón rojo adulto', 'Adult Red Dragon', '17', 19, 256, '19d12+133', 4, DRAGON, 'Desgarrar', 'Rend', 14, '2d8+8'),
  ma('lich', 'Liche', 'Lich', '21', 20, 315, '42d8+126', 7, UND, 'Toque escalofriante', 'Eldritch Burst', 12, '4d12+5'),
];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const searchMonsters = (q: string) => {
  const k = norm(q.trim());
  return k ? MONSTERS.filter((x) => norm(x.name.es).includes(k) || norm(x.name.en).includes(k)) : MONSTERS;
};
