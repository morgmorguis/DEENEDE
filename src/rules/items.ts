// Objetos y monedas (reglas 2024): catálogo de los más comunes para que el DM los reparta, plantilla para
// crear objetos propios y utilidades de valor y rareza. Precios del equipo según el Player’s Handbook 2024
// y de los objetos mágicos según la tabla orientativa por rareza de la Dungeon Master’s Guide 2024
// (los consumibles, como pociones y pergaminos, a mitad de precio).
import { L, T, type Tr } from '../i18n';

export type { Rarity, ItemType, ItemData, Coins5 } from './itemTypes';
import type { Rarity, ItemType, ItemData, Coins5 } from './itemTypes';

export const NO_COINS: Coins5 = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
export const COIN_KEYS = ['cp', 'sp', 'ep', 'gp', 'pp'] as const;
export const coinLabel = (k: keyof Coins5) => ({ cp: T('pc', 'cp'), sp: T('pp', 'sp'), ep: T('pe', 'ep'), gp: T('po', 'gp'), pp: T('ppt', 'pp') }[k]);
export const coinName = (k: keyof Coins5) => ({ cp: T('cobre', 'copper'), sp: T('plata', 'silver'), ep: T('electro', 'electrum'), gp: T('oro', 'gold'), pp: T('platino', 'platinum') }[k]);
/** Valor en oro de unas monedas (1 ppt = 10 po, 1 pe = ½ po, 1 pp = 1/10 po, 1 pc = 1/100 po) */
export const coinsInGold = (c: Partial<Coins5>) => (c.pp ?? 0) * 10 + (c.gp ?? 0) + (c.ep ?? 0) / 2 + (c.sp ?? 0) / 10 + (c.cp ?? 0) / 100;
export const hasCoins = (c?: Partial<Coins5>) => !!c && COIN_KEYS.some((k) => (c[k] ?? 0) > 0);
export const coinsText = (c: Partial<Coins5>) => COIN_KEYS.filter((k) => (c[k] ?? 0) > 0).reverse().map((k) => `${c[k]} ${coinLabel(k)}`).join(', ');

/** «50 po», «5 pp», «1 pc» */
export function valueText(gp: number): string {
  if (!gp) return '—';
  if (gp >= 1) return `${Number.isInteger(gp) ? gp : gp.toFixed(1).replace('.', ',')} ${T('po', 'gp')}`;
  if (gp >= 0.1) return `${Math.round(gp * 10)} ${T('pp', 'sp')}`;
  return `${Math.max(1, Math.round(gp * 100))} ${T('pc', 'cp')}`;
}

export const RARITY: Record<Rarity, { name: Tr; color: string }> = {
  mundane: { name: { es: 'Normal', en: 'Mundane' }, color: '#8a8378' },
  common: { name: { es: 'Común', en: 'Common' }, color: '#c9c4b8' },
  uncommon: { name: { es: 'Poco común', en: 'Uncommon' }, color: '#4fa35a' },
  rare: { name: { es: 'Raro', en: 'Rare' }, color: '#3f7fd0' },
  veryRare: { name: { es: 'Muy raro', en: 'Very rare' }, color: '#9b59d0' },
  legendary: { name: { es: 'Legendario', en: 'Legendary' }, color: '#e08a2e' },
  artifact: { name: { es: 'Artefacto', en: 'Artifact' }, color: '#c9433a' },
};
export const RARITIES = Object.keys(RARITY) as Rarity[];

export const ITEM_TYPES: Record<ItemType, Tr> = {
  weapon: { es: 'Arma', en: 'Weapon' }, armor: { es: 'Armadura o escudo', en: 'Armor or shield' }, potion: { es: 'Poción', en: 'Potion' },
  scroll: { es: 'Pergamino', en: 'Scroll' }, wondrous: { es: 'Objeto maravilloso', en: 'Wondrous item' }, ring: { es: 'Anillo', en: 'Ring' },
  wand: { es: 'Varita, vara o bastón', en: 'Wand, rod or staff' }, gear: { es: 'Equipo de aventurero', en: 'Adventuring gear' },
  treasure: { es: 'Gema u objeto de arte', en: 'Gem or art object' }, other: { es: 'Otro', en: 'Other' },
};

