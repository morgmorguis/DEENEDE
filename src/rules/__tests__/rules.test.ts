import { describe, expect, it } from 'vitest';
import { sampleCharacter, createCharacter } from '../factory';
import { parseInput } from '../parser';
import { applyCommand, type Command } from '../engine';
import { armorClass, profBonus, speed } from '../calc';
import type { Character } from '../../types';

const run = (c: Character, text: string) => {
  const { commands } = parseInput(text, c);
  let cur = c;
  const lines: string[] = [];
  for (const cmd of commands) {
    const r = applyCommand(cur, cmd);
    cur = r.char;
    lines.push(...r.lines);
  }
  return { c: cur, commands, lines };
};

describe('parser', () => {
  it('daño simple de un goblin', () => {
    const c = sampleCharacter();
    const r = run(c, 'Un goblin me ha atacado y me ha hecho 7 de daño');
    expect(r.commands[0]).toMatchObject({ type: 'damage', amount: 7, source: 'Goblin' });
    expect(r.c.hp.current).toBe(c.hp.current - 7);
  });
  it('tipo de daño explícito y resistencia por Furia', () => {
    let c = sampleCharacter();
    c = run(c, 'entro en furia').c;
    expect(c.effects.some((e) => e.presetId === 'furia')).toBe(true);
    const r = run(c, 'el orco me golpea con su hacha y me hace 9 de daño cortante');
    expect(r.commands[0]).toMatchObject({ type: 'damage', amount: 9, damageType: 'cortante', source: 'Orco' });
    expect(r.c.hp.current).toBe(c.hp.current - 4);
  });
  it('daño por arma deduce tipo', () => {
    const c = sampleCharacter();
    const r = run(c, 'me disparan una flecha y me quita 5');
    expect(r.commands[0]).toMatchObject({ type: 'damage', amount: 5, damageType: 'perforante' });
  });
  it('tirada de ataque que no supera la CA', () => {
    const c = sampleCharacter();
    const ac = armorClass(c).value;
    const r = run(c, `un esqueleto me ataca con un ${ac - 1} para impactar y 6 de daño`);
    expect(r.c.hp.current).toBe(c.hp.current);
  });
  it('dos tipos de daño', () => {
    const c = sampleCharacter();
    const r = run(c, 'me hace 5 cortante y 3 de fuego');
    expect(r.commands.filter((x) => x.type === 'damage')).toHaveLength(2);
    expect(r.c.hp.current).toBe(c.hp.current - 8);
  });
  it('números en letra', () => {
    const c = sampleCharacter();
    expect(run(c, 'me ha hecho siete de daño').c.hp.current).toBe(c.hp.current - 7);
  });
  it('PG temporales absorben primero', () => {
    let c = sampleCharacter();
    c = run(c, 'gano 5 puntos de golpe temporales').c;
    expect(c.hp.temp).toBe(5);
    const r = run(c, 'me hacen 8 de daño');
    expect(r.c.hp.temp).toBe(0);
    expect(r.c.hp.current).toBe(c.hp.current - 3);
  });
  it('curación y poción', () => {
    let c = sampleCharacter();
    c.hp.current = 10;
    c = run(c, 'me curo 6').c;
    expect(c.hp.current).toBe(16);
    const r = run(c, 'me bebo una poción de curación');
    expect(r.commands[0]).toMatchObject({ type: 'heal', dice: '2d4+2' });
    expect(r.c.hp.current).toBeGreaterThanOrEqual(20);
  });
  it('caer a 0 y muerte instantánea', () => {
    let c = sampleCharacter();
    c.hp.current = 5;
    const r = run(c, 'me hacen 10 de daño');
    expect(r.c.hp.current).toBe(0);
    expect(r.c.conditions).toContain('inconsciente');
    expect(r.c.dead).toBe(false);
    c = sampleCharacter();
    c.hp.current = 5;
    expect(run(c, `me hacen ${5 + c.hp.max} de daño`).c.dead).toBe(true);
  });
  it('condiciones y negación', () => {
    let c = sampleCharacter();
    c = run(c, 'estoy envenenado').c;
    expect(c.conditions).toContain('envenenado');
    c = run(c, 'ya no estoy envenenado').c;
    expect(c.conditions).not.toContain('envenenado');
    c = run(c, 'me tiran al suelo').c;
    expect(c.conditions).toContain('derribado');
    c = run(c, 'me levanto').c;
    expect(c.conditions).not.toContain('derribado');
  });
  it('escudo de la fe no activa escudo', () => {
    const c = sampleCharacter();
    const r = run(c, 'el clérigo me lanza escudo de la fe');
    expect(r.c.effects.map((e) => e.presetId)).toEqual(['escudo_fe']);
    expect(armorClass(r.c).value).toBe(armorClass(c).value + 2);
  });
  it('termina bendición', () => {
    let c = sampleCharacter();
    c = run(c, 'me lanzan bendición').c;
    expect(c.effects).toHaveLength(1);
    c = run(c, 'se acaba la bendición').c;
    expect(c.effects).toHaveLength(0);
  });
  it('concentración al recibir daño', () => {
    let c = createCharacter({ name: 'Mago', species: 'Elfo', classId: 'clerigo', level: 3, background: '', abilities: { str: 10, dex: 12, con: 14, int: 10, wis: 16, cha: 10 }, skills: [] });
    c.spells = [{ id: 'x', name: 'Arma espiritual', level: 2, prepared: true, castingTime: 'Acción adicional', range: '60 pies', concentration: true }];
    c = run(c, 'lanzo arma espiritual').c;
    expect(c.slots[1].used).toBe(1);
    expect(c.concentratingOn).toBe('Arma espiritual');
    const r = applyCommand(c, { type: 'damage', amount: 22 } as Command);
    expect(r.quickRolls[0].expr).toBe('concentration:11');
  });
  it('agotamiento', () => {
    let c = sampleCharacter();
    c = run(c, 'gano 2 niveles de agotamiento').c;
    expect(c.exhaustion).toBe(2);
    expect(speed(c).value).toBe(c.speed - 10);
  });
  it('descanso largo', () => {
    let c = sampleCharacter();
    c.hp.current = 3;
    c.exhaustion = 1;
    c = run(c, 'hacemos un descanso largo').c;
    expect(c.hp.current).toBe(c.hp.max);
    expect(c.exhaustion).toBe(0);
  });
  it('preguntas de reglas', () => {
    const c = sampleCharacter();
    const p = parseInput('¿qué hace derribado?', c);
    expect(p.question).toBe(true);
    expect((p.commands[0] as { text: string }).text).toMatch(/Derribado/);
    expect(parseInput('qué es sigilo', c).commands[0]).toMatchObject({ type: 'info' });
  });
  it('tiradas', () => {
    const c = sampleCharacter();
    expect(parseInput('tirada de salvación de destreza', c).commands[0]).toMatchObject({ type: 'rollSave', ability: 'dex' });
    expect(parseInput('tiro percepción', c).commands[0]).toMatchObject({ type: 'rollSkill', skill: 'percepcion' });
    expect(parseInput('tira 2d6+3', c).commands[0]).toMatchObject({ type: 'rollDice', expr: '2d6+3' });
    expect(parseInput('prueba de fuerza', c).commands[0]).toMatchObject({ type: 'rollAbility', ability: 'str' });
  });
  it('bonificador de competencia 2024', () => {
    expect([1, 4, 5, 8, 9, 13, 17, 20].map(profBonus)).toEqual([2, 2, 3, 3, 4, 5, 6, 6]);
  });
});
