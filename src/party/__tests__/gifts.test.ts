import { beforeAll, describe, expect, it } from 'vitest';
import { setLang } from '../../i18n';
import { apply, createRoom, join, normalizeRoom, viewFor, type Room } from '../room';
import type { Command } from '../protocol';
import { applyGift } from '../client';
import { blankCharacter } from '../../rules/factory';
import { ITEM_CATALOG, coinsInGold, fromCatalog, searchCatalog, suggestedValue, valueText } from '../../rules/items';

function setup() {
  let room: Room = createRoom();
  const dmJ = join(room, 'Marc', undefined, room.dmKey); room = dmJ.room;
  const p1 = join(room, 'Ana'); room = p1.room;
  const p2 = join(room, 'Leo'); room = p2.room;
  const run = (who: string, cmd: Command) => {
    const r = apply(room, who, cmd);
    if (r.error) throw new Error(r.error);
    room = r.room;
    return r;
  };
  return { get room() { return room; }, run, dm: dmJ.member.id, p1: p1.member.id, p2: p2.member.id };
}

beforeAll(() => setLang('es'));

const potion = () => fromCatalog(ITEM_CATALOG.find((x) => x.id === 'potion-healing')!, 2);

describe('entregas del DM', () => {
  it('el DM da oro y objetos a un jugador concreto y queda en su registro', () => {
    const s = setup();
    s.run(s.dm, { t: 'give', toId: s.p1, coins: { gp: 50, sp: 3 }, items: [potion()], note: 'Botín' });
    s.run(s.dm, { t: 'give', toId: s.p2, coins: { pp: 1 } });
    const dmView = viewFor(s.room, s.dm)!;
    expect(dmView.gifts).toHaveLength(2);
    // Cada jugador solo ve lo suyo
    const v1 = viewFor(s.room, s.p1)!;
    expect(v1.gifts).toHaveLength(1);
    expect(v1.gifts[0]).toMatchObject({ toId: s.p1, coins: { gp: 50, sp: 3 }, note: 'Botín', delivered: false });
    expect(v1.gifts[0].items![0]).toMatchObject({ name: 'Poción de curación', qty: 2, rarity: 'common' });
    expect(viewFor(s.room, s.p2)!.gifts.map((g) => g.coins)).toEqual([{ pp: 1 }]);
  });

  it('solo el DM puede dar y no se dan entregas vacías ni monedas negativas', () => {
    const s = setup();
    expect(apply(s.room, s.p1, { t: 'give', toId: s.p2, coins: { gp: 10 } }).error).toBe('not-allowed');
    expect(apply(s.room, s.dm, { t: 'give', toId: s.p1, coins: { gp: -5 } }).error).toBe('empty-gift');
    expect(apply(s.room, s.dm, { t: 'give', toId: s.dm, coins: { gp: 5 } }).error).toBe('no-target');
    s.run(s.dm, { t: 'give', toId: s.p1, coins: { gp: 2.6, cp: -3 }, items: [{ ...potion(), name: '  ', qty: 1 }, { ...potion(), qty: 0 }] });
    const g = s.room.gifts[0];
    expect(g.coins).toEqual({ gp: 3 });
    expect(g.items).toHaveLength(1);
    expect(g.items![0].qty).toBe(1);
  });

  it('el jugador confirma la entrega y el DM la ve como entregada; ya no se puede anular', () => {
    const s = setup();
    s.run(s.dm, { t: 'give', toId: s.p1, coins: { gp: 10 } });
    const id = s.room.gifts[0].id;
    // Otro jugador no puede confirmar lo que no es suyo
    s.run(s.p2, { t: 'giftAck', ids: [id] });
    expect(s.room.gifts[0].delivered).toBe(false);
    s.run(s.p1, { t: 'giftAck', ids: [id] });
    expect(viewFor(s.room, s.dm)!.gifts[0].delivered).toBe(true);
    expect(apply(s.room, s.dm, { t: 'giftCancel', id }).error).toBe('gift-delivered');
  });

  it('el DM puede anular una entrega pendiente', () => {
    const s = setup();
    s.run(s.dm, { t: 'give', toId: s.p1, coins: { gp: 10 } });
    s.run(s.dm, { t: 'giftCancel', id: s.room.gifts[0].id });
    expect(s.room.gifts).toHaveLength(0);
  });

  it('partidas guardadas antes de esta versión empiezan con el registro vacío', () => {
    const old = createRoom() as Partial<Room>;
    delete old.gifts;
    expect(normalizeRoom(old as Room).gifts).toEqual([]);
  });

  it('la entrega se suma a la ficha: monedas al total y objetos apilados', () => {
    const s = setup();
    s.run(s.dm, { t: 'give', toId: s.p1, coins: { gp: 50, cp: 7 }, items: [potion()] });
    s.run(s.dm, { t: 'give', toId: s.p1, items: [{ ...potion(), qty: 1 }] });
    let c = blankCharacter();
    c.coins.gp = 15;
    for (const g of s.room.gifts) c = applyGift(c, g);
    expect(c.coins.gp).toBe(65);
    expect(c.coins.cp).toBe(7);
    expect(c.items).toHaveLength(1);
    expect(c.items[0]).toMatchObject({ name: 'Poción de curación', qty: 3, from: 'DM' });
    expect(c.giftsReceived).toEqual(s.room.gifts.map((g) => g.id));
  });
});

describe('catálogo de objetos', () => {
  it('ids únicos y precios coherentes con la DMG 2024', () => {
    const ids = ITEM_CATALOG.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ITEM_CATALOG.length).toBeGreaterThan(50);
    expect(suggestedValue('rare', 'wondrous')).toBe(4000);
    expect(suggestedValue('uncommon', 'potion')).toBe(200);
  });
  it('busca en español e inglés y por rareza', () => {
    expect(searchCatalog('bolsa').some((x) => x.id === 'bag-of-holding')).toBe(true);
    expect(searchCatalog('holding').some((x) => x.id === 'bag-of-holding')).toBe(true);
    expect(searchCatalog('legendario').length).toBeGreaterThanOrEqual(0);
  });
  it('valor de las monedas en oro (1 ppt = 10 po, 1 pe = ½ po)', () => {
    expect(coinsInGold({ pp: 1, gp: 2, ep: 2, sp: 5, cp: 50 })).toBeCloseTo(14);
    expect(valueText(0.5)).toBe('5 pp');
  });
});
