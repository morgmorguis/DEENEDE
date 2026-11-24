import { describe, expect, it } from 'vitest';
import { apply, canFetchImage, createRoom, exportCampaign, importCampaign, join, viewFor, type Room } from '../room';
import type { Command, PcSummary } from '../protocol';

const summary = (name: string, gold = 0): PcSummary => ({ name, species: 'Humano', className: 'Guerrero', level: 3, hp: 20, hpMax: 20, temp: 0, ac: 16, speed: 30, passive: 12, conditions: [], gold });

function setup() {
  let room: Room = { ...createRoom(), open: true };
  const dmJ = join(room, 'Marc', undefined, room.dmKey); room = dmJ.room;
  const p1 = join(room, 'Ana'); room = p1.room;
  const p2 = join(room, 'Leo'); room = p2.room;
  const run = (who: string, cmd: Command) => {
    const r = apply(room, who, cmd);
    if (r.error) throw new Error(r.error);
    room = r.room;
    return r;
  };
  const err = (who: string, cmd: Command) => apply(room, who, cmd).error;
  run(p1.member.id, { t: 'summary', summary: summary('Thalia', 30) });
  run(p2.member.id, { t: 'summary', summary: summary('Brakka', 2) });
  return { get room() { return room; }, run, err, dm: dmJ.member.id, p1: p1.member.id, p2: p2.member.id };
}

describe('tiradas que pide el DM', () => {
  it('se piden a todos, cada uno responde una vez y se cierra sola', () => {
    const s = setup();
    s.run(s.dm, { t: 'rollAsk', ask: { kind: 'save', ability: 'dex' }, dc: 14, to: 'all', note: 'Trampa' });
    const q = viewFor(s.room, s.p1)!.rollRequests[0];
    expect(q.to).toEqual([s.p1, s.p2]);
    expect(q.dc).toBe(14);
    s.run(s.p1, { t: 'rollAnswer', id: q.id, total: 17, natural: 12 });
    expect(s.err(s.p1, { t: 'rollAnswer', id: q.id, total: 20 })).toBe('roll-answered');
    // El compañero ve el resultado (no es secreta)
    expect(viewFor(s.room, s.p2)!.rollRequests[0].answers[0]).toMatchObject({ name: 'Thalia', total: 17 });
    s.run(s.p2, { t: 'rollAnswer', id: q.id, total: 9, natural: 6, manual: true });
    expect(viewFor(s.room, s.dm)!.rollRequests[0].closed).toBe(true);
    expect(s.err(s.dm, { t: 'rollAsk', ask: { kind: 'skill', skill: 'x!' }, to: 'all' })).toBe('bad-roll');
  });

  it('solo responde a quien se le pide, y no después de cerrarla', () => {
    const s = setup();
    s.run(s.dm, { t: 'rollAsk', ask: { kind: 'skill', skill: 'percepcion' }, to: [s.p1] });
    const id = viewFor(s.room, s.dm)!.rollRequests[0].id;
    expect(s.err(s.p2, { t: 'rollAnswer', id, total: 10 })).toBe('not-allowed');
    s.run(s.dm, { t: 'rollClose', id });
    expect(s.err(s.p1, { t: 'rollAnswer', id, total: 10 })).toBe('roll-closed');
    expect(s.err(s.p1, { t: 'rollAsk', ask: { kind: 'save', ability: 'con' }, to: 'all' })).toBe('not-allowed');
  });

  it('las secretas: el jugador solo sabe que tiene que responder y nadie más ve el resultado', () => {
    const s = setup();
    s.run(s.dm, { t: 'rollAsk', ask: { kind: 'skill', skill: 'perspicacia' }, secret: true, to: [s.p1] });
    expect(viewFor(s.room, s.p2)!.rollRequests).toHaveLength(0);
    const mine = viewFor(s.room, s.p1)!.rollRequests;
    expect(mine).toHaveLength(1);
    s.run(s.p1, { t: 'rollAnswer', id: mine[0].id, total: 4, natural: 2 });
    expect(viewFor(s.room, s.p1)!.rollRequests).toHaveLength(0);
    expect(viewFor(s.room, s.dm)!.rollRequests[0].answers[0].total).toBe(4);
  });

  it('las tiradas ocultas del DM no llegan a los jugadores', () => {
    const s = setup();
    s.run(s.dm, { t: 'dmRoll', label: '1d20+5', total: 18, detail: '13+5', hidden: true });
    s.run(s.dm, { t: 'dmRoll', label: '2d6', total: 7, detail: '3+4', hidden: false });
    expect(viewFor(s.room, s.dm)!.dmRolls).toHaveLength(2);
    expect(viewFor(s.room, s.p1)!.dmRolls.map((x) => x.total)).toEqual([7]);
  });
});

