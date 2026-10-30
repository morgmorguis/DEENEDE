import { describe, expect, it } from 'vitest';
import { activeFlags, validate } from '../flags';
import { explain } from '../explain';
import { blankCharacter, createCharacter, sampleCharacter } from '../factory';
import { setLang } from '../../i18n';

describe('avisos', () => {
  it('la ficha de ejemplo no tiene errores', () => {
    setLang('es');
    const flags = validate(sampleCharacter());
    expect(flags.filter((f) => f.severity === 'error')).toEqual([]);
  });
  it('detecta datos que faltan e incompatibilidades', () => {
    const c = blankCharacter();
    const ids = validate(c).map((f) => f.id);
    expect(ids).toContain('missing-class');
    expect(ids).toContain('missing-saves');
    const w = createCharacter({ name: 'Ana', classId: 'mago', level: 3, species: 'Humano', background: 'Sabio', abilities: { str: 8, dex: 14, con: 13, int: 22, wis: 12, cha: 10 }, skills: ['arcanos', 'historia'] });
    w.saveProf = ['str', 'int'];
    w.hp.max = 99;
    w.spells.push({ id: 'x', name: 'Bola de fuego', level: 3, prepared: true, castingTime: '', range: '', concentration: false });
    w.skillProf.arcanos = 2;
    const wid = validate(w).map((f) => f.id);
    expect(wid).toEqual(expect.arrayContaining(['save-mismatch', 'hp-too-high', 'score-high:int', 'spell-too-high:bola de fuego', 'expertise']));
    w.ignoredFlags = ['save-mismatch'];
    expect(activeFlags(w).map((f) => f.id)).not.toContain('save-mismatch');
  });
});

describe('burbuja de información', () => {
  it('explica un conjuro con sus límites', () => {
    setLang('es');
    const c = createCharacter({ name: 'Ana', classId: 'mago', level: 3, species: 'Humano', background: 'Sabio', abilities: { str: 8, dex: 14, con: 13, int: 16, wis: 12, cha: 10 }, skills: [] });
    c.spells.push({ id: 's', name: 'Misty Step', level: 2, prepared: true, castingTime: '', range: '', concentration: false });
    c.slots[1].used = c.slots[1].max;
    const e = explain(c, { type: 'spell', id: 's' })!;
    expect(e.title).toBe('Paso brumoso');
    expect(e.limits.some((l) => l.tone === 'bad' && /No te quedan espacios/.test(l.text))).toBe(true);
    c.effects.push({ id: 'r', name: 'Furia', presetId: 'furia', kind: 'buff', roundsLeft: 10, concentration: false, mods: {} });
    expect(explain(c, { type: 'spell', id: 's' })!.limits.some((l) => /Furia/.test(l.text))).toBe(true);
  });
  it('explica una habilidad', () => {
    const c = sampleCharacter();
    const e = explain(c, { type: 'skill', id: 'atletismo' })!;
    expect(e.title).toBe('Atletismo');
    expect(e.lines.length).toBeGreaterThan(1);
  });
});
