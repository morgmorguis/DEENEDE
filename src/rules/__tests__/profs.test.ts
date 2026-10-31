import { describe, expect, it } from 'vitest';
import { validate } from '../flags';
import { createCharacter, sampleCharacter } from '../factory';
import { applyLevelUp, levelUpDiff } from '../levelup';
import { setLang } from '../../i18n';

describe('competencias de clase', () => {
  it('detecta y corrige entrenamiento, armas y herramientas', () => {
    setLang('es');
    const r = createCharacter({ name: 'R', classId: 'picaro', level: 2, species: 'Humano', background: 'Criminal', abilities: { str: 8, dex: 16, con: 12, int: 12, wis: 12, cha: 10 }, skills: ['sigilo'] });
    r.armorTraining = { light: false, medium: false, heavy: false, shields: false };
    r.weaponProf = '';
    r.toolProf = '';
    r.attacks.push({ id: 'a', name: 'Espada larga', ability: 'str', proficient: true, damage: '1d8', damageType: 'cortante', range: '', extraBonus: 0 });
    let flags = validate(r);
    const ids = flags.map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(['armor-training', 'weapon-prof', 'tool-prof', 'skill-count', 'martial:espada larga']));
    let fixed = r;
    for (const f of flags) if (f.fix && f.id !== 'martial:espada larga') fixed = f.fix(fixed);
    flags = validate(fixed);
    expect(flags.map((f) => f.id)).not.toContain('armor-training');
    expect(flags.map((f) => f.id)).not.toContain('weapon-prof');
    expect(fixed.toolProf).toMatch(/ladrón/);
  });
  it('la ficha de ejemplo no tiene avisos de competencias', () => {
    expect(validate(sampleCharacter()).map((f) => f.id)).toEqual([]);
  });
  it('paladín 1→2 obtiene Castigo divino siempre preparado y el resumen lo muestra', () => {
    const p = createCharacter({ name: 'P', classId: 'paladin', level: 1, species: 'Humano', background: 'Soldado', abilities: { str: 16, dex: 10, con: 14, int: 8, wis: 10, cha: 14 }, skills: [] });
    const n = applyLevelUp(p, { hpGain: 8, fightingStyle: 'defense' });
    const smite = n.spells.find((s) => s.name === 'Castigo divino');
    expect(smite?.alwaysPrepared).toBe(true);
    expect(smite?.components).toBe('V');
    const d = levelUpDiff(p, n);
    expect(d.stats.find((x) => x.label === 'PG máximos')).toEqual({ label: 'PG máximos', from: String(p.hp.max), to: String(n.hp.max) });
    expect(d.features.find((f) => f.name === 'Castigo del paladín')?.recharge).toBe('long');
    expect(d.spells.map((s) => s.name)).toContain('Castigo divino');
  });
});
