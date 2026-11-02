import { describe, expect, it } from 'vitest';
import { BACKGROUNDS, CLASS_SKILLS, SPECIES_SKILLS, findBackground } from '../origins';
import { SKILLS } from '../srd';
import { BODIES, FACES, HAIRS, OUTFITS, defaultLook, portraitSvg, randomLook } from '../avatar';

const ids = new Set(SKILLS.map((s) => s.id));

describe('elecciones de origen', () => {
  it('todas las habilidades de trasfondos, clases y especies existen', () => {
    for (const b of BACKGROUNDS) for (const s of b.skills) expect(ids.has(s), `${b.id}: ${s}`).toBe(true);
    for (const [cls, v] of Object.entries(CLASS_SKILLS)) for (const s of v.list) expect(ids.has(s), `${cls}: ${s}`).toBe(true);
    for (const [sp, v] of Object.entries(SPECIES_SKILLS)) for (const s of v.list) expect(ids.has(s), `${sp}: ${s}`).toBe(true);
  });
  it('cada clase elige menos habilidades de las que hay en su lista', () => {
    for (const v of Object.values(CLASS_SKILLS)) expect(v.count).toBeLessThan(v.list.length);
  });
  it('encuentra el trasfondo por su nombre en español o inglés', () => {
    expect(findBackground('Acólito')?.id).toBe('acolyte');
    expect(findBackground('sage')?.id).toBe('sage');
    expect(findBackground('Trotamundos')?.id).toBe('wayfarer');
    expect(findBackground('')).toBeUndefined();
  });
});

describe('retrato de cuerpo entero', () => {
  it('hay al menos 10 caras, cuerpos, peinados y 10 ropajes por clase', () => {
    expect(FACES.length).toBeGreaterThanOrEqual(10);
    expect(BODIES.length).toBeGreaterThanOrEqual(10);
    expect(HAIRS.length).toBeGreaterThanOrEqual(10);
    for (const id of ['barbaro', 'bardo', 'clerigo', 'druida', 'guerrero', 'monje', 'paladin', 'explorador', 'picaro', 'hechicero', 'brujo', 'mago']) expect(OUTFITS[id]).toHaveLength(10);
  });
  it('dibuja todas las combinaciones sin errores y con los colores elegidos', () => {
    for (const cls of Object.keys(OUTFITS)) for (let i = 0; i < 10; i++) {
      const lk = { ...defaultLook('humano', undefined, cls), outfit: i, face: i, body: i, hair: i, beard: i % 6, backdrop: i % 8, main: '#123456' };
      const svg = portraitSvg(lk);
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).not.toMatch(/NaN|undefined/);
    }
    expect(portraitSvg({ ...defaultLook('humano', undefined, 'mago'), main: '#123456' })).toContain('#123456');
  });
  it('el aspecto inicial depende de la especie y la clase', () => {
    expect(defaultLook('elfo', undefined, 'mago').ears).toBe('pointy');
    expect(defaultLook('tiefling', undefined, 'brujo').horns).toBe(true);
    expect(defaultLook('orco', undefined, 'barbaro').tusks).toBe(true);
    expect(defaultLook('draconido', 'blue', 'paladin').skin).not.toBe(defaultLook('draconido', 'red', 'paladin').skin);
    expect(defaultLook('humano', undefined, 'picaro').outfitClass).toBe('picaro');
    expect(defaultLook('humano', undefined, '').outfitClass).toBe('guerrero');
  });
  it('el aleatorio respeta los rasgos de la especie', () => {
    const base = defaultLook('draconido', 'red', 'paladin');
    for (let i = 0; i < 20; i++) {
      const l = randomLook(base);
      expect(l.snout).toBe(true);
      expect(l.beard).toBe(0);
      expect(l.outfitClass).toBe('paladin');
    }
  });
});

import { createCharacter } from '../factory';
import { spellSuggestions, featureSuggestions } from '../suggest';

