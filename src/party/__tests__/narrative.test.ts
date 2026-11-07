import { beforeAll, describe, expect, it } from 'vitest';
import { setLang } from '../../i18n';
import { combatTranscript, lastCombat, localNarrative } from '../narrative';
import type { LogEvent } from '../protocol';

beforeAll(() => setLang('es'));
let i = 0;
const ev = (e: Partial<LogEvent>): LogEvent => ({ id: String(i++), at: i, round: 1, kind: 'other', ...e });

describe('resumen narrativo del combate', () => {
  const log: LogEvent[] = [
    ev({ kind: 'start' }), ev({ kind: 'end' }),
    ev({ kind: 'start' }),
    ev({ kind: 'add', target: 'Goblin 1' }), ev({ kind: 'add', target: 'Goblin 2' }),
    ev({ kind: 'hit', actor: 'Brakka', target: 'Goblin 1', amount: 12, weapon: 'Gran hacha' }),
    ev({ kind: 'down', actor: 'Brakka', target: 'Goblin 1' }),
    ev({ kind: 'miss', actor: 'Goblin 2', target: 'Brakka' }),
    ev({ kind: 'other', actor: 'Thalia', action: 'esconderse' }),
    ev({ kind: 'hit', actor: 'Thalia', target: 'Goblin 2', amount: 4, undone: true }),
    ev({ kind: 'round', round: 2 }),
  ];
  it('toma solo el último combate y sin lo deshecho', () => {
    const last = lastCombat(log);
    expect(last[0].kind).toBe('start');
    expect(last.some((e) => e.undone)).toBe(false);
    expect(combatTranscript(last)).toContain('Brakka hits Goblin 1 [Gran hacha] for 12 damage');
  });
  it('cuenta golpes, fallos, derrotas y acciones en prosa', () => {
    const { title, text } = localNarrative(lastCombat(log));
    expect(title).toContain('Goblin 1');
    expect(text).toContain('Brakka');
    expect(text).toMatch(/Goblin 2 intentó golpear a Brakka, pero falló|El ataque de Goblin 2 contra Brakka/);
    expect(text).toContain('Thalia se escondió');
    expect(text).toMatch(/derrotó a Goblin 1|Goblin 1 cayó ante Brakka/);
    expect(text).toContain('Tras 2 rondas');
  });
});

describe('secretos del DM', () => {
  it('el resumen no menciona a quien sigue oculto y los jugadores no ven su entrada ni tras terminar el combate', async () => {
    const { apply, createRoom, join, viewFor } = await import('../room');
    let room = createRoom();
    const dmJ = join(room, 'DM', undefined, room.dmKey); room = dmJ.room;
    const a = join(room, 'Ana'); room = a.room;
    const run = (cmd: Parameters<typeof apply>[2]) => { const r = apply(room, dmJ.member.id, cmd); if (r.error) throw new Error(r.error); room = r.room; };
    run({ t: 'start' });
    run({ t: 'add', combatants: [{ name: 'Goblin', kind: 'monster', hpMax: 7, ac: 15 }, { name: 'Jefe goblin', kind: 'monster', hpMax: 21, ac: 17, hidden: true }] });
    const dmView = viewFor(room, dmJ.member.id)!;
    const ev = lastCombat(dmView.log, dmView.encounter.order);
    expect(localNarrative(ev).text).not.toContain('Jefe');
    run({ t: 'end' });
    expect(JSON.stringify(viewFor(room, a.member.id)!.log)).not.toContain('Jefe');
    const after = viewFor(room, dmJ.member.id)!;
    expect(localNarrative(lastCombat(after.log, after.encounter.order)).text).not.toContain('Jefe');
  });
});
