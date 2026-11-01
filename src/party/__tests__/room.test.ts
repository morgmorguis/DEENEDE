import { describe, expect, it } from 'vitest';
import { apply, createRoom, hpState, join, viewFor, type Room } from '../room';
import type { Command, PcSummary } from '../protocol';

const summary = (name: string, hp = 20): PcSummary => ({ name, species: 'Humano', className: 'Guerrero', level: 3, hp, hpMax: hp, temp: 0, ac: 16, speed: 30, passive: 12, conditions: [] });

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
  run(p1.member.id, { t: 'summary', summary: summary('Thalia') });
  run(p2.member.id, { t: 'summary', summary: summary('Brakka', 30) });
  return { get room() { return room; }, run, dm: dmJ.member.id, p1: p1.member.id, p2: p2.member.id };
}

describe('partida compartida', () => {
  it('el DM entra con su clave y los jugadores como jugadores', () => {
    const s = setup();
    expect(viewFor(s.room, s.dm)!.you.role).toBe('dm');
    expect(viewFor(s.room, s.p1)!.you.role).toBe('player');
    // Reconectar con el token conserva el mismo miembro
    const again = join(s.room, 'Ana', s.room.members.find((m) => m.id === s.p1)!.token);
    expect(again.member.id).toBe(s.p1);
  });

  it('los jugadores no ven monstruos ocultos ni la vida exacta, pero sí su estado', () => {
    const s = setup();
    s.run(s.dm, { t: 'start' });
    s.run(s.dm, { t: 'add', combatants: [{ name: 'Goblin', kind: 'monster', hpMax: 10, ac: 15, notes: 'huye a 3 PG' }, { name: 'Asesino', kind: 'monster', hpMax: 40, hidden: true }] });
    const gob = s.room.encounter.order.find((c) => c.name === 'Goblin')!;
    s.run(s.dm, { t: 'begin' });
    const pv = viewFor(s.room, s.p1)!;
    expect(pv.encounter.order.map((c) => c.name).sort()).toEqual(['Brakka', 'Goblin', 'Thalia']);
    const g = pv.encounter.order.find((c) => c.name === 'Goblin')!;
    expect(g.hp).toBeNull();
    expect(g.ac).toBeNull();
    expect(g.notes).toBeUndefined();
    expect(JSON.stringify(pv)).not.toContain('Asesino');
    expect(JSON.stringify(pv)).not.toContain('huye');
    // Thalia le hace 6: queda ensangrentado (≤ mitad)
    const thalia = s.room.encounter.order.find((c) => c.name === 'Thalia')!;
    s.run(s.p1, { t: 'act', actorId: thalia.id, kind: 'hit', targetId: gob.id, amount: 6 });
    const pv2 = viewFor(s.room, s.p1)!;
    expect(pv2.encounter.order.find((c) => c.id === gob.id)!.state).toBe('bloodied');
    expect(pv2.log[pv2.log.length - 1]!.after).toBeUndefined();
    const dv = viewFor(s.room, s.dm)!;
    expect(dv.encounter.order.find((c) => c.id === gob.id)!.hp).toBe(4);
    expect(dv.log[dv.log.length - 1]!.after).toBe('4/10');
    expect(hpState({ hp: 0, hpMax: 10 })).toBe('down');
  });

  it('un jugador no puede actuar por otro ni tocar monstruos ocultos', () => {
    const s = setup();
    s.run(s.dm, { t: 'start' });
    s.run(s.dm, { t: 'add', combatants: [{ name: 'Sombra', kind: 'monster', hpMax: 20, hidden: true }] });
    s.run(s.dm, { t: 'begin' });
    const brakka = s.room.encounter.order.find((c) => c.name === 'Brakka')!;
    const sombra = s.room.encounter.order.find((c) => c.name === 'Sombra')!;
    const thalia = s.room.encounter.order.find((c) => c.name === 'Thalia')!;
    expect(apply(s.room, s.p1, { t: 'act', actorId: brakka.id, kind: 'hit', targetId: sombra.id, amount: 3 }).error).toBe('not-allowed');
    expect(apply(s.room, s.p1, { t: 'act', actorId: thalia.id, kind: 'hit', targetId: sombra.id, amount: 3 }).error).toBe('not-allowed');
    expect(apply(s.room, s.p1, { t: 'add', combatants: [{ name: 'X' }] }).error).toBe('not-allowed');
  });

  it('daño a un jugador se envía a su ficha y deshacer último turno lo revierte', () => {
    const s = setup();
    s.run(s.dm, { t: 'start' });
    s.run(s.dm, { t: 'add', combatants: [{ name: 'Orco', kind: 'monster', hpMax: 15, initiative: 5 }] });
    const ids = Object.fromEntries(s.room.encounter.order.map((c) => [c.name, c.id]));
    s.run(s.p1, { t: 'setInitiative', id: ids.Thalia, value: 18 });
    s.run(s.p2, { t: 'setInitiative', id: ids.Brakka, value: 12 });
    expect(s.room.encounter.order.map((c) => c.name)).toEqual(['Thalia', 'Brakka', 'Orco']);
    s.run(s.dm, { t: 'begin' });
    // Turno de Thalia: pega al orco
    s.run(s.p1, { t: 'act', actorId: ids.Thalia, kind: 'hit', targetId: ids.Orco, amount: 7 });
    expect(() => s.run(s.p2, { t: 'nextTurn' })).toThrow('not-allowed');
    s.run(s.p1, { t: 'nextTurn' });
    s.run(s.p2, { t: 'nextTurn' });
    // Turno del orco: el DM anota que pega a Brakka
    const r = s.run(s.dm, { t: 'act', actorId: ids.Orco, kind: 'hit', targetId: ids.Brakka, amount: 9 });
    expect(r.effects).toEqual([{ to: s.p2, ops: [{ op: 'damage', amount: 9, from: 'Orco' }] }]);
    expect(s.room.encounter.order.find((c) => c.id === ids.Brakka)!.hp).toBe(21);
    // Deshacer: se revierte el golpe del orco y la ficha de Brakka recibe su vida anterior
    const u = s.run(s.dm, { t: 'undo' });
    expect(u.effects).toEqual([{ to: s.p2, ops: [{ op: 'setHp', hp: 30, temp: 0 }] }]);
    expect(s.room.encounter.order.find((c) => c.id === ids.Brakka)!.hp).toBe(30);
    expect(s.room.log.find((e) => e.kind === 'hit' && e.amount === 9)!.undone).toBe(true);
    // Volver a deshacer (sin acciones en el turno): vuelve al turno de Brakka
    s.run(s.dm, { t: 'undo' });
    expect(s.room.encounter.order[s.room.encounter.turn].name).toBe('Brakka');
    // Ahora deshacer quitaría el turno de Thalia: ella puede, Brakka no
    expect(viewFor(s.room, s.p1)!.canUndo).toBe(true);
    expect(viewFor(s.room, s.p2)!.canUndo).toBe(false);
    s.run(s.p1, { t: 'undo' });
    expect(s.room.encounter.order.find((c) => c.id === ids.Orco)!.hp).toBe(15);
    expect(s.room.encounter.order[s.room.encounter.turn].name).toBe('Thalia');
    expect(viewFor(s.room, s.p1)!.canUndo).toBe(false); // nada hecho en este turno y no hay turno anterior
  });

  it('los monstruos derrotados se saltan y se anota la caída', () => {
    const s = setup();
    s.run(s.dm, { t: 'start' });
    s.run(s.dm, { t: 'add', combatants: [{ name: 'Rata', kind: 'monster', hpMax: 3, initiative: 1 }] });
    const ids = Object.fromEntries(s.room.encounter.order.map((c) => [c.name, c.id]));
    s.run(s.dm, { t: 'setInitiative', id: ids.Thalia, value: 15 });
    s.run(s.dm, { t: 'setInitiative', id: ids.Brakka, value: 10 });
    s.run(s.dm, { t: 'begin' });
    s.run(s.p1, { t: 'act', actorId: ids.Thalia, kind: 'hit', targetId: ids.Rata, amount: 5 });
    expect(s.room.log.some((e) => e.kind === 'down' && e.target === 'Rata')).toBe(true);
    // Orden: Thalia, Brakka y la rata; la rata derrotada se salta
    s.run(s.dm, { t: 'nextTurn' });
    s.run(s.dm, { t: 'nextTurn' });
    expect(s.room.encounter.order[s.room.encounter.turn].name).toBe('Thalia');
    expect(s.room.encounter.round).toBe(2);
  });

  it('preparación: cada uno pone su iniciativa y marca Listo; empieza cuando están todos', () => {
    const s = setup();
    for (const m of s.room.members) m.online = true;
    s.run(s.dm, { t: 'start' });
    expect(viewFor(s.room, s.p1)!.encounter.phase).toBe('setup');
    const ids = Object.fromEntries(s.room.encounter.order.map((c) => [c.name, c.id]));
    // Sin iniciativa no puede marcar listo, y no se puede actuar todavía
    expect(apply(s.room, s.p1, { t: 'ready', value: true }).error).toBe('need-initiative');
    expect(apply(s.room, s.p1, { t: 'act', actorId: ids.Thalia, kind: 'other', text: 'x' }).error).toBe('not-running');
    s.run(s.p1, { t: 'setInitiative', id: ids.Thalia, value: 12 });
    s.run(s.p1, { t: 'ready', value: true });
    s.run(s.p1, { t: 'ready', value: false });
    s.run(s.p1, { t: 'ready', value: true });
    s.run(s.p2, { t: 'setInitiative', id: ids.Brakka, value: 17 });
    s.run(s.p2, { t: 'ready', value: true });
    expect(s.room.encounter.phase).toBe('setup');
    expect(viewFor(s.room, s.dm)!.encounter.needed.sort()).toEqual([s.dm, s.p1, s.p2].sort());
    s.run(s.dm, { t: 'ready', value: true });
    expect(s.room.encounter.phase).toBe('running');
    expect(s.room.encounter.order.map((c) => c.name)).toEqual(['Brakka', 'Thalia']);
    expect(s.room.log.some((e) => e.kind === 'begin')).toBe(true);
  });

  it('el DM guarda personajes en su lista y los mete en el combate; los jugadores no la ven', () => {
    const s = setup();
    s.run(s.dm, { t: 'rosterSave', entry: { id: '', name: 'Capitán Vex', kind: 'monster', level: 'VD 2', hpMax: 52, ac: 15, initBonus: 3, notes: 'traiciona al grupo' } });
    const entry = s.room.roster[0];
    expect(viewFor(s.room, s.p1)!.roster).toEqual([]);
    expect(viewFor(s.room, s.dm)!.roster[0].name).toBe('Capitán Vex');
    expect(apply(s.room, s.p1, { t: 'rosterSave', entry }).error).toBe('not-allowed');
    s.run(s.dm, { t: 'start' });
    s.run(s.dm, { t: 'rosterToCombat', id: entry.id, count: 2, hidden: true });
    const vex = s.room.encounter.order.filter((c) => c.name.startsWith('Capitán Vex'));
    expect(vex.map((c) => c.name)).toEqual(['Capitán Vex 1', 'Capitán Vex 2']);
    expect(vex.every((c) => c.hidden && c.hpMax === 52 && c.initiative! >= 4 && c.initiative! <= 23)).toBe(true);
    expect(JSON.stringify(viewFor(s.room, s.p1))).not.toContain('Vex');
  });
});
