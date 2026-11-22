import { beforeAll, describe, expect, it } from 'vitest';
import { setLang } from '../../i18n';
import { consumableKind, gearByName, placeReceived } from '../stash';
import { payCoins } from '../items';
import type { ItemData } from '../itemTypes';

beforeAll(() => setLang('es'));
const item = (name: string, type: ItemData['type'] = 'gear', extra: Partial<ItemData> = {}): ItemData => ({ name, rarity: 'mundane', type, description: '', value: 0, qty: 1, ...extra });

describe('dónde va lo que te dan', () => {
  it('munición por el nombre, con la cantidad del nombre', () => {
    expect(placeReceived(item('20 flechas'))).toMatchObject({ where: 'consumable', kind: 'ammo', name: 'Flechas', qty: 20 });
    expect(placeReceived(item('Virotes (10)', 'gear', { qty: 2 }))).toMatchObject({ where: 'consumable', kind: 'ammo', name: 'Virotes', qty: 20 });
    expect(placeReceived(item('Crossbow bolts'))).toMatchObject({ where: 'consumable', kind: 'ammo' });
  });
  it('pociones y consumibles que se gastan', () => {
    expect(consumableKind(item('Poción de trepar', 'potion'))).toBe('item');
    expect(consumableKind(item('5 antorchas'))).toBe('item');
    expect(consumableKind(item('Fuego de alquimista'))).toBe('item');
  });
  it('no confunde armas, carcajes ni varitas con munición', () => {
    expect(consumableKind(item('Arco largo', 'weapon'))).toBeNull();
    expect(consumableKind(item('Carcaj con flechas'))).toBeNull();
    expect(consumableKind(item('Varita de rayo (lightning bolt)', 'wand'))).toBeNull();
    expect(consumableKind(item('Cuerda de cáñamo'))).toBeNull();
  });
  it('lo que llega marcado desde la lista de un compañero respeta su tipo', () => {
    expect(placeReceived(item('Bayas', 'gear', { consumable: 'item', qty: 4 }))).toMatchObject({ where: 'consumable', kind: 'item', qty: 4 });
  });
  it('armas y armaduras escritas a mano se reconocen (la más larga gana) y el +1 cuenta', () => {
    expect(gearByName('Camisote de mallas')?.mods.armor?.base).toBe(13);
    expect(gearByName('Cota de mallas')?.mods.armor?.base).toBe(16);
    expect(gearByName('Lanza de caballería')?.mods.weapon?.dice).toBe('1d10');
    expect(gearByName('Longbow')?.mods.weapon).toMatchObject({ dice: '1d8', ranged: true });
    const p = placeReceived(item('Espada larga +1'));
    expect(p.where === 'item' && p.item.mods).toMatchObject({ weapon: { dice: '1d8' }, attack: 1, damage: 1 });
    const sh = placeReceived(item('Escudo'));
    expect(sh.where === 'item' && sh.item.mods?.shield).toBe(2);
    expect(placeReceived(item('Libro de saberes'))).toMatchObject({ where: 'item', item: { name: 'Libro de saberes' } });
  });
});

describe('pagar con monedas', () => {
  it('usa primero las pequeñas y devuelve el cambio', () => {
    expect(payCoins({ cp: 0, sp: 0, ep: 0, gp: 0, pp: 1 }, 2.5)).toEqual({ coins: { cp: 0, sp: 5, ep: 0, gp: 7, pp: 0 }, short: 0 });
    expect(payCoins({ cp: 50, sp: 5, ep: 0, gp: 3, pp: 0 }, 1)).toEqual({ coins: { cp: 0, sp: 0, ep: 0, gp: 3, pp: 0 }, short: 0 });
    expect(payCoins({ cp: 0, sp: 0, ep: 0, gp: 2, pp: 0 }, 3)).toEqual({ coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }, short: 1 });
  });
});
