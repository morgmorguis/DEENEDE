import { describe, expect, it } from 'vitest';
import { BACKGROUNDS, CLASS_SKILLS, SPECIES_SKILLS, findBackground } from '../origins';
import { SKILLS } from '../srd';
import { drawAvatar, defaultLook, randomLook } from '../avatar';

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

describe('retrato pixel', () => {
  it('dibuja 32×32 con marco dorado y sin huecos', () => {
    const g = drawAvatar(defaultLook('enano'));
    expect(g).toHaveLength(32);
    expect(g.every((row) => row.length === 32 && row.every(Boolean))).toBe(true);
    expect(g[0][5]).toBe('#c9a227');
  });
  it('el aspecto inicial depende de la especie', () => {
    expect(defaultLook('elfo').ears).toBe('pointy');
    expect(defaultLook('tiefling').horns).toBe(true);
    expect(defaultLook('orco').tusks).toBe(true);
    expect(defaultLook('draconido', 'blue').skin).not.toBe(defaultLook('draconido', 'red').skin);
  });
  it('el aleatorio respeta los rasgos de la especie', () => {
    for (let i = 0; i < 20; i++) {
      const l = randomLook('draconido');
      expect(l.snout).toBe(true);
      expect(l.beard).toBe('none');
    }
  });
});
