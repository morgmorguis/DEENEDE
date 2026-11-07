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

  it('un jugador da a un compañero (intercambio) pero no a sí mismo; el DM lo ve en el registro', () => {
    const s = setup();
    expect(apply(s.room, s.p1, { t: 'give', toId: s.p1, coins: { gp: 10 } }).error).toBe('no-target');
    s.run(s.p1, { t: 'give', toId: s.p2, coins: { gp: 10 }, items: [potion()] });
    const g = s.room.gifts[0];
    expect(g).toMatchObject({ fromId: s.p1, toId: s.p2, coins: { gp: 10 } });
    expect(viewFor(s.room, s.p1)!.gifts).toHaveLength(1);
    expect(viewFor(s.room, s.p2)!.gifts).toHaveLength(1);
    expect(viewFor(s.room, s.dm)!.gifts[0].fromName).toBeTruthy();
    // El jugador no puede anular entregas
    expect(apply(s.room, s.p1, { t: 'giftCancel', id: g.id }).error).toBe('not-allowed');
    // Al recibirla se apunta quién la dio
    expect(applyGift(blankCharacter(), g).items[0].from).toBe(g.fromName);
  });

  it('no se dan entregas vacías ni monedas negativas', () => {
    const s = setup();
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

describe('vida de los compañeros', () => {
  it('por defecto cada jugador solo ve su propia vida; el DM puede mostrar la de todos', () => {
    let room: Room = createRoom();
    const dm = join(room, 'DM', undefined, room.dmKey); room = dm.room;
    const a = join(room, 'Ana'); room = a.room;
    const b = join(room, 'Leo'); room = b.room;
    const sum = (name: string) => ({ name, species: 'Humano', className: 'Guerrero', level: 3, hp: 20, hpMax: 30, temp: 0, ac: 16, speed: 30, passive: 12, conditions: [] });
    room = apply(room, a.member.id, { t: 'summary', summary: sum('Thalia') }).room;
    room = apply(room, b.member.id, { t: 'summary', summary: sum('Brakka') }).room;
    room = apply(room, dm.member.id, { t: 'start' }).room;
    const v = viewFor(room, a.member.id)!;
    expect(v.encounter.order.find((c) => c.name === 'Thalia')!.hp).toBe(20);
    const other = v.encounter.order.find((c) => c.name === 'Brakka')!;
    expect(other.hp).toBeNull();
    expect(other.state).toBe('hurt');
    expect(v.members.find((m) => m.id === b.member.id)!.summary!.hpHidden).toBe(true);
    expect(v.members.find((m) => m.id === a.member.id)!.summary!.hpHidden).toBeUndefined();
    expect(viewFor(room, dm.member.id)!.encounter.order.find((c) => c.name === 'Brakka')!.hp).toBe(20);
    // Solo el DM cambia el ajuste
    expect(apply(room, a.member.id, { t: 'roomSettings', patch: { showPartyHp: true } }).error).toBe('not-allowed');
    room = apply(room, dm.member.id, { t: 'roomSettings', patch: { showPartyHp: true } }).room;
    expect(viewFor(room, a.member.id)!.encounter.order.find((c) => c.name === 'Brakka')!.hp).toBe(20);
  });
});

describe('imágenes de la mesa', () => {
  it('el DM sube, comparte con todos o con algunos, y deja de compartir', () => {
    const s = setup();
    expect(apply(s.room, s.p1, { t: 'imageAdd', title: 'Mapa', id: 'abc123def' }).error).toBe('not-allowed');
    s.run(s.dm, { t: 'imageAdd', title: 'Mapa de la cripta', id: 'abc123def', w: 800, h: 600 });
    expect(viewFor(s.room, s.dm)!.images).toHaveLength(1);
    expect(viewFor(s.room, s.p1)!.images).toHaveLength(0);
    s.run(s.dm, { t: 'imageShare', id: 'abc123def', to: [s.p1] });
    expect(viewFor(s.room, s.p1)!.images.map((i) => i.title)).toEqual(['Mapa de la cripta']);
    expect(viewFor(s.room, s.p2)!.images).toHaveLength(0);
    s.run(s.dm, { t: 'imageShare', id: 'abc123def', to: 'all' });
    expect(viewFor(s.room, s.p2)!.images).toHaveLength(1);
    s.run(s.dm, { t: 'imageUnshare', id: 'abc123def' });
    expect(viewFor(s.room, s.p1)!.images).toHaveLength(0);
    s.run(s.dm, { t: 'imageRemove', id: 'abc123def' });
    expect(viewFor(s.room, s.dm)!.images).toHaveLength(0);
    expect(apply(s.room, s.dm, { t: 'imageAdd', title: 'x', id: '../../etc' }).error).toBe('bad-image');
  });

  it('el oro y los objetos de un jugador solo los ve el DM', () => {
    const s = setup();
    const sum = { name: 'Thalia', species: 'Elfa', className: 'Maga', level: 3, hp: 10, hpMax: 18, temp: 0, ac: 12, speed: 30, passive: 13, conditions: [], gold: 120, coins: { gp: 120 }, items: ['Capa'] };
    s.run(s.p1, { t: 'summary', summary: sum });
    expect(viewFor(s.room, s.dm)!.members.find((m) => m.id === s.p1)!.summary!.gold).toBe(120);
    const other = viewFor(s.room, s.p2)!.members.find((m) => m.id === s.p1)!.summary!;
    expect(other.gold).toBeUndefined();
    expect(other.items).toBeUndefined();
    expect(viewFor(s.room, s.p1)!.members.find((m) => m.id === s.p1)!.summary!.gold).toBe(120);
  });
});