describe('lista de disponibles', () => {
  it('sin escribir nada muestra todos los conjuros que puede tener, ordenados por nivel', () => {
    const w = createCharacter({ name: 'X', classId: 'mago', level: 3, species: 'Humano', background: 'Sabio', abilities: { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 }, skills: [] });
    const all = spellSuggestions({ ...w, spells: [] }, '', 0, true);
    const names = all.map((x) => x.spell.name.en);
    expect(names).toContain('Fire Bolt');
    expect(names).toContain('Misty Step');
    expect(names).not.toContain('Fireball');
    expect(names).not.toContain('Cure Wounds');
    expect(all.map((x) => x.spell.level)).toEqual([...all.map((x) => x.spell.level)].sort((a, b) => a - b));
    expect(featureSuggestions(w, '', 0, true).length).toBeGreaterThan(0);
  });
});

describe('conjuros futuros', () => {
  it('un mago de nivel 3 ve Bola de fuego bloqueada hasta nivel 5; un paladín ve los de nivel 2 a nivel 5', () => {
    const w = createCharacter({ name: 'X', classId: 'mago', level: 3, species: 'Humano', background: 'Sabio', abilities: { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 }, skills: [] });
    const fb = spellSuggestions(w, '', 0, true, true).find((x) => x.spell.name.en === 'Fireball');
    expect(fb?.unlock).toBe(5);
    expect(spellSuggestions(w, '', 0, true, true).find((x) => x.spell.name.en === 'Misty Step')?.unlock).toBeUndefined();
    const p = createCharacter({ name: 'P', classId: 'paladin', level: 1, species: 'Humano', background: 'Noble', abilities: { str: 16, dex: 10, con: 14, int: 8, wis: 12, cha: 14 }, skills: [] });
    const lv2 = spellSuggestions(p, '', 0, true, true).filter((x) => x.spell.level === 2);
    expect(lv2.length).toBeGreaterThan(0);
    expect(lv2.every((x) => x.unlock === 5)).toBe(true);
    expect(spellSuggestions(p, '', 0, true, true).some((x) => x.spell.level >= 6)).toBe(false);
  });
});

import { spellCounts, spellLimits, spellUse } from '../spellLimits';

describe('límite de conjuros y usos', () => {
  const mk = (classId: string, level: number, species = 'Humano') => createCharacter({ name: 'X', classId, level, species, background: 'Sabio', abilities: { str: 10, dex: 14, con: 14, int: 16, wis: 14, cha: 14 }, skills: [] });
  it('tablas 2024: mago 1 → 3 trucos y 4 preparados; mago 10 → 5 y 15; paladín 5 → 0 y 6; bárbaro → 0', () => {
    expect(spellLimits(mk('mago', 1))).toMatchObject({ cantrips: 3, prepared: 4 });
    expect(spellLimits(mk('mago', 10))).toMatchObject({ cantrips: 5, prepared: 15 });
    expect(spellLimits(mk('paladin', 5))).toMatchObject({ cantrips: 0, prepared: 6 });
    expect(spellLimits(mk('barbaro', 5)).caster).toBe(false);
  });
  it('los conjuros de la especie y los siempre preparados no cuentan', () => {
    const c = mk('mago', 1, 'Alto elfo');
    c.spells = [
      { id: '1', name: 'Prestidigitación', level: 0, prepared: true, castingTime: '', range: '', concentration: false },
      { id: '2', name: 'Descarga de fuego', level: 0, prepared: true, castingTime: '', range: '', concentration: false },
      { id: '3', name: 'Escudo', level: 1, prepared: true, castingTime: '', range: '', concentration: false, alwaysPrepared: true },
    ];
    expect(spellCounts(c)).toEqual({ cantrips: 1, prepared: 0 });
  });
  it('icono de usos: truco a voluntad, espacios de nivel 1 con descanso largo', () => {
    const c = mk('mago', 3);
    expect(spellUse(c, { id: 'a', name: 'Descarga de fuego', level: 0, prepared: true, castingTime: '', range: '', concentration: false }).icon).toBe('♾️');
    const u = spellUse(c, { id: 'b', name: 'Proyectil mágico', level: 1, prepared: true, castingTime: '', range: '', concentration: false });
    expect(u.icon).toMatch(/✨\d\/\d🌙/);
    expect(spellUse(mk('brujo', 3), { id: 'c', name: 'Hex', level: 1, prepared: true, castingTime: '', range: '', concentration: false }).icon).toMatch(/⛺/);
  });
});
