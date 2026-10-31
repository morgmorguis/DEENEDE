import { describe, expect, it } from 'vitest';
import { applyLevelUp, newSpellAllowance } from '../levelup';
import { createCharacter, sampleCharacter } from '../factory';
import { levelEntry } from '../progression';
import { setLang } from '../../i18n';

describe('subir de nivel', () => {
  it('bárbaro 3→4 con mejora de característica', () => {
    setLang('es');
    const c = sampleCharacter();
    expect(c.level).toBe(3);
    const con = c.abilities.con;
    const n = applyLevelUp(c, { hpGain: 9, asi: { mode: 'asi', plus: { con: 2 } } });
    expect(n.level).toBe(4);
    expect(n.abilities.con).toBe(Math.min(20, con + 2));
    // +9 del dado y +1 por nivel si sube el modificador de CON
    const delta = Math.floor((n.abilities.con - 10) / 2) - Math.floor((con - 10) / 2);
    expect(n.hp.max).toBe(c.hp.max + 9 + delta * 4);
  });
  it('mago 2→3: subclase, espacios y conjuros nuevos', () => {
    const c = createCharacter({ name: 'Ana', classId: 'mago', level: 2, species: 'Humano', background: 'Sabio', abilities: { str: 8, dex: 14, con: 13, int: 16, wis: 12, cha: 10 }, skills: ['arcanos'] });
    expect(levelEntry('mago', 3).choices[0].kind).toBe('subclass');
    const allow = newSpellAllowance('mago', 2);
    expect(allow.maxLevel).toBe(2);
    expect(allow.spells).toBe(1);
    const n = applyLevelUp(c, { hpGain: 5, subclass: 'evoker', spells: ['Misty Step'] });
    expect(n.subclass).toBe('Evocador');
    expect(n.slots.map((s) => s.max)).toEqual([4, 2]);
    expect(n.spells.some((s) => s.name === 'Paso brumoso')).toBe(true);
    expect(n.features.some((f) => f.name === 'Evocador')).toBe(true);
  });
  it('pícaro 5→6 con pericia y guerrero 1→2', () => {
    const r = createCharacter({ name: 'R', classId: 'picaro', level: 5, species: 'Humano', background: 'Criminal', abilities: { str: 8, dex: 16, con: 12, int: 12, wis: 12, cha: 10 }, skills: ['sigilo', 'atletismo'] });
    const n = applyLevelUp(r, { hpGain: 6, expertise: ['atletismo'] });
    expect(n.skillProf.atletismo).toBe(2);
    const f = createCharacter({ name: 'F', classId: 'guerrero', level: 1, species: 'Humano', background: 'Soldado', abilities: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 10 }, skills: [] });
    const f2 = applyLevelUp(f, { hpGain: 8 });
    expect(f2.resources.some((x) => x.key === 'action_surge')).toBe(true);
    expect(f2.features.some((x) => x.name === 'Oleada de acción')).toBe(true);
  });
});
