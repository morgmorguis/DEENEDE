import { describe, expect, it } from 'vitest';
import { apply, createRoom, join, viewFor, type Room } from '../room';
import type { Command, PcSummary } from '../protocol';
import { lastSessionRange, localRecap, recapMaterial } from '../recap';
import { askBonus, manualAsk, pendingAsks, rollAsk, rollLines } from '../rolls';
import { receiveGift } from '../client';
import { sampleCharacter } from '../../rules/factory';
import { skillBonus } from '../../rules/calc';

const summary = (name: string): PcSummary => ({ name, species: 'Humano', className: 'Guerrero', level: 3, hp: 20, hpMax: 20, temp: 0, ac: 16, speed: 30, passive: 12, conditions: [], gold: 100 });

function setup() {
  let room: Room = createRoom();
  const dm = join(room, 'Marc', undefined, room.dmKey); room = dm.room;
  const run = (who: string, cmd: Command) => { const r = apply(room, who, cmd); if (r.error) throw new Error(r.error); room = r.room; };
  run(dm.member.id, { t: 'openGame' });
  const p1 = join(room, 'Ana'); room = p1.room;
  run(p1.member.id, { t: 'summary', summary: summary('Thalia') });
  return { get room() { return room; }, set room(r: Room) { room = r; }, run, dm: dm.member.id, p1: p1.member.id };
}

describe('sesión anterior', () => {
  it('el rango es la sesión de antes si la partida está abierta, o la última si está cerrada', () => {
    expect(lastSessionRange({ sessions: [100, 200], open: true }, 999)).toEqual({ from: 100, to: 200 });
    expect(lastSessionRange({ sessions: [100, 200], open: false }, 999)).toEqual({ from: 200, to: 999 });
    expect(lastSessionRange({ sessions: [], open: true }, 999)).toEqual({ from: 0, to: 999 });
  });

  it('cuenta lo compartido y nunca lo secreto', () => {
    const s = setup();
    s.run(s.dm, { t: 'prepare', title: 'Emboscada en el camino' });
    s.run(s.dm, { t: 'add', combatants: [{ name: 'Goblin', kind: 'monster', hp: 7, hpMax: 7 }, { name: 'Jefe oculto', kind: 'monster', hp: 20, hpMax: 20, hidden: true }] });
    s.run(s.dm, { t: 'launch' });
    s.run(s.dm, { t: 'begin' });
    const goblin = viewFor(s.room, s.dm)!.encounter.order.find((c) => c.name === 'Goblin')!;
    const thalia = viewFor(s.room, s.dm)!.encounter.order.find((c) => c.kind === 'pc')!;
    s.run(s.dm, { t: 'act', actorId: thalia.id, kind: 'hit', targetId: goblin.id, amount: 9 });
    s.run(s.dm, { t: 'end' });
    s.run(s.dm, { t: 'give', toId: s.p1, items: [{ name: 'Daga +1', rarity: 'uncommon', type: 'weapon', description: '', value: 300, qty: 1 }] });
    s.run(s.dm, { t: 'questSave', quest: { id: '', title: 'El ídolo robado', text: '', status: 'active', shared: true, at: 0, updatedAt: 0 } });
    s.run(s.dm, { t: 'questSave', quest: { id: '', title: 'Plan del barón', text: '', status: 'active', shared: false, at: 0, updatedAt: 0 } });
    s.run(s.dm, { t: 'npcSave', npc: { id: '', name: 'Bruna', text: 'Tabernera', attitude: 'friendly', shared: true, at: 0, updatedAt: 0 } });
    const view = viewFor(s.room, s.dm)!;
    const m = recapMaterial(view, { from: 0, to: Date.now() + 1 });
    expect(m.combats[0].title).toBe('Emboscada en el camino');
    expect(m.combats[0].downs[0]).toContain('Goblin');
    expect(m.loot[0]).toContain('Daga +1');
    expect(m.questsNew).toEqual(['El ídolo robado']);
    expect(m.npcs[0]).toContain('Bruna');
    const text = localRecap(m);
    expect(text).toContain('Emboscada');
    expect(text).not.toContain('barón');
    expect(text).not.toContain('Jefe oculto');
  });
});

describe('tiradas del jugador', () => {
  it('con el dado físico suma su bonificador y resta el agotamiento', () => {
    const c = sampleCharacter();
    c.exhaustion = 1;
    const b = skillBonus(c, 'percepcion');
    const r = manualAsk(c, { kind: 'skill', skill: 'percepcion' }, 12);
    expect(r.total).toBe(12 + b - 2);
    expect(askBonus(c, { kind: 'skill', skill: 'percepcion' })).toBe(b);
    const app = rollAsk(c, { kind: 'save', ability: 'dex' });
    expect(app.natural).toBeGreaterThanOrEqual(1);
    expect(app.lines[app.lines.length - 1]).toBe(`Total: ${app.total}`);
  });

  it('el aviso solo sale con tiradas no secretas pendientes, y el registro junta pedidas y del DM a la vista', () => {
    const s = setup();
    s.run(s.dm, { t: 'rollAsk', ask: { kind: 'save', ability: 'wis' }, dc: 13, to: 'all' });
    s.run(s.dm, { t: 'rollAsk', ask: { kind: 'skill', skill: 'perspicacia' }, secret: true, to: 'all' });
    s.run(s.dm, { t: 'dmRoll', label: '1d20', total: 11, detail: '1d20[11]', hidden: false });
    let v = viewFor(s.room, s.p1)!;
    expect(pendingAsks(v)).toHaveLength(1);
    s.run(s.p1, { t: 'rollAnswer', id: pendingAsks(v)[0].id, total: 15, natural: 13 });
    v = viewFor(s.room, s.p1)!;
    expect(pendingAsks(v)).toHaveLength(0);
    const lines = rollLines(v);
    expect(lines.map((l) => l.total).sort()).toEqual([11, 15]);
    expect(lines.find((l) => l.total === 15)!.dc).toBe(13);
  });

  it('la inspiración del DM llega a la ficha', () => {
    const c = sampleCharacter();
    c.heroicInspiration = false;
    const r = receiveGift(c, { id: 'g1', at: 0, toId: 'x', toName: 'X', inspiration: true, delivered: false });
    expect(r.char.heroicInspiration).toBe(true);
    expect(r.lines[0]).toContain('✨');
  });
});
