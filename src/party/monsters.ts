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
}

const r = (es: string, en: string): Tr => ({ es, en });
const HUM = r('Humanoide', 'Humanoid');
const BEAST = r('Bestia', 'Beast');
const UND = r('Muerto viviente', 'Undead');
const MON = r('Monstruosidad', 'Monstrosity');
const GIANT = r('Gigante', 'Giant');
const FIEND = r('Infernal', 'Fiend');
const m = (id: string, es: string, en: string, cr: string, ac: number, hp: number, dice: string, init: number, type: Tr): MonsterInfo => ({ id, name: r(es, en), cr, ac, hp, dice, init, type });

export const MONSTERS: MonsterInfo[] = [
  m('commoner', 'Plebeyo', 'Commoner', '0', 10, 4, '1d8', 0, HUM),
  m('rat', 'Rata gigante', 'Giant Rat', '1/8', 13, 7, '2d6', 3, BEAST),
  m('stirge', 'Estirge', 'Stirge', '1/8', 13, 5, '2d4', 3, BEAST),
  m('kobold', 'Kobold guerrero', 'Kobold Warrior', '1/8', 14, 7, '3d6-3', 2, HUM),
  m('bandit', 'Bandido', 'Bandit', '1/8', 12, 11, '2d8+2', 1, HUM),
  m('guard', 'Guardia', 'Guard', '1/8', 16, 11, '2d8+2', 1, HUM),
  m('cultist', 'Sectario', 'Cultist', '1/8', 12, 9, '2d8', 1, HUM),
  m('goblin', 'Goblin guerrero', 'Goblin Warrior', '1/4', 15, 10, '3d6', 2, r('Feérico', 'Fey')),
  m('skeleton', 'Esqueleto', 'Skeleton', '1/4', 14, 13, '2d8+4', 3, UND),
  m('zombie', 'Zombi', 'Zombie', '1/4', 8, 15, '2d8+6', -2, UND),
  m('wolf', 'Lobo', 'Wolf', '1/4', 12, 11, '2d8+2', 2, BEAST),
  m('giant_spider_small', 'Araña lobo gigante', 'Giant Wolf Spider', '1/4', 13, 11, '2d8+2', 3, BEAST),
  m('hobgoblin', 'Hobgoblin guerrero', 'Hobgoblin Warrior', '1/2', 18, 11, '2d8+2', 1, r('Feérico', 'Fey')),
  m('gnoll', 'Gnoll guerrero', 'Gnoll Warrior', '1/2', 15, 27, '6d8', 1, FIEND),
  m('shadow', 'Sombra', 'Shadow', '1/2', 12, 27, '6d8', 2, UND),
  m('thug', 'Matón', 'Tough', '1/2', 12, 32, '5d8+10', 1, HUM),
  m('scout', 'Explorador', 'Scout', '1/2', 13, 16, '3d8+3', 2, HUM),
  m('goblin_boss', 'Jefe goblin', 'Goblin Boss', '1', 17, 21, '6d6', 2, r('Feérico', 'Fey')),
  m('bugbear', 'Osgo guerrero', 'Bugbear Warrior', '1', 14, 33, '6d8+6', 2, r('Feérico', 'Fey')),
  m('dire_wolf', 'Lobo terrible', 'Dire Wolf', '1', 14, 22, '3d10+6', 2, BEAST),
  m('ghoul', 'Necrófago', 'Ghoul', '1', 12, 22, '5d8', 2, UND),
  m('giant_spider', 'Araña gigante', 'Giant Spider', '1', 14, 26, '4d10+4', 3, BEAST),
  m('brown_bear', 'Oso pardo', 'Brown Bear', '1', 11, 22, '3d10+6', 1, BEAST),
  m('imp', 'Diablillo', 'Imp', '1', 13, 21, '6d4+6', 3, FIEND),
  m('specter', 'Espectro', 'Specter', '1', 12, 22, '5d8', 2, UND),
  m('priest', 'Sacerdote', 'Priest', '2', 13, 38, '7d8+7', 0, HUM),
  m('ogre', 'Ogro', 'Ogre', '2', 11, 68, '8d10+24', -1, GIANT),
  m('bandit_captain', 'Capitán bandido', 'Bandit Captain', '2', 15, 52, '8d8+16', 3, HUM),
  m('gelatinous_cube', 'Cubo gelatinoso', 'Gelatinous Cube', '2', 6, 63, '6d10+30', -4, r('Cieno', 'Ooze')),
  m('mimic', 'Mímico', 'Mimic', '2', 12, 58, '9d8+18', 1, MON),
  m('ghost', 'Fantasma', 'Ghost', '4', 11, 45, '10d8', 1, UND),
  m('owlbear', 'Osolechuza', 'Owlbear', '3', 13, 59, '7d10+21', 1, MON),
  m('veteran', 'Guerrero veterano', 'Warrior Veteran', '3', 17, 65, '10d8+20', 1, HUM),
  m('basilisk', 'Basilisco', 'Basilisk', '3', 15, 52, '8d8+16', -1, MON),
  m('wight', 'Tumulario', 'Wight', '3', 14, 82, '11d8+33', 2, UND),
  m('minotaur', 'Minotauro', 'Minotaur', '3', 14, 85, '10d10+30', 0, MON),
  m('hell_hound', 'Sabueso infernal', 'Hell Hound', '3', 15, 58, '7d8+21', 1, FIEND),
  m('manticore', 'Mantícora', 'Manticore', '3', 14, 68, '8d10+24', 3, MON),
  m('mage', 'Mago', 'Mage', '6', 15, 81, '18d8', 2, HUM),
  m('troll', 'Trol', 'Troll', '5', 15, 94, '9d10+45', 1, GIANT),
  m('young_red_dragon', 'Dragón rojo joven', 'Young Red Dragon', '10', 18, 178, '17d10+85', 0, r('Dragón', 'Dragon')),
];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const searchMonsters = (q: string) => {
  const k = norm(q.trim());
  return k ? MONSTERS.filter((x) => norm(x.name.es).includes(k) || norm(x.name.en).includes(k)) : MONSTERS;
};