/** Precio orientativo de un objeto mágico por rareza (DMG 2024); los consumibles, la mitad */
export const RARITY_PRICE: Record<Rarity, number> = { mundane: 0, common: 100, uncommon: 400, rare: 4000, veryRare: 40000, legendary: 200000, artifact: 0 };

export interface CatalogEntry { id: string; name: Tr; rarity: Rarity; type: ItemType; text: Tr; value: number; weight?: number; attunement?: boolean }
const e = (id: string, es: string, en: string, rarity: Rarity, type: ItemType, value: number, tes: string, ten: string, weight?: number, attunement?: boolean): CatalogEntry =>
  ({ id, name: { es, en }, rarity, type, value, text: { es: tes, en: ten }, weight, attunement });

export const ITEM_CATALOG: CatalogEntry[] = [
  // Pociones y pergaminos
  e('potion-healing', 'Poción de curación', 'Potion of Healing', 'common', 'potion', 50, 'Recuperas 2d4 + 2 PG al beberla (acción adicional).', 'You regain 2d4 + 2 HP when you drink it (Bonus Action).', 0.5),
  e('potion-greater-healing', 'Poción de curación mayor', 'Potion of Greater Healing', 'uncommon', 'potion', 200, 'Recuperas 4d4 + 4 PG al beberla.', 'You regain 4d4 + 4 HP when you drink it.', 0.5),
  e('potion-superior-healing', 'Poción de curación superior', 'Potion of Superior Healing', 'rare', 'potion', 2000, 'Recuperas 8d4 + 8 PG al beberla.', 'You regain 8d4 + 8 HP when you drink it.', 0.5),
  e('potion-supreme-healing', 'Poción de curación suprema', 'Potion of Supreme Healing', 'veryRare', 'potion', 20000, 'Recuperas 10d4 + 20 PG al beberla.', 'You regain 10d4 + 20 HP when you drink it.', 0.5),
  e('potion-climbing', 'Poción de trepar', 'Potion of Climbing', 'common', 'potion', 50, 'Durante 1 hora tienes velocidad de trepar igual a tu velocidad y ventaja en las pruebas de Atletismo para trepar.', 'For 1 hour you have a Climb Speed equal to your Speed and Advantage on Athletics checks to climb.', 0.5),
  e('potion-resistance', 'Poción de resistencia', 'Potion of Resistance', 'uncommon', 'potion', 200, 'Durante 1 hora tienes resistencia a un tipo de daño (lo indica la poción).', 'For 1 hour you have Resistance to one damage type (set by the potion).', 0.5),
  e('potion-water-breathing', 'Poción de respirar bajo el agua', 'Potion of Water Breathing', 'uncommon', 'potion', 200, 'Puedes respirar bajo el agua durante 24 horas.', 'You can breathe underwater for 24 hours.', 0.5),
  e('potion-fire-breath', 'Poción de aliento de fuego', 'Potion of Fire Breath', 'uncommon', 'potion', 200, 'Durante 1 hora puedes exhalar fuego como acción adicional: salvación de Destreza CD 13 o 4d6 de fuego (3 veces).', 'For 1 hour you can exhale fire as a Bonus Action: DC 13 Dexterity save or 4d6 Fire damage (3 times).', 0.5),
  e('antitoxin', 'Antitoxina', 'Antitoxin', 'mundane', 'potion', 50, 'Al beberla tienes ventaja en las salvaciones para evitar o terminar el estado Envenenado durante 1 hora.', 'When you drink it, you have Advantage on saves to avoid or end the Poisoned condition for 1 hour.'),
  e('scroll-cantrip', 'Pergamino de conjuro (truco)', 'Spell Scroll (Cantrip)', 'common', 'scroll', 50, 'Contiene un truco. Si está en tu lista de clase puedes lanzarlo leyéndolo; el pergamino se deshace.', 'Holds a cantrip. If it is on your class list you can cast it by reading it; the scroll crumbles.'),
  e('scroll-1', 'Pergamino de conjuro (nivel 1)', 'Spell Scroll (Level 1)', 'common', 'scroll', 50, 'Contiene un conjuro de nivel 1 que puedes lanzar si está en tu lista de clase (CD 13, +5 al ataque).', 'Holds a level 1 spell you can cast if it is on your class list (DC 13, +5 to hit).'),
  e('scroll-2', 'Pergamino de conjuro (nivel 2)', 'Spell Scroll (Level 2)', 'uncommon', 'scroll', 200, 'Contiene un conjuro de nivel 2 (CD 13, +5 al ataque).', 'Holds a level 2 spell (DC 13, +5 to hit).'),
  e('scroll-3', 'Pergamino de conjuro (nivel 3)', 'Spell Scroll (Level 3)', 'uncommon', 'scroll', 200, 'Contiene un conjuro de nivel 3 (CD 15, +7 al ataque).', 'Holds a level 3 spell (DC 15, +7 to hit).'),
  // Objetos mágicos permanentes
  e('weapon-1', 'Arma +1', 'Weapon, +1', 'uncommon', 'weapon', 400, '+1 a las tiradas de ataque y daño con esta arma mágica (indica cuál en el nombre).', '+1 to attack and damage rolls with this magic weapon (name which weapon).'),
  e('weapon-2', 'Arma +2', 'Weapon, +2', 'rare', 'weapon', 4000, '+2 a las tiradas de ataque y daño con esta arma mágica.', '+2 to attack and damage rolls with this magic weapon.'),
  e('weapon-3', 'Arma +3', 'Weapon, +3', 'veryRare', 'weapon', 40000, '+3 a las tiradas de ataque y daño con esta arma mágica.', '+3 to attack and damage rolls with this magic weapon.'),
  e('shield-1', 'Escudo +1', 'Shield, +1', 'uncommon', 'armor', 400, 'Mientras lo llevas, +1 a la CA además del bonificador normal del escudo.', 'While holding it, +1 to AC on top of the shield’s normal bonus.', 6),
  e('ammo-1', 'Munición +1 (10)', 'Ammunition, +1 (10)', 'uncommon', 'weapon', 200, '+1 a las tiradas de ataque y daño; cada pieza deja de ser mágica al impactar.', '+1 to attack and damage rolls; each piece stops being magical once it hits.'),
  e('bag-of-holding', 'Bolsa de contención', 'Bag of Holding', 'uncommon', 'wondrous', 400, 'Su interior es mayor que su exterior: hasta 500 libras sin pesar más de 5. Sacar algo es una acción de Utilizar.', 'Its interior is larger than its outside: up to 500 lb while it weighs only 5. Retrieving an item takes a Utilize action.', 5),
  e('cloak-of-protection', 'Capa de protección', 'Cloak of Protection', 'uncommon', 'wondrous', 400, '+1 a la CA y a las tiradas de salvación.', '+1 to AC and saving throws.', 1, true),
  e('ring-of-protection', 'Anillo de protección', 'Ring of Protection', 'rare', 'ring', 4000, '+1 a la CA y a las tiradas de salvación.', '+1 to AC and saving throws.', 0, true),
  e('boots-of-elvenkind', 'Botas élficas', 'Boots of Elvenkind', 'uncommon', 'wondrous', 400, 'Tus pasos no hacen ruido y tienes ventaja en las pruebas de Sigilo para moverte en silencio.', 'Your steps make no sound and you have Advantage on Stealth checks to move silently.', 1),
  e('cloak-of-elvenkind', 'Capa élfica', 'Cloak of Elvenkind', 'uncommon', 'wondrous', 400, 'Con la capucha puesta, ventaja en Sigilo y los demás tienen desventaja en Percepción para verte.', 'With the hood up, Advantage on Stealth checks and others have Disadvantage on Perception checks to see you.', 1, true),
  e('goggles-of-night', 'Gafas nocturnas', 'Goggles of Night', 'uncommon', 'wondrous', 400, 'Visión en la oscuridad a 60 pies (o 60 más si ya la tienes).', 'Darkvision out to 60 feet (or 60 more if you already have it).'),
  e('gauntlets-ogre-power', 'Guanteletes de poder de ogro', 'Gauntlets of Ogre Power', 'uncommon', 'wondrous', 400, 'Tu Fuerza pasa a ser 19.', 'Your Strength score becomes 19.', 2, true),
  e('headband-intellect', 'Diadema del intelecto', 'Headband of Intellect', 'uncommon', 'wondrous', 400, 'Tu Inteligencia pasa a ser 19.', 'Your Intelligence score becomes 19.', 0, true),
  e('amulet-of-health', 'Amuleto de salud', 'Amulet of Health', 'rare', 'wondrous', 4000, 'Tu Constitución pasa a ser 19.', 'Your Constitution score becomes 19.', 1, true),
  e('bracers-of-defense', 'Brazales de defensa', 'Bracers of Defense', 'rare', 'wondrous', 4000, '+2 a la CA si no llevas armadura ni escudo.', '+2 to AC while you wear no armor and wield no shield.', 1, true),
  e('stone-good-luck', 'Piedra de la suerte', 'Stone of Good Luck (Luckstone)', 'uncommon', 'wondrous', 400, '+1 a las pruebas de característica y a las tiradas de salvación.', '+1 to ability checks and saving throws.', 0, true),
  e('wand-magic-missiles', 'Varita de proyectiles mágicos', 'Wand of Magic Missiles', 'uncommon', 'wand', 400, '7 cargas: lanza Proyectil mágico gastando cargas (1 por nivel de espacio). Recupera 1d6 + 1 al amanecer.', '7 charges: cast Magic Missile by spending charges (1 per slot level). Regains 1d6 + 1 at dawn.', 1),
  e('immovable-rod', 'Vara inamovible', 'Immovable Rod', 'uncommon', 'wand', 400, 'Al pulsar el botón queda fija en el aire; aguanta hasta 8000 libras.', 'Press its button and it stays fixed in place; it holds up to 8,000 lb.', 2),
  e('hat-of-disguise', 'Sombrero del disfraz', 'Hat of Disguise', 'uncommon', 'wondrous', 400, 'Lanzas Disfrazarse a voluntad mientras lo llevas.', 'You can cast Disguise Self at will while wearing it.', 0, true),
  e('pearl-of-power', 'Perla de poder', 'Pearl of Power', 'uncommon', 'wondrous', 400, 'Una vez al día recuperas un espacio de conjuro de nivel 3 o inferior.', 'Once per day you regain one expended spell slot of level 3 or lower.', 0, true),
  e('sending-stones', 'Piedras de mensajes', 'Sending Stones', 'uncommon', 'wondrous', 400, 'Pareja de piedras: una vez al día lanzas Recado al portador de la otra.', 'A pair of stones: once per day you cast Sending to whoever carries the other.'),
  e('driftglobe', 'Esfera flotante', 'Driftglobe', 'uncommon', 'wondrous', 400, 'Lanza Luz o Luz del día (una vez al día) y te sigue flotando.', 'Casts Light or Daylight (once per day) and floats along behind you.', 1),
  e('decanter-endless-water', 'Jarra de agua infinita', 'Decanter of Endless Water', 'uncommon', 'wondrous', 400, 'Produce agua dulce o salada: chorro, fuente o géiser.', 'Produces fresh or salt water: stream, fountain or geyser.', 2),
  e('rope-of-climbing', 'Cuerda trepadora', 'Rope of Climbing', 'uncommon', 'wondrous', 400, 'Cuerda de 60 pies que se mueve, se ata y se desata a tu orden.', 'A 60-foot rope that moves, knots and unknots on command.', 3),
  e('mithral-armor', 'Armadura de mithral', 'Mithral Armor', 'uncommon', 'armor', 400, 'Armadura intermedia o pesada sin requisito de Fuerza ni desventaja en Sigilo.', 'Medium or heavy armor with no Strength requirement or Stealth disadvantage.'),
  e('adamantine-armor', 'Armadura de adamantina', 'Adamantine Armor', 'uncommon', 'armor', 400, 'Los críticos contra ti se convierten en impactos normales.', 'Critical Hits against you become normal hits.'),
  // Armas y armaduras normales
  e('dagger', 'Daga', 'Dagger', 'mundane', 'weapon', 2, '1d4 perforante. Sutil, ligera, arrojadiza (20/60).', '1d4 Piercing. Finesse, Light, Thrown (20/60).', 1),
  e('shortsword', 'Espada corta', 'Shortsword', 'mundane', 'weapon', 10, '1d6 perforante. Sutil, ligera.', '1d6 Piercing. Finesse, Light.', 2),
  e('longsword', 'Espada larga', 'Longsword', 'mundane', 'weapon', 15, '1d8 cortante. Versátil (1d10).', '1d8 Slashing. Versatile (1d10).', 3),
  e('rapier', 'Estoque', 'Rapier', 'mundane', 'weapon', 25, '1d8 perforante. Sutil.', '1d8 Piercing. Finesse.', 2),
  e('battleaxe', 'Hacha de batalla', 'Battleaxe', 'mundane', 'weapon', 10, '1d8 cortante. Versátil (1d10).', '1d8 Slashing. Versatile (1d10).', 4),
  e('greataxe', 'Gran hacha', 'Greataxe', 'mundane', 'weapon', 30, '1d12 cortante. Pesada, a dos manos.', '1d12 Slashing. Heavy, Two-Handed.', 7),
  e('greatsword', 'Mandoble', 'Greatsword', 'mundane', 'weapon', 50, '2d6 cortante. Pesada, a dos manos.', '2d6 Slashing. Heavy, Two-Handed.', 6),
  e('mace', 'Maza', 'Mace', 'mundane', 'weapon', 5, '1d6 contundente.', '1d6 Bludgeoning.', 4),
  e('quarterstaff', 'Bastón', 'Quarterstaff', 'mundane', 'weapon', 0.2, '1d6 contundente. Versátil (1d8).', '1d6 Bludgeoning. Versatile (1d8).', 4),
  e('spear', 'Lanza', 'Spear', 'mundane', 'weapon', 1, '1d6 perforante. Arrojadiza (20/60), versátil (1d8).', '1d6 Piercing. Thrown (20/60), Versatile (1d8).', 3),
  e('shortbow', 'Arco corto', 'Shortbow', 'mundane', 'weapon', 25, '1d6 perforante. Munición (80/320), a dos manos.', '1d6 Piercing. Ammunition (80/320), Two-Handed.', 2),
  e('longbow', 'Arco largo', 'Longbow', 'mundane', 'weapon', 50, '1d8 perforante. Munición (150/600), pesada, a dos manos.', '1d8 Piercing. Ammunition (150/600), Heavy, Two-Handed.', 2),
  e('light-crossbow', 'Ballesta ligera', 'Light Crossbow', 'mundane', 'weapon', 25, '1d8 perforante. Munición (80/320), carga, a dos manos.', '1d8 Piercing. Ammunition (80/320), Loading, Two-Handed.', 5),
  e('arrows', 'Flechas (20)', 'Arrows (20)', 'mundane', 'gear', 1, 'Munición para arcos.', 'Ammunition for bows.', 1),
  e('bolts', 'Virotes (20)', 'Bolts (20)', 'mundane', 'gear', 1, 'Munición para ballestas.', 'Ammunition for crossbows.', 1.5),
  e('leather-armor', 'Armadura de cuero', 'Leather Armor', 'mundane', 'armor', 10, 'Armadura ligera: CA 11 + mod. Destreza.', 'Light armor: AC 11 + Dex modifier.', 10),
  e('studded-leather', 'Armadura de cuero tachonado', 'Studded Leather Armor', 'mundane', 'armor', 45, 'Armadura ligera: CA 12 + mod. Destreza.', 'Light armor: AC 12 + Dex modifier.', 13),
  e('chain-shirt', 'Camisote de mallas', 'Chain Shirt', 'mundane', 'armor', 50, 'Armadura intermedia: CA 13 + mod. Destreza (máx. 2).', 'Medium armor: AC 13 + Dex modifier (max 2).', 20),
  e('breastplate', 'Coraza', 'Breastplate', 'mundane', 'armor', 400, 'Armadura intermedia: CA 14 + mod. Destreza (máx. 2).', 'Medium armor: AC 14 + Dex modifier (max 2).', 20),
  e('chain-mail', 'Cota de mallas', 'Chain Mail', 'mundane', 'armor', 75, 'Armadura pesada: CA 16. Fuerza 13; desventaja en Sigilo.', 'Heavy armor: AC 16. Strength 13; Stealth Disadvantage.', 55),
  e('plate-armor', 'Armadura de placas', 'Plate Armor', 'mundane', 'armor', 1500, 'Armadura pesada: CA 18. Fuerza 15; desventaja en Sigilo.', 'Heavy armor: AC 18. Strength 15; Stealth Disadvantage.', 65),
  e('shield', 'Escudo', 'Shield', 'mundane', 'armor', 10, '+2 a la CA.', '+2 to AC.', 6),
  // Equipo de aventurero
  e('healers-kit', 'Útiles de sanador', 'Healer’s Kit', 'mundane', 'gear', 5, '10 usos: estabilizas a una criatura a 0 PG sin tirada.', '10 uses: stabilize a creature at 0 HP with no check.', 3),
  e('rations', 'Raciones (1 día)', 'Rations (1 day)', 'mundane', 'gear', 0.5, 'Comida seca para un día.', 'Dry food for one day.', 2),
  e('rope', 'Cuerda de cáñamo (50 pies)', 'Rope (50 feet)', 'mundane', 'gear', 1, 'Puedes atar a una criatura (prueba de Destreza para soltarse).', 'You can tie up a creature (Dexterity check to escape).', 5),
  e('torch', 'Antorcha', 'Torch', 'mundane', 'gear', 0.01, 'Luz brillante a 20 pies durante 1 hora; como arma, 1 de daño de fuego.', 'Bright Light in 20 feet for 1 hour; as a weapon, 1 Fire damage.', 1),
  e('oil', 'Frasco de aceite', 'Oil (flask)', 'mundane', 'gear', 0.1, 'Combustible para lámparas; derramado y encendido hace 5 de fuego.', 'Lamp fuel; spilled and lit, it deals 5 Fire damage.', 1),
  e('alchemists-fire', 'Fuego de alquimista', 'Alchemist’s Fire', 'mundane', 'gear', 50, 'Arrojado: el objetivo arde (1d4 de fuego por turno hasta apagarlo).', 'Thrown: the target catches fire (1d4 Fire per turn until put out).', 1),
  e('holy-water', 'Agua bendita', 'Holy Water', 'mundane', 'gear', 25, 'Arrojada: 2d8 radiante a infernales o muertos vivientes.', 'Thrown: 2d8 Radiant damage to a Fiend or Undead.', 1),
  e('acid', 'Ácido (vial)', 'Acid (vial)', 'mundane', 'gear', 25, 'Arrojado: 2d6 de ácido.', 'Thrown: 2d6 Acid damage.', 1),
  e('thieves-tools', 'Herramientas de ladrón', 'Thieves’ Tools', 'mundane', 'gear', 25, 'Para forzar cerraduras y desactivar trampas.', 'For picking locks and disarming traps.', 1),
  e('explorers-pack', 'Paquete de explorador', 'Explorer’s Pack', 'mundane', 'gear', 10, 'Mochila, saco de dormir, odre, cuerda, yesquero, 10 antorchas y 10 raciones.', 'Backpack, bedroll, waterskin, rope, tinderbox, 10 torches and 10 rations.', 55),
  e('crowbar', 'Palanca', 'Crowbar', 'mundane', 'gear', 2, 'Ventaja en las pruebas de Fuerza en las que haga palanca.', 'Advantage on Strength checks where leverage helps.', 5),
  e('spyglass', 'Catalejo', 'Spyglass', 'mundane', 'gear', 1000, 'Lo que ves a través aumenta al doble de tamaño.', 'Objects viewed through it are magnified to twice their size.', 1),
  // Tesoro
  e('gem-10', 'Gema (10 po)', 'Gemstone (10 gp)', 'mundane', 'treasure', 10, 'Gema ornamental: ágata, azurita, cuarzo azul, hematites…', 'Ornamental stone: agate, azurite, blue quartz, hematite…'),
  e('gem-50', 'Gema (50 po)', 'Gemstone (50 gp)', 'mundane', 'treasure', 50, 'Piedra semipreciosa: jaspe, piedra de luna, ónice, cuarzo…', 'Semiprecious stone: jasper, moonstone, onyx, quartz…'),
  e('gem-100', 'Gema (100 po)', 'Gemstone (100 gp)', 'mundane', 'treasure', 100, 'Gema fina: ámbar, amatista, granate, perla, jade…', 'Fine gem: amber, amethyst, garnet, pearl, jade…'),
  e('gem-500', 'Gema (500 po)', 'Gemstone (500 gp)', 'mundane', 'treasure', 500, 'Piedra preciosa: alejandrita, aguamarina, perla negra, topacio…', 'Precious stone: alexandrite, aquamarine, black pearl, topaz…'),
  e('gem-1000', 'Gema (1000 po)', 'Gemstone (1,000 gp)', 'mundane', 'treasure', 1000, 'Joya: ópalo negro, zafiro azul, esmeralda, rubí estrella…', 'Jewel: black opal, blue sapphire, emerald, star ruby…'),
  e('art-25', 'Objeto de arte (25 po)', 'Art object (25 gp)', 'mundane', 'treasure', 25, 'Cáliz de plata, dados de hueso tallado, espejo pequeño…', 'Silver ewer, carved bone dice, small mirror…'),
  e('art-250', 'Objeto de arte (250 po)', 'Art object (250 gp)', 'mundane', 'treasure', 250, 'Anillo de oro, estatuilla de marfil, cáliz con gemas…', 'Gold ring, ivory statuette, jeweled chalice…'),
  e('art-750', 'Objeto de arte (750 po)', 'Art object (750 gp)', 'mundane', 'treasure', 750, 'Corona de plata, ídolo de oro, tapiz de seda…', 'Silver crown, gold idol, silk tapestry…'),
];

