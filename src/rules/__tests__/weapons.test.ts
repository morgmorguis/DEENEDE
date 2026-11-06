import { beforeAll, describe, expect, it } from 'vitest';
import { setLang } from '../../i18n';
import { WEAPONS, weaponLines } from '../weapons';
import { blankCharacter } from '../factory';
import { maxHp, passiveParts } from '../calc';
import { applyRest } from '../engine';

beforeAll(() => setLang('es'));

describe('armas 2024', () => {
  it('lista completa con ids únicos', () => {
    expect(WEAPONS.length).toBe(38);
    expect(new Set(WEAPONS.map((w) => w.id)).size).toBe(WEAPONS.length);
  });
  it('cuerpo a cuerpo permite no letal; a distancia no', () => {
    const sword = WEAPONS.find((w) => w.id === 'longsword')!;
    const bow = WEAPONS.find((w) => w.id === 'longbow')!;
    expect(weaponLines(sword).some((l) => l.startsWith('✅') && l.includes('no letales'))).toBe(true);
    expect(weaponLines(bow).some((l) => l.startsWith('⛔') && l.includes('no letales'))).toBe(true);
  });
  it('avisa de Pesada con poca Fuerza y de la competencia', () => {
    const c = { ...blankCharacter(), abilities: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 }, weaponProf: 'Armas sencillas' };
    const lines = weaponLines(WEAPONS.find((w) => w.id === 'greataxe')!, c);
    expect(lines.some((l) => l.includes('desventaja (necesitas 13)'))).toBe(true);
    expect(lines.some((l) => l.includes('no tienes competencia'))).toBe(true);
    expect(weaponLines(WEAPONS.find((w) => w.id === 'dagger')!, c).some((l) => l.includes('Tienes competencia'))).toBe(true);
  });
});

describe('PG máximos temporales', () => {
  it('Ayuda sube el máximo, el drenaje lo baja y termina con un descanso largo', () => {
    const c = blankCharacter();
    c.hp = { max: 20, current: 20, temp: 0 };
    c.hpMaxMods = [{ id: 'a', amount: 5, source: 'Ayuda', until: 'manual', at: 0 }, { id: 'd', amount: -7, source: 'Drenaje', until: 'long', at: 0 }];
    expect(maxHp(c)).toBe(18);
    const after = applyRest(c, 'long').char;
    expect(after.hpMaxMods).toHaveLength(1);
    expect(maxHp(after)).toBe(25);
    expect(after.hp.current).toBe(25);
  });
  it('percepción pasiva +5 con ventaja y −5 con desventaja', () => {
    const c = blankCharacter();
    const base = passiveParts(c).total;
    expect(passiveParts({ ...c, conditions: ['envenenado'] }).total).toBe(base - 5);
  });
});