describe('inspiración heroica', () => {
  it('solo la da el DM y viaja como entrega', () => {
    const s = setup();
    s.run(s.dm, { t: 'give', toId: s.p1, inspiration: true });
    expect(viewFor(s.room, s.p1)!.gifts[0].inspiration).toBe(true);
    expect(s.err(s.p1, { t: 'give', toId: s.p2, inspiration: true })).toBe('empty-gift');
  });
});

describe('tablón de la campaña', () => {
  it('los jugadores ven solo lo compartido y sin las notas secretas', () => {
    const s = setup();
    s.run(s.dm, { t: 'imageAdd', id: 'retrato01', title: 'Bruna' });
    s.run(s.dm, { t: 'questSave', quest: { id: '', title: 'El ídolo robado', text: 'Recuperarlo', status: 'active', shared: true, secret: 'Lo tiene el alcalde', at: 0, updatedAt: 0 } });
    s.run(s.dm, { t: 'questSave', quest: { id: '', title: 'Secreta', text: '', status: 'active', shared: false, at: 0, updatedAt: 0 } });
    s.run(s.dm, { t: 'npcSave', npc: { id: '', name: 'Bruna', text: 'Tabernera', attitude: 'friendly', imageId: 'retrato01', shared: true, secret: 'Es espía', at: 0, updatedAt: 0 } });
    const v = viewFor(s.room, s.p1)!;
    expect(v.quests.map((q) => q.title)).toEqual(['El ídolo robado']);
    expect(v.quests[0].secret).toBeUndefined();
    expect(v.npcs[0].secret).toBeUndefined();
    expect(viewFor(s.room, s.dm)!.quests).toHaveLength(2);
    // El retrato no está compartido como imagen, pero el jugador puede descargarlo porque conoce al PNJ
    const im = s.room.images[0];
    expect(v.images).toHaveLength(0);
    expect(canFetchImage(s.room, { id: s.p1, role: 'player' }, im)).toBe(true);
    // Editar conserva el id; marcar como cumplida
    const id = viewFor(s.room, s.dm)!.quests[0].id;
    s.run(s.dm, { t: 'questSave', quest: { ...viewFor(s.room, s.dm)!.quests[0], status: 'done' } });
    expect(viewFor(s.room, s.p1)!.quests[0]).toMatchObject({ id, status: 'done' });
    expect(s.err(s.p1, { t: 'questRemove', id })).toBe('not-allowed');
    // Se guardan en la copia de la campaña
    const back = importCampaign(createRoom(), exportCampaign(s.room));
    expect(back.quests).toHaveLength(2);
    expect(back.npcs![0].name).toBe('Bruna');
  });
});

describe('tienda del DM', () => {
  const sword = { name: 'Espada larga', rarity: 'mundane' as const, type: 'weapon' as const, description: '', value: 15, qty: 1 };
  it('comprar crea una entrega con cobro, gasta existencias y comprueba el dinero', () => {
    const s = setup();
    s.run(s.dm, { t: 'shopSave', shop: { open: false, name: 'La Forja', items: [{ id: 'esp', item: sword, price: 15, stock: 2 }] } });
    expect(viewFor(s.room, s.p1)!.shop).toBeNull();
    expect(s.err(s.p1, { t: 'buy', itemId: 'esp', qty: 1 })).toBe('shop-closed');
    s.run(s.dm, { t: 'shopSave', shop: { ...viewFor(s.room, s.dm)!.shop!, open: true } });
    expect(viewFor(s.room, s.p1)!.shop!.name).toBe('La Forja');
    s.run(s.p1, { t: 'buy', itemId: 'esp', qty: 1 });
    const g = viewFor(s.room, s.p1)!.gifts[0];
    expect(g).toMatchObject({ charge: 15, shop: true, note: 'La Forja' });
    expect(g.items![0]).toMatchObject({ name: 'Espada larga', qty: 1 });
    // 30 po menos 15 pendientes de cobrar: no llega para otra de 15… sí llega justo; para 2 no
    expect(s.err(s.p1, { t: 'buy', itemId: 'esp', qty: 2 })).toBe('out-of-stock');
    expect(s.err(s.p2, { t: 'buy', itemId: 'esp', qty: 1 })).toBe('no-money');
    s.run(s.p1, { t: 'buy', itemId: 'esp', qty: 1 });
    expect(s.err(s.p1, { t: 'buy', itemId: 'esp', qty: 1 })).toBe('out-of-stock');
    expect(viewFor(s.room, s.dm)!.shop!.items[0].stock).toBe(0);
  });
});

describe('sesiones', () => {
  it('crear la partida apunta el inicio de la sesión (solo lo ve el DM) y la crónica puede ser un resumen', () => {
    const s = setup();
    s.run(s.dm, { t: 'openGame' });
    expect(viewFor(s.room, s.dm)!.sessions).toHaveLength(1);
    s.run(s.dm, { t: 'chronicleShare', title: 'En la sesión anterior…', text: 'Pasaron cosas', recap: true });
    expect(viewFor(s.room, s.dm)!.chronicles[0].recap).toBe(true);
  });
});