/** Pasa una entrada del catálogo al idioma actual */
export const fromCatalog = (c: CatalogEntry, qty = 1): ItemData => ({
  name: L(c.name), rarity: c.rarity, type: c.type, description: L(c.text), value: c.value, weight: c.weight, attunement: c.attunement, qty, ref: c.id,
});

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const searchCatalog = (q: string) => {
  const k = fold(q.trim());
  return k ? ITEM_CATALOG.filter((x) => fold(x.name.es).includes(k) || fold(x.name.en).includes(k) || fold(L(ITEM_TYPES[x.type])).includes(k) || fold(L(RARITY[x.rarity].name)).includes(k)) : ITEM_CATALOG;
};

/** Objeto vacío para la plantilla del DM */
export const blankItem = (): ItemData => ({ name: '', rarity: 'common', type: 'wondrous', description: '', value: 0, weight: 0, attunement: false, qty: 1 });

/** Precio sugerido según rareza y tipo (consumibles a mitad) */
export const suggestedValue = (rarity: Rarity, type: ItemType) => {
  const base = RARITY_PRICE[rarity];
  return type === 'potion' || type === 'scroll' ? base / 2 : base;
};

export const itemLine = (i: Pick<ItemData, 'name' | 'qty'>) => `${i.qty > 1 ? `${i.qty} × ` : ''}${i.name}`;
